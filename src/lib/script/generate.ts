/** Geração do script e das descrições sobre um banco abstrato (Supabase no app, memória nos testes). */
import { z } from "zod";
import type { UserAi } from "@/lib/ai";
import type { ScriptCheck } from "@/lib/ai/schemas";
import { AiError } from "@/lib/ai/schemas";
import type { CtaKind } from "@/lib/profile/schema";
import { MSG_NOT_FOUND, type InterviewProject } from "@/lib/interview/service";
import { PLATFORMS, isPlatform, type Interview, type Platform } from "@/lib/interview/steps";
import { estimateCutCount } from "@/lib/rules/cuts";
import { estimateSeconds } from "@/lib/rules/duration";
import { buildScriptUser, SCRIPT_SYSTEM, type ScriptProfile } from "./prompts";

export type BlockKind = "opening" | "bridge" | "cut" | "closing";
export type Descriptions = Partial<Record<Platform, string>>;

const DescriptionsSchema = z.object(Object.fromEntries(PLATFORMS.map((p) => [p, z.string().optional()])));

export const ScriptSchema = z
  .object({
    blocks: z.array(
      z.object({
        kind: z.enum(["opening", "bridge", "cut", "closing"]),
        text: z.string(),
        cutTitle: z.string().optional(),
        descriptions: DescriptionsSchema.optional(),
        coverPrompt: z.string().optional(),
      }),
    ),
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
  /** Só para testes. */
  now?: () => number;
};

const MSG_SAVE_FAILED = "Não foi possível salvar o script agora. Tente de novo.";
const MSG_INCOMPLETE = "Termine a entrevista antes de gerar o script.";
const CUT_TOLERANCE = 1.2;
const TOTAL_MIN = 0.8;
const TOTAL_MAX = 1.2;
const CHECK_MIN = 0.5;
// Uma generateJson leva até ~240 s (2 tentativas em ai/index.ts, cada uma até 2×70 s em openrouter.ts).
// 30 s + 240 s (segunda geração) + 15 s (checkScript) = 285 s < 300 s.
const RETRY_BUDGET_MS = 30_000;

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
export function validateScript(blocks: { kind: BlockKind; text: string }[], mainSeconds: number, cutSeconds: number | null): string[] {
  const problems: string[] = [];
  if (cutSeconds) {
    const limit = cutSeconds * CUT_TOLERANCE;
    blocks
      .filter((b) => b.kind === "cut")
      .forEach((b, n) => {
        const s = estimateSeconds(b.text);
        if (s > limit) problems.push(`o corte ${n + 1} tem ~${s} s e o limite é ${Math.round(limit)} s`);
      });
    const expected = estimateCutCount(mainSeconds, cutSeconds);
    const got = blocks.filter((b) => b.kind === "cut").length;
    if (got !== expected) problems.push(`vieram ${got} cortes e eram ${expected}`);
  }
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
function finishDescriptions(raw: Descriptions | undefined, platforms: Platform[], cta: string | null): Descriptions {
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
  const cutSeconds = i.cutSeconds ?? null;

  const ai = await deps.ai();
  const profile = await deps.db.profile().catch(() => null);
  const cta = i.ctaId ? await deps.db.cta(i.ctaId).catch(() => null) : null;
  const ctaLine = cta ? formatCta(cta) : null;
  const ep = project.episode_index && i.episodes ? i.episodes[project.episode_index - 1] : undefined;
  const episode = ep && project.episode_index ? { index: project.episode_index, title: ep.title, summary: ep.summary } : null;

  const generate = (problem?: string) =>
    ai.generateJson(
      ScriptSchema,
      SCRIPT_SYSTEM,
      buildScriptUser({ sourceText: project.source_text, interview: i, profile, episode, platforms, mainSeconds, cutSeconds, problem }),
    );

  const started = deps.now?.() ?? Date.now();
  let script = await generate();
  let problems = validateScript(script.blocks, mainSeconds, cutSeconds);
  // maxDuration=300 (ver RETRY_BUDGET_MS): se a primeira já demorou, não tenta de novo; o problema vira aviso no script.
  if (problems.length > 0 && (deps.now?.() ?? Date.now()) - started < RETRY_BUDGET_MS) {
    script = await generate(problems.join("; "));
    problems = validateScript(script.blocks, mainSeconds, cutSeconds);
  }

  let cutIndex = 0;
  const blocks: NewScriptBlock[] = script.blocks.map((b, n) => ({
    position: n + 1,
    kind: b.kind,
    text: b.text.trim(),
    cut_index: b.kind === "cut" ? ++cutIndex : null,
    cut_title: b.kind === "cut" ? (b.cutTitle?.trim() ?? null) : null,
    descriptions: b.kind === "cut" ? finishDescriptions(b.descriptions, platforms, ctaLine) : {},
    cover_prompt: b.coverPrompt?.trim() || null,
  }));

  const checks: string[] = [];
  if (i.ctaId && !cta) checks.push("A chamada para ação que você escolheu foi removida do perfil; o script saiu sem ela.");
  const full = blocks.map((b) => b.text).join("\n\n");
  try {
    const r = await deps.check(full, { tone: profile?.tone ?? "", ...(ctaLine ? { cta: ctaLine } : {}) });
    if (r.toneOk < CHECK_MIN) checks.push("O tom do script pode não combinar com o seu perfil.");
    if (ctaLine && r.ctaPresent !== null && r.ctaPresent < CHECK_MIN) checks.push("O script não deixa clara a chamada para ação.");
  } catch (e) {
    console.error("[script] checkScript falhou", e instanceof Error ? e.message : e);
  }

  // Zera avisos antigos e grava só os desta geração.
  const { scriptWarning: _w, scriptChecks: _c, ...rest } = i;
  const interview: Interview = {
    ...rest,
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
