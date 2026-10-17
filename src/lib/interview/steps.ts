/** Passos, valores e validação da entrevista. Puro: roda no cliente (rótulos) e no servidor (garantia). */
import { allowedCutDurations, estimateCutCount, type Platform } from "@/lib/rules/cuts";
import { MAIN_DURATIONS, mainDurationOptions } from "@/lib/rules/duration";

export type { Platform };

export const STEPS = ["plataformas", "formato", "duracao", "cortes", "cenario", "titulos", "capa", "cta", "resumo"] as const;
export type Step = (typeof STEPS)[number];
/** Passos que são perguntas (os 8 antes do resumo). */
export type AnswerStep = Exclude<Step, "resumo">;
/** Subtela da série, entre `formato` e `duracao`. */
export const EPISODES_STEP = "episodios";
export type RouteStep = Step | typeof EPISODES_STEP;

export const QUESTION_COUNT = 8;

export const PLATFORMS = ["youtube", "reels", "feed_instagram", "facebook", "tiktok", "x"] as const satisfies readonly Platform[];
export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  reels: "Reels",
  feed_instagram: "Feed do Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
};

export const MAX_EPISODES = 10;
export const MIN_EPISODES = 2;
const MAX_EPISODE_TITLE = 100;
const MAX_EPISODE_SUMMARY = 500;
const MAX_SCENERY = 500;
const MAX_PROMPT = 2000;
export const MAX_TITLE = 150;

export type Episode = { title: string; summary: string };
export type Scenery = { mode: "natural" | "ai"; natural: string; aiPrompt: string };
/** `type` e `best` vêm do agente de títulos (a opção marcada como melhor). */
export type TitleOption = { text: string; score: number; type?: string; best?: boolean };
export type Titles = { options: TitleOption[]; chosen: string };
export type Cover = "frame" | "ai";
export type Format = "single" | "series";

/** Sugestão da IA, salva uma vez em `interview.suggestion`. */
export type InterviewSuggestion = {
  platforms: Platform[];
  format: Format;
  episodes: Episode[];
  mainSeconds: number;
  scenery: { natural: string; aiPrompt: string };
  cover: Cover;
  reasons: Partial<Record<"plataformas" | "formato" | "duracao" | "cenario" | "capa", string>>;
};

export type Interview = {
  current?: RouteStep;
  platforms?: Platform[];
  format?: Format;
  episodes?: Episode[];
  mainSeconds?: number;
  cutSeconds?: number | null;
  scenery?: Scenery;
  titles?: Titles;
  cover?: Cover;
  ctaId?: string | null;
  suggestion?: InterviewSuggestion;
  /** Quando a sugestão falhou (erro da IA): não tentamos de novo sozinhos. */
  suggestionFailedAt?: string;
  titleSuggestions?: TitleOption[];
  /** Problema de duração que sobrou depois da regeneração do script. */
  scriptWarning?: string;
  /** Avisos do `checkScript` (tom e CTA). */
  scriptChecks?: string[];
  /** Opções dos agentes de roteiro da última geração (a melhor vem primeiro), para a tela mostrar e trocar. */
  scriptAgents?: ScriptAgentOptions;
};

export type HookOption = { type: string; text: string; onScreen: string; visual: string; score: number; best: boolean };
export type ClosingOption = { type: string; text: string; conclusion: string; cta: string; score: number; best: boolean };
export type ScriptAgentOptions = { hooks?: HookOption[]; closing?: ClosingOption[] };

/** Valor de cada pergunta. */
export type StepValues = {
  plataformas: Platform[];
  formato: Format;
  duracao: number;
  cortes: number | null;
  cenario: Scenery;
  titulos: Titles;
  capa: Cover;
  cta: string | null;
};

export const STEP_FIELD = {
  plataformas: "platforms",
  formato: "format",
  duracao: "mainSeconds",
  cortes: "cutSeconds",
  cenario: "scenery",
  titulos: "titles",
  capa: "cover",
  cta: "ctaId",
} as const satisfies Record<AnswerStep, keyof Interview>;

export function isStep(v: unknown): v is Step {
  return typeof v === "string" && (STEPS as readonly string[]).includes(v);
}

