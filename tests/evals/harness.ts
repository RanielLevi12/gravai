/**
 * Bateria do roteiro: roda o pipeline "antes" e o "depois" nas fontes de exemplo e dá a nota média do jev.
 * Sem "server-only": roda no vitest (com AI_MOCK) e no script (com chaves reais). Quem decide é o `Judge` que entra.
 */
import { slopScore } from "@/lib/ai/agents/slop";
import { titulosAgent } from "@/lib/ai/agents/titulos";
import type { UserAi } from "@/lib/ai";
import type { InterviewProject } from "@/lib/interview/service";
import type { Interview } from "@/lib/interview/steps";
import { buildScriptUser } from "@/lib/script/prompts";
import { generateScriptWith, ScriptSchema, type NewScriptBlock, type ScriptDb } from "@/lib/script/generate";
import { LEGACY_SCRIPT_SYSTEM, LEGACY_TITLES_SYSTEM, LegacyTitlesSchema } from "./baseline";
import type { EvalSource } from "./fontes";

/** Os três julgamentos do jev (0..1). Em teste, vêm do mock. */
export type Judge = {
  title(titles: string[], context: string): Promise<number[]>;
  hook(texts: string[]): Promise<number[]>;
  closing(texts: string[], context: string): Promise<number[]>;
};

export type Produced = { title: string; opening: string; closing: string; script: string };
export type Pipeline = (source: EvalSource) => Promise<Produced>;
export type Row = { id: string; title: number; hook: number; closing: number; jev: number; slop: number };
export type Report = { rows: Row[]; mean: { title: number; hook: number; closing: number; jev: number; slop: number }; failed: string[] };

const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Nota de uma fonte: média dos três julgamentos do jev. O vício de IA (por 100 palavras, menor é melhor) vai à parte. */
export async function scoreOne(source: EvalSource, made: Produced, judge: Judge): Promise<Row> {
  const context = `${source.niche}. ${source.text.slice(0, 600)}`;
  const [[title], [hook], [closing]] = await Promise.all([judge.title([made.title], context), judge.hook([made.opening]), judge.closing([made.closing], context)]);
  return { id: source.id, title, hook, closing, jev: round((title + hook + closing) / 3), slop: slopScore(made.script) };
}

export async function evaluate(sources: EvalSource[], pipeline: Pipeline, judge: Judge, opts: { concurrency?: number; onProgress?: (id: string) => void } = {}): Promise<Report> {
  const rows: Row[] = [];
  const failed: string[] = [];
  const queue = [...sources];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      try {
        rows.push(await scoreOne(s, await pipeline(s), judge));
        opts.onProgress?.(s.id);
      } catch (e) {
        console.error(`[eval] ${s.id} falhou:`, e instanceof Error ? e.message : e);
        failed.push(s.id);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 3) }, worker));
  rows.sort((a, b) => a.id.localeCompare(b.id));
  const mean = {
    title: round(avg(rows.map((r) => r.title))),
    hook: round(avg(rows.map((r) => r.hook))),
    closing: round(avg(rows.map((r) => r.closing))),
    jev: round(avg(rows.map((r) => r.jev))),
    slop: round(avg(rows.map((r) => r.slop))),
  };
  return { rows, mean, failed };
}

/** Tabela em português simples: antes, depois e a diferença. */
export function formatComparison(before: Report, after: Report): string {
  const line = (label: string, b: number, a: number, lowerIsBetter = false) => {
    const d = round(a - b);
    const good = lowerIsBetter ? d < 0 : d > 0;
    return `${label.padEnd(28)} ${String(b).padStart(6)} ${String(a).padStart(7)} ${(d > 0 ? "+" : "") + d}${d === 0 ? "" : good ? "  (melhorou)" : "  (piorou)"}`;
  };
  return [
    `${"".padEnd(28)} ${"antes".padStart(6)} ${"depois".padStart(7)}`,
    line("Nota média do jev (0 a 1)", before.mean.jev, after.mean.jev),
    line("  título", before.mean.title, after.mean.title),
    line("  gancho (abertura)", before.mean.hook, after.mean.hook),
    line("  fecho (conclusão + CTA)", before.mean.closing, after.mean.closing),
    line("Vícios de IA por 100 palavras", before.mean.slop, after.mean.slop, true),
    `Fontes avaliadas: ${before.rows.length} antes, ${after.rows.length} depois. Falhas: ${before.failed.length + after.failed.length}.`,
  ].join("\n");
}

