/** Geração do script e das descrições sobre um banco abstrato (Supabase no app, memória nos testes). */
import { z } from "zod";
import type { UserAi } from "@/lib/ai";
import type { ScriptCheck } from "@/lib/ai/schemas";
import { AiError } from "@/lib/ai/schemas";
import type { CtaKind } from "@/lib/profile/schema";
import { MSG_NOT_FOUND, type InterviewProject } from "@/lib/interview/service";
import { PLATFORMS, isPlatform, type Interview, type Platform } from "@/lib/interview/steps";
import { estimateSeconds } from "@/lib/rules/duration";
import { buildScriptUser, SCRIPT_SYSTEM, type ScriptProfile } from "./prompts";
import { conclusaoCtaAgent, ctaObjective, type ClosingScoreFn } from "@/lib/ai/agents/conclusao-cta";
import type { AgentContext } from "@/lib/ai/agents/contexto";
import { hooksAgent, type HookScoreFn } from "@/lib/ai/agents/hooks";
import { scriptReviewWarnings, type ReviewFn } from "./review";

/** "body" = trecho do script contínuo; "bridge" e "cut" só existem em scripts gerados antes. */
export type BlockKind = "opening" | "body" | "bridge" | "cut" | "closing";
export type Descriptions = Partial<Record<Platform, string>>;

const DescriptionsSchema = z.object(Object.fromEntries(PLATFORMS.map((p) => [p, z.string().optional()])));

export const ScriptSchema = z
  .object({
    blocks: z.array(z.object({ kind: z.enum(["opening", "body", "closing"]), text: z.string() })),
    mainDescriptions: DescriptionsSchema,
    mainCoverPrompt: z.string(),
  })
  .meta({ title: "script_generation" });

export type GeneratedScript = z.infer<typeof ScriptSchema>;

export type ScriptCta = { kind: CtaKind; label: string | null; value: string | null };

export type NewScriptBlock = {
  position: number;
  kind: BlockKind;
  text: string;
  cut_index: number | null;
  cut_title: string | null;
  descriptions: Descriptions;
  cover_prompt: string | null;
};

export interface ScriptDb {
  getProject(id: string): Promise<InterviewProject | null>;
  profile(): Promise<ScriptProfile | null>;
  cta(id: string): Promise<ScriptCta | null>;
  /** Substitui os blocos do projeto pelos novos (sem duplicar) e atualiza descrições, entrevista e status='script'. */
  saveScript(projectId: string, data: { blocks: NewScriptBlock[]; descriptions: Descriptions; coverPrompt: string | null; interview: Interview }): Promise<boolean>;
}

export type ScriptDeps = {
  db: ScriptDb;
  ai: () => Promise<UserAi>;
  check: (text: string, opts: { tone: string; cta?: string }) => Promise<ScriptCheck>;
  /** Gancho por trecho e recomeço (jev). Opcional: sem ele, não há esse aviso. */
  review?: ReviewFn;
  /** Agentes de gancho e de fecho (notas do jev). Opcional: sem ele, o script sai só com o prompt-base. */
  agents?: { scoreHook: HookScoreFn; scoreClosing: ClosingScoreFn };
  /** Só para testes. */
  now?: () => number;
};

const MSG_SAVE_FAILED = "Não foi possível salvar o script agora. Tente de novo.";
const MSG_INCOMPLETE = "Termine a entrevista antes de gerar o script.";
const TOTAL_MIN = 0.8;
const TOTAL_MAX = 1.2;
const CHECK_MIN = 0.5;
// Uma generateJson leva até ~240 s (2 tentativas em ai/index.ts, cada uma até 2×70 s em openrouter.ts).
// 30 s + 240 s (segunda geração) + 15 s (checkScript) = 285 s < 300 s.
const RETRY_BUDGET_MS = 30_000;
// Os agentes são um extra: cada um tem teto próprio e o do fecho só roda se sobrar tempo dentro dos 300 s da função.
const HOOK_AGENT_MS = 50_000;
const CLOSING_AGENT_MS = 60_000;
const CLOSING_START_BEFORE_MS = 170_000;

