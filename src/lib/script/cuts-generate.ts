/** Sugerir e salvar cortes sobre um banco abstrato (Supabase no app, memória nos testes). */
import { randomUUID } from "node:crypto";
import type { UserAi } from "@/lib/ai";
import { AiError } from "@/lib/ai/schemas";
import { MSG_NOT_FOUND, type InterviewProject } from "@/lib/interview/service";
import { isPlatform } from "@/lib/interview/steps";
import { estimateCutCount } from "@/lib/rules/cuts";
import { buildCutsUser, CUTS_SYSTEM, CutsSchema, normalizeCuts, validateCuts, type Cut } from "./cuts";
import { formatCta, type ScriptCta } from "./generate";
import { cutReviewWarnings, type ReviewFn } from "./review";
import { cortesCtaAgent, withPointer } from "@/lib/ai/agents/cortes-cta";

export interface CutsDb {
  getProject(id: string): Promise<InterviewProject | null>;
  /** Blocos do script em ordem; `position` = 1..n. */
  blocks(projectId: string): Promise<{ position: number; text: string }[]>;
  cta(id: string): Promise<ScriptCta | null>;
  /** Substitui a lista de cortes do projeto. false = projeto não encontrado ou falha. */
  saveCuts(projectId: string, cuts: Cut[]): Promise<boolean>;
}

const MSG_SAVE_FAILED = "Não foi possível salvar os cortes agora. Tente de novo.";

/** A IA escolhe os cortes sobre o script atual; a lista anterior é substituída. */
export async function suggestCutsWith(deps: { db: CutsDb; ai: () => Promise<UserAi>; newId?: () => string }, projectId: string): Promise<Cut[]> {
  const project = await deps.db.getProject(projectId);
  if (!project) throw new AiError(MSG_NOT_FOUND, { code: "invalid_input" });
  const i = project.interview ?? {};
  if (typeof i.cutSeconds !== "number") {
    throw new AiError("Este vídeo está sem cortes. Escolha o tamanho do corte na entrevista para sugerir.", { code: "invalid_input" });
  }
  const blocks = await deps.db.blocks(projectId);
  if (blocks.length === 0) throw new AiError("Gere o script antes de sugerir cortes.", { code: "invalid_input" });
  const platforms = (i.platforms ?? []).filter(isPlatform);
  const cta = i.ctaId ? await deps.db.cta(i.ctaId).catch(() => null) : null;
  const maxCuts = estimateCutCount(i.mainSeconds ?? i.cutSeconds, i.cutSeconds);

  const ai = await deps.ai();
  const raw = await ai.generateJson(
    CutsSchema,
    CUTS_SYSTEM,
    buildCutsUser({ blocks, cutSeconds: i.cutSeconds, count: maxCuts, platforms, about: project.folder_about, style: project.folder_style, title: i.titles?.chosen ?? project.title }),
  );
  const cuts = normalizeCuts(raw, blocks.map((b) => b.text), {
    cutSeconds: i.cutSeconds,
    maxCuts,
    platforms,
    ctaLine: cta ? formatCta(cta) : null,
    newId: deps.newId ?? (() => randomUUID().slice(0, 8)),
  });
  if (cuts.length > 0) {
    // Cada corte aponta para o vídeo completo ou para outro corte; o contato (última linha) continua sendo do código.
    const mainTitle = i.titles?.chosen ?? project.title;
    const pointers = await cortesCtaAgent(
      { ai },
      { mainTitle, cuts: cuts.map((c, k) => ({ index: k + 1, title: c.title, text: blocks.filter((b) => b.position >= c.start && b.position <= c.end).map((b) => b.text).join(" ") })) },
    );
    cuts.forEach((c, k) => {
      const p = pointers[k];
      c.descriptions = withPointer(c.descriptions, p.line, cta ? formatCta(cta) : null);
    });
  }
  if (cuts.length === 0) throw new AiError("Não achei cortes que servem neste script. Marque à mão ou tente de novo.", { code: "invalid_output" });
  if (!(await deps.db.saveCuts(projectId, cuts))) throw new Error(MSG_SAVE_FAILED);
  return cuts;
}

/** Salva os cortes que o usuário ajustou ou marcou à mão. */
export async function saveCutsWith(db: CutsDb, projectId: string, input: unknown): Promise<{ ok: true; cuts: Cut[] } | { ok: false; error: string }> {
  const project = await db.getProject(projectId);
  if (!project) return { ok: false, error: MSG_NOT_FOUND };
  const blocks = await db.blocks(projectId);
  const v = validateCuts(input, blocks.length);
  if (!v.ok) return v;
  if (!(await db.saveCuts(projectId, v.cuts))) return { ok: false, error: MSG_SAVE_FAILED };
  return { ok: true, cuts: v.cuts };
}

/** Avisos de gancho fraco por corte. Qualquer falha do jev vira lista vazia: os cortes já estão salvos. */
export async function cutsWarnings(db: CutsDb, projectId: string, cuts: Cut[], review: ReviewFn): Promise<string[]> {
  try {
    const blocks = await db.blocks(projectId);
    const texts = cuts.map((c) => blocks.filter((b) => b.position >= c.start && b.position <= c.end).map((b) => b.text).join("\n\n"));
    return cutReviewWarnings((await review(texts, { restart: false })).hook);
  } catch (e) {
    console.error("[cortes] reviewExcerpts falhou", e instanceof Error ? e.message : e);
    return [];
  }
}