// ---------- pipelines ----------

const opening = (blocks: { kind: string; text: string }[]) => blocks.find((b) => b.kind === "opening")?.text ?? blocks[0]?.text ?? "";
const closingOf = (blocks: { kind: string; text: string }[]) => [...blocks].reverse().find((b) => b.kind === "closing")?.text ?? blocks.at(-1)?.text ?? "";
const profileOf = (s: EvalSource) => ({ niche: s.niche, audience: s.audience, tone: s.tone, phrases: null });

/** ANTES: prompts congelados da Fase 2, 6 títulos ranqueados só pelo jev, fecho escrito junto com o resto. */
export function legacyPipeline(ai: UserAi, judge: Judge): Pipeline {
  return async (s) => {
    const titles = await ai.generateJson(LegacyTitlesSchema, LEGACY_TITLES_SYSTEM, `Nicho: ${s.niche}\n\nTexto:\n"""\n${s.text}\n"""`);
    const scores = await judge.title(titles.titles, s.text.slice(0, 600));
    const best = titles.titles.map((t, i) => ({ t, n: scores[i] ?? 0 })).sort((a, b) => b.n - a.n)[0]?.t ?? "";
    const script = await ai.generateJson(
      ScriptSchema,
      LEGACY_SCRIPT_SYSTEM,
      buildScriptUser({ sourceText: s.text, interview: { titles: { options: [], chosen: best } } as Interview, profile: profileOf(s), episode: null, platforms: ["reels"], mainSeconds: s.mainSeconds }),
    );
    return { title: best, opening: opening(script.blocks), closing: closingOf(script.blocks), script: script.blocks.map((b) => b.text).join("\n\n") };
  };
}

/** Banco de roteiro em memória (a bateria não toca em Supabase). */
export function memoryScriptDb(s: EvalSource, title: string): ScriptDb & { blocks: NewScriptBlock[] } {
  const project: InterviewProject = {
    id: "eval",
    title,
    source_kind: "text",
    source_text: s.text,
    source_truncated: false,
    status: "entrevista",
    interview: { platforms: ["reels"], mainSeconds: s.mainSeconds, ctaId: s.cta ? "cta" : undefined, titles: { options: [], chosen: title } },
    series_id: null,
    episode_index: null,
    folder_style: { tone: s.tone, audience: s.audience },
  };
  const db = {
    blocks: [] as NewScriptBlock[],
    getProject: async () => structuredClone(project),
    profile: async () => profileOf(s),
    cta: async () => s.cta,
    saveScript: async (_id: string, data: { blocks: NewScriptBlock[] }) => {
      db.blocks = data.blocks;
      return true;
    },
  };
  return db;
}

/** DEPOIS: agente de títulos, depois o script real (`generateScriptWith`) com os agentes de gancho e de fecho. */
export function currentPipeline(ai: UserAi, judge: Judge): Pipeline {
  return async (s) => {
    const titles = await titulosAgent({ ai, score: judge.title }, { sourceText: s.text, profile: profileOf(s), style: { tone: s.tone, audience: s.audience }, mainSeconds: s.mainSeconds });
    const title = titles[0].text;
    const db = memoryScriptDb(s, title);
    await generateScriptWith(
      { db, ai: async () => ai, check: async () => ({ toneOk: 1, ctaPresent: null }), agents: { scoreHook: judge.hook, scoreClosing: judge.closing } },
      "eval",
    );
    return { title, opening: opening(db.blocks), closing: closingOf(db.blocks), script: db.blocks.map((b) => b.text).join("\n\n") };
  };
}

