/** Projeto (pasta): nome, cor, "Sobre" e configurações padrão. Puro: roda no cliente e no servidor. */
import { CUT_DURATIONS, allowedCutDurations, type Platform } from "@/lib/rules/cuts";
import { MAIN_DURATIONS } from "@/lib/rules/duration";
import { isPlatform, MAX_TITLE, PLATFORMS, type Cover, type Format, type Scenery } from "@/lib/interview/steps";

export const MAX_NAME = 80;
export const MAX_ABOUT = 1000;
const MAX_SCENERY = 500;
const MAX_PROMPT = 2000;

/** Paleta da marca. A cor guarda a chave; o CSS resolve para a variável. */
export const FOLDER_COLORS = ["rosa", "laranja", "azul", "verde", "amarelo", "grafite"] as const;
export type FolderColor = (typeof FOLDER_COLORS)[number];
export const COLOR_VAR: Record<FolderColor, string> = {
  rosa: "var(--primary)",
  laranja: "var(--tangerine)",
  azul: "var(--sky)",
  verde: "var(--mint)",
  amarelo: "var(--sun)",
  grafite: "var(--ink)",
};
export const COLOR_LABEL: Record<FolderColor, string> = {
  rosa: "Rosa",
  laranja: "Laranja",
  azul: "Azul",
  verde: "Verde",
  amarelo: "Amarelo",
  grafite: "Grafite",
};

export function isFolderColor(v: unknown): v is FolderColor {
  return typeof v === "string" && (FOLDER_COLORS as readonly string[]).includes(v);
}

/** Estilo do projeto: a IA escreve título, gancho e fecho com isso. Tudo opcional. */
export type FolderStyle = { tone?: string; audience?: string; examples?: string };
export const MAX_STYLE_SHORT = 200;
export const MAX_STYLE_EXAMPLES = 1500;

/** Subconjunto de `Interview`: o que o vídeo herda. O título nunca é do projeto. */
export type FolderSettings = {
  platforms: Platform[];
  format: Format;
  mainSeconds: number;
  /** null = sem cortes. */
  cutSeconds: number | null;
  scenery: Scenery;
  cover: Cover;
  /** null = sem chamada no final. */
  ctaId: string | null;
  /** Só existe se a pessoa preencheu algo. */
  style?: FolderStyle;
};

export type FolderInput = { name: string; color: FolderColor; about: string | null; settings: FolderSettings };

/** Valores sugeridos ao criar: Reels, vídeo único, 60 s, cortes de 30 s, cenário natural, capa do vídeo, sem chamada. */
export const DEFAULT_SETTINGS: FolderSettings = {
  platforms: ["reels"],
  format: "single",
  mainSeconds: 60,
  cutSeconds: 30,
  scenery: { mode: "natural", natural: "", aiPrompt: "" },
  cover: "frame",
  ctaId: null,
};

export { CUT_DURATIONS, MAIN_DURATIONS, PLATFORMS, MAX_TITLE };

type Result = { ok: true; value: FolderInput } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.length <= max ? v.trim() : null);