/** Resolve com o valor ou rejeita se passar do tempo. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("tempo esgotado")), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}

/** Linha final da descrição, montada no código (nunca pela IA). */
export function formatCta(cta: ScriptCta): string | null {
  const value = cta.value?.trim();
  if (!value) return null;
  switch (cta.kind) {
    case "whatsapp":
      return `Chama no WhatsApp: https://wa.me/55${value}`;
    case "bio":
      return `Link na bio: ${value}`;
    case "link":
      return `${cta.label?.trim() || "Link"}: ${value}`;
    case "phone":
      return `Ligue: ${value}`;
  }
}

/** Problemas de duração do script; lista vazia = ok. */
export function validateScript(blocks: { kind: BlockKind; text: string }[], mainSeconds: number): string[] {
  const problems: string[] = [];
  const total = blocks.reduce((sum, b) => sum + estimateSeconds(b.text), 0);
  if (total < mainSeconds * TOTAL_MIN || total > mainSeconds * TOTAL_MAX) {
    problems.push(`o vídeo todo tem ~${total} s e deveria ter entre ${Math.round(mainSeconds * TOTAL_MIN)} e ${Math.round(mainSeconds * TOTAL_MAX)} s`);
  }
  return problems;
}

function withCta(text: string | undefined, cta: string | null): string | null {
  const body = text?.trim();
  if (!body) return null;
  return cta ? `${body}\n${cta}` : body;
}

/** Só as plataformas escolhidas; com CTA, a última linha é o CTA. */
export function finishDescriptions(raw: Descriptions | undefined, platforms: Platform[], cta: string | null): Descriptions {
  const out: Descriptions = {};
  for (const p of platforms) {
    const d = withCta(raw?.[p], cta);
    if (d) out[p] = d;
  }
  return out;
}