export function isRouteStep(v: unknown): v is RouteStep {
  return v === EPISODES_STEP || isStep(v);
}

export function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);
}

/** Número da pergunta (1..8) na barra de progresso; a subtela de episódios conta como a do formato. */
export function questionNumber(step: RouteStep): number {
  if (step === EPISODES_STEP) return 2;
  if (step === "resumo") return QUESTION_COUNT;
  return STEPS.indexOf(step) + 1;
}

export function formatSeconds(seconds: number): string {
  return seconds < 120 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

export function cutSummary(mainSeconds: number, cutSeconds: number): string {
  const n = estimateCutCount(mainSeconds, cutSeconds);
  return `${n} ${n === 1 ? "corte" : "cortes"} de ${cutSeconds} s`;
}

/** Ordem de checagem: a subtela de episódios só conta quando o formato é série. */
const ORDER: readonly RouteStep[] = ["plataformas", "formato", EPISODES_STEP, "duracao", "cortes", "cenario", "titulos", "capa", "cta"];

function answered(i: Interview, step: RouteStep): boolean {
  switch (step) {
    case "plataformas":
      return (i.platforms?.length ?? 0) > 0;
    case "formato":
      return i.format !== undefined;
    case EPISODES_STEP:
      return i.format !== "series" || (i.episodes?.length ?? 0) >= MIN_EPISODES;
    case "duracao":
      return i.mainSeconds !== undefined;
    case "cortes":
      return i.cutSeconds !== undefined;
    case "cenario":
      return i.scenery !== undefined;
    case "titulos":
      return Boolean(i.titles?.chosen);
    case "capa":
      return i.cover !== undefined;
    case "cta":
      return i.ctaId !== undefined;
    default:
      return true;
  }
}

/** Primeira pergunta sem resposta; "resumo" quando todas estão respondidas. */
export function firstMissing(i: Interview): RouteStep {
  return ORDER.find((s) => !answered(i, s)) ?? "resumo";
}

/** Próximo passo depois de `step`: a próxima pergunta sem resposta; "resumo" se não houver. */
export function nextAfter(i: Interview, step: RouteStep): RouteStep {
  const from = ORDER.indexOf(step);
  return ORDER.slice(from + 1).find((s) => !answered(i, s)) ?? "resumo";
}

/** Um passo só abre se todos os anteriores estiverem respondidos. */
export function canOpen(i: Interview, step: RouteStep): boolean {
  const missing = firstMissing(i);
  if (missing === "resumo") return true;
  if (step === "resumo") return false;
  return ORDER.indexOf(step) <= ORDER.indexOf(missing);
}

export type ApplyContext = { sourceText: string; ctaIds: string[] };
export type ApplyResult = { ok: true; interview: Interview; next: RouteStep } | { ok: false; error: string };

const fail = (error: string): ApplyResult => ({ ok: false, error });
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length <= max ? v.trim() : null);

/**
 * Aplica a resposta de um passo: valida, normaliza e devolve a entrevista nova com `current` = próximo passo.
 * Determinístico: o mesmo valor sobre o mesmo estado gera o mesmo resultado (idempotente).
 */