/** Valida e normaliza o que veio do navegador. `ctaIds` são as chamadas do próprio usuário. */
export function validateFolderInput(input: unknown, ctaIds: string[]): Result {
  if (!isObj(input)) return fail("Dados inválidos.");
  const name = text(input.name, MAX_NAME);
  if (!name) return fail(name === null ? `Use no máximo ${MAX_NAME} letras no nome.` : "Dê um nome ao projeto.");
  if (!isFolderColor(input.color)) return fail("Escolha uma cor.");
  const about = input.about == null || input.about === "" ? null : text(input.about, MAX_ABOUT);
  if (about === null && input.about != null && input.about !== "") return fail(`Use no máximo ${MAX_ABOUT} letras em "Sobre este projeto".`);

  const s = input.settings;
  if (!isObj(s)) return fail("Configurações inválidas.");
  if (!Array.isArray(s.platforms) || s.platforms.length === 0 || !s.platforms.every(isPlatform)) {
    return fail("Escolha pelo menos uma plataforma.");
  }
  const platforms = PLATFORMS.filter((p) => (s.platforms as unknown[]).includes(p));
  if (s.format !== "single" && s.format !== "series") return fail("Escolha vídeo único ou série.");
  if (typeof s.mainSeconds !== "number" || !(MAIN_DURATIONS as readonly number[]).includes(s.mainSeconds)) {
    return fail("Escolha uma das durações.");
  }
  const mainSeconds = s.mainSeconds;
  let cutSeconds: number | null = null;
  if (s.cutSeconds !== null) {
    if (typeof s.cutSeconds !== "number" || !allowedCutDurations(mainSeconds).includes(s.cutSeconds)) {
      return fail("Esse corte não cabe no vídeo: ele pode ter no máximo metade da duração.");
    }
    cutSeconds = s.cutSeconds;
  }
  if (!isObj(s.scenery) || (s.scenery.mode !== "natural" && s.scenery.mode !== "ai")) return fail("Escolha um cenário.");
  const natural = text(s.scenery.natural ?? "", MAX_SCENERY);
  const aiPrompt = text(s.scenery.aiPrompt ?? "", MAX_PROMPT);
  if (natural === null || aiPrompt === null) return fail("Descrição do cenário longa demais.");
  if (s.cover !== "frame" && s.cover !== "ai") return fail("Escolha um tipo de capa.");
  if (s.ctaId !== null && (typeof s.ctaId !== "string" || !ctaIds.includes(s.ctaId))) return fail("Escolha uma das suas chamadas.");
  const style = validateStyle(s.style);
  if (style === null) return fail(`Estilo longo demais: use até ${MAX_STYLE_SHORT} letras em tom e público e ${MAX_STYLE_EXAMPLES} nos exemplos.`);

  return {
    ok: true,
    value: {
      name,
      color: input.color,
      about,
      settings: {
        platforms,
        format: s.format,
        mainSeconds,
        cutSeconds,
        scenery: { mode: s.scenery.mode, natural, aiPrompt },
        cover: s.cover,
        ctaId: s.ctaId,
        ...(style ? { style } : {}),
      },
    },
  };
}

/** undefined = sem estilo; null = inválido (tipo errado ou longo demais). */
function validateStyle(raw: unknown): FolderStyle | undefined | null {
  if (raw == null) return undefined;
  if (!isObj(raw)) return null;
  const tone = raw.tone == null || raw.tone === "" ? "" : text(raw.tone, MAX_STYLE_SHORT);
  const audience = raw.audience == null || raw.audience === "" ? "" : text(raw.audience, MAX_STYLE_SHORT);
  const examples = raw.examples == null || raw.examples === "" ? "" : text(raw.examples, MAX_STYLE_EXAMPLES);
  if (tone === null || audience === null || examples === null) return null;
  const out: FolderStyle = { ...(tone ? { tone } : {}), ...(audience ? { audience } : {}), ...(examples ? { examples } : {}) };
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Estilo guardado em `folders.settings` (banco pode ter lixo): só texto, com os mesmos limites. */
export function styleFromSettings(raw: unknown): FolderStyle | null {
  const style = raw && typeof raw === "object" ? (raw as { style?: unknown }).style : undefined;
  const v = validateStyle(style);
  return v ?? null;
}

/** Resumo curto das configurações: "Reels · vídeo único · 60 s · cortes de 30 s · sem chamada". */
export function summarizeSettings(s: Partial<FolderSettings>, ctaLabel?: string | null): string {
  const labels: Record<Platform, string> = {
    youtube: "YouTube",
    reels: "Reels",
    feed_instagram: "Feed",
    facebook: "Facebook",
    tiktok: "TikTok",
    x: "X",
  };
  const parts: string[] = [];
  if (s.platforms?.length) parts.push(s.platforms.map((p) => labels[p]).join(", "));
  if (s.format) parts.push(s.format === "single" ? "vídeo único" : "série");
  if (s.mainSeconds) parts.push(s.mainSeconds < 120 ? `${s.mainSeconds} s` : `${Math.round(s.mainSeconds / 60)} min`);
  if (s.cutSeconds === null) parts.push("sem cortes");
  else if (s.cutSeconds) parts.push(`cortes de ${s.cutSeconds} s`);
  if (s.ctaId === null) parts.push("sem chamada");
  else if (s.ctaId) parts.push(ctaLabel ? `chamada: ${ctaLabel}` : "com chamada");
  return parts.join(" · ");
}