export async function generateScriptWith(deps: ScriptDeps, projectId: string): Promise<void> {
  const project = await deps.db.getProject(projectId);
  if (!project) throw new AiError(MSG_NOT_FOUND, { code: "invalid_input" });
  const i = project.interview ?? {};
  const platforms = (i.platforms ?? []).filter(isPlatform);
  if (platforms.length === 0 || !i.mainSeconds) throw new AiError(MSG_INCOMPLETE, { code: "invalid_input" });
  const mainSeconds = i.mainSeconds;

  const ai = await deps.ai();
  const profile = await deps.db.profile().catch(() => null);
  const cta = i.ctaId ? await deps.db.cta(i.ctaId).catch(() => null) : null;
  const ctaLine = cta ? formatCta(cta) : null;
  const ep = project.episode_index && i.episodes ? i.episodes[project.episode_index - 1] : undefined;
  const episode = ep && project.episode_index ? { index: project.episode_index, title: ep.title, summary: ep.summary } : null;

  const t0 = deps.now?.() ?? Date.now();
  const agentCtx: AgentContext = {
    sourceText: project.source_text,
    sourceLimit: 12_000,
    title: i.titles?.chosen ?? project.title,
    profile,
    about: project.folder_about,
    style: project.folder_style,
    episode,
    platforms,
    mainSeconds,
  };

  // Gancho: 3 opções de tipos diferentes; a melhor abre o script. Falha ou demora = o prompt-base escreve a abertura.
  let hooks: Awaited<ReturnType<typeof hooksAgent>> = [];
  if (deps.agents) {
    try {
      hooks = await withTimeout(hooksAgent({ ai, score: deps.agents.scoreHook }, agentCtx), HOOK_AGENT_MS);
    } catch (e) {
      console.error("[script] agente de ganchos falhou", e instanceof Error ? e.message : e);
    }
  }
  const hook = hooks.find((h) => h.best) ?? null;
  const objective = ctaObjective(cta);

  const generate = (problem?: string) =>
    ai.generateJson(
      ScriptSchema,
      SCRIPT_SYSTEM,
      buildScriptUser({
        sourceText: project.source_text,
        interview: i,
        profile,
        episode,
        platforms,
        mainSeconds,
        about: project.folder_about,
        style: project.folder_style,
        hook,
        ctaObjective: objective,
        problem,
      }),
    );

  const started = deps.now?.() ?? Date.now();
  let script = await generate();
  let problems = validateScript(script.blocks, mainSeconds);
  // maxDuration=300 (ver RETRY_BUDGET_MS): se a primeira já demorou, não tenta de novo; o problema vira aviso no script.
  if (problems.length > 0 && (deps.now?.() ?? Date.now()) - started < RETRY_BUDGET_MS) {
    script = await generate(problems.join("; "));
    problems = validateScript(script.blocks, mainSeconds);
  }

  const blocks: NewScriptBlock[] = script.blocks.map((b, n) => ({
    position: n + 1,
    kind: b.kind,
    text: b.text.trim(),
    cut_index: null,
    cut_title: null,
    descriptions: {},
    cover_prompt: null,
  }));

  // Fecho: a IA escreve a conclusão e o CTA a partir do objetivo salvo; o contato continua sendo montado pelo código.
  let closing: Awaited<ReturnType<typeof conclusaoCtaAgent>> = [];
  const elapsed = (deps.now?.() ?? Date.now()) - t0;
  const closingBlock = [...blocks].reverse().find((b) => b.kind === "closing");
  if (deps.agents && closingBlock && elapsed < CLOSING_START_BEFORE_MS) {
    try {
      closing = await withTimeout(
        conclusaoCtaAgent(
          { ai, score: deps.agents.scoreClosing },
          { ctx: agentCtx, scriptBody: blocks.filter((b) => b.kind !== "closing").map((b) => b.text).join("\n\n"), cta },
        ),
        Math.min(CLOSING_AGENT_MS, 285_000 - elapsed),
      );
      const best = closing.find((c) => c.best);
      if (best) closingBlock.text = best.text;
    } catch (e) {
      console.error("[script] agente de fecho falhou", e instanceof Error ? e.message : e);
    }
  }
  problems = validateScript(blocks, mainSeconds);

  const checks: string[] = [];
  if (i.ctaId && !cta) checks.push("A chamada para ação que você escolheu foi removida do perfil; o script saiu sem ela.");
  const full = blocks.map((b) => b.text).join("\n\n");
  // Em paralelo: a revisão não pode somar tempo ao teto da função (ver RETRY_BUDGET_MS).
  const reviewed = blocks.filter((b) => b.kind !== "closing");
  const [checked, review] = await Promise.allSettled([
    deps.check(full, { tone: profile?.tone ?? "", ...(ctaLine ? { cta: ctaLine } : {}) }),
    deps.review ? deps.review(reviewed.map((b) => b.text), { restart: true }) : Promise.resolve(null),
  ]);
  if (checked.status === "fulfilled") {
    const r = checked.value;
    if (r.toneOk < CHECK_MIN) checks.push("O tom do script pode não combinar com o seu perfil.");
    if (ctaLine && r.ctaPresent !== null && r.ctaPresent < CHECK_MIN) checks.push("O script não deixa clara a chamada para ação.");
  } else {
    console.error("[script] checkScript falhou", checked.reason instanceof Error ? checked.reason.message : checked.reason);
  }
  if (review.status === "fulfilled" && review.value) checks.push(...scriptReviewWarnings(reviewed, review.value));
  else if (review.status === "rejected") console.error("[script] reviewExcerpts falhou", review.reason instanceof Error ? review.reason.message : review.reason);

  // Zera avisos antigos e grava só os desta geração.
  const { scriptWarning: _w, scriptChecks: _c, scriptAgents: _a, ...rest } = i;
  const interview: Interview = {
    ...rest,
    ...(hooks.length > 0 || closing.length > 0
      ? {
          scriptAgents: {
            ...(hooks.length > 0 ? { hooks: hooks.map(({ type, text, onScreen, visual, score, best }) => ({ type, text, onScreen, visual, score, best })) } : {}),
            ...(closing.length > 0 ? { closing: closing.map(({ type, text, conclusion, cta: c, score, best }) => ({ type, text, conclusion, cta: c, score, best })) } : {}),
          },
        }
      : {}),
    ...(problems.length > 0 ? { scriptWarning: `O script ficou fora do esperado: ${problems.join("; ")}.` } : {}),
    ...(checks.length > 0 ? { scriptChecks: checks } : {}),
  };
  const ok = await deps.db.saveScript(projectId, {
    blocks,
    descriptions: finishDescriptions(script.mainDescriptions, platforms, ctaLine),
    coverPrompt: script.mainCoverPrompt.trim() || null,
    interview,
  });
  if (!ok) throw new Error(MSG_SAVE_FAILED);
}