export function applyAnswer(interview: Interview, step: AnswerStep, value: unknown, ctx: ApplyContext): ApplyResult {
  const next: Interview = { ...interview };
  switch (step) {
    case "plataformas": {
      if (!Array.isArray(value) || value.length === 0 || !value.every(isPlatform)) return fail("Escolha pelo menos uma plataforma.");
      next.platforms = PLATFORMS.filter((p) => value.includes(p));
      break;
    }
    case "formato": {
      if (value !== "single" && value !== "series") return fail("Escolha vídeo único ou série.");
      next.format = value;
      if (value === "single") delete next.episodes;
      break;
    }
    case "duracao": {
      const option = mainDurationOptions(ctx.sourceText).find((o) => o.seconds === value);
      if (!option) return fail("Escolha uma das durações.");
      if (!option.enabled) return fail(option.reason ?? "Duração indisponível para este texto.");
      next.mainSeconds = option.seconds;
      // Corte que não cabe mais no vídeo novo precisa ser escolhido de novo.
      if (typeof next.cutSeconds === "number" && !allowedCutDurations(option.seconds).includes(next.cutSeconds)) {
        delete next.cutSeconds;
      }
      break;
    }
    case "cortes": {
      if (next.mainSeconds === undefined) return fail("Escolha antes a duração do vídeo.");
      if (value !== null) {
        if (typeof value !== "number" || !allowedCutDurations(next.mainSeconds).includes(value)) {
          return fail("Esse corte não cabe no vídeo: ele pode ter no máximo metade da duração.");
        }
      }
      next.cutSeconds = value as number | null;
      break;
    }
    case "cenario": {
      if (!isObj(value) || (value.mode !== "natural" && value.mode !== "ai")) return fail("Escolha um cenário.");
      const natural = str(value.natural, MAX_SCENERY);
      const aiPrompt = str(value.aiPrompt, MAX_PROMPT);
      if (natural === null || aiPrompt === null) return fail("Descrição do cenário longa demais.");
      next.scenery = { mode: value.mode, natural, aiPrompt };
      break;
    }
    case "titulos": {
      if (!isObj(value) || !Array.isArray(value.options)) return fail("Escolha um título.");
      const chosen = str(value.chosen, MAX_TITLE);
      if (!chosen) return fail(chosen === null ? `Use no máximo ${MAX_TITLE} caracteres no título.` : "Escolha ou escreva um título.");
      const options: TitleOption[] = [];
      for (const o of value.options.slice(0, 10)) {
        const text = isObj(o) ? str(o.text, MAX_TITLE) : null;
        const score = isObj(o) && typeof o.score === "number" && Number.isFinite(o.score) ? Math.min(1, Math.max(0, o.score)) : null;
        if (!text || score === null) return fail("Escolha um título.");
        options.push({ text, score });
      }
      next.titles = { options, chosen };
      break;
    }
    case "capa": {
      if (value !== "frame" && value !== "ai") return fail("Escolha um tipo de capa.");
      next.cover = value;
      break;
    }
    case "cta": {
      if (value !== null && (typeof value !== "string" || !ctx.ctaIds.includes(value))) return fail("Escolha uma das suas chamadas.");
      next.ctaId = value;
      break;
    }
    default:
      return fail("Passo inválido.");
  }
  const after = nextAfter(next, step);
  next.current = after;
  return { ok: true, interview: next, next: after };
}

/** Valida e normaliza a lista de episódios da série. */
export function validateEpisodes(value: unknown): { ok: true; episodes: Episode[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length < MIN_EPISODES) return { ok: false, error: "Uma série precisa de pelo menos 2 episódios." };
  if (value.length > MAX_EPISODES) return { ok: false, error: `Uma série pode ter no máximo ${MAX_EPISODES} episódios.` };
  const episodes: Episode[] = [];
  for (const e of value) {
    const title = isObj(e) ? str(e.title, MAX_EPISODE_TITLE) : null;
    const summary = isObj(e) ? str(e.summary ?? "", MAX_EPISODE_SUMMARY) : null;
    if (!title) return { ok: false, error: "Dê um título a cada episódio." };
    if (summary === null) return { ok: false, error: "Resumo de episódio longo demais." };
    episodes.push({ title, summary });
  }
  return { ok: true, episodes };
}

export { MAIN_DURATIONS };

/** Respostas que mudam o script gerado (fora o passo atual, a sugestão da IA e os avisos). */
const SCRIPT_INPUT_FIELDS = ["platforms", "format", "episodes", "mainSeconds", "cutSeconds", "scenery", "titles", "cover", "ctaId"] as const;

/** true se `next` difere de `prev` em algo que o script usa. */
export function changesScriptInputs(prev: Interview, next: Interview): boolean {
  return SCRIPT_INPUT_FIELDS.some((f) => JSON.stringify(prev[f] ?? null) !== JSON.stringify(next[f] ?? null));
}

/** O projeto já tem script gerado (e portanto pode ficar desatualizado). */
export const hasScript = (status: string): boolean => status === "script" || status === "gravacao" || status === "gravado" || status === "pronto";
