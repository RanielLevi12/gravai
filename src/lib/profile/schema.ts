/** Valores e validação do perfil. Puro: roda no cliente (mensagens) e no servidor (garantia). */

export const TONES = ["serio", "descontraido", "pastoral", "tecnico", "motivacional", "didatico"] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  serio: "Sério",
  descontraido: "Descontraído",
  pastoral: "Pastoral",
  tecnico: "Técnico",
  motivacional: "Motivacional",
  didatico: "Didático",
};

export const CTA_KINDS = ["link", "bio", "whatsapp", "phone"] as const;
export type CtaKind = (typeof CTA_KINDS)[number];

export type CtaInput = { kind: CtaKind; label: string; value: string };

export type ProfileInput = {
  niche?: string;
  audience?: string;
  tone?: Tone;
  phrases?: string;
  onboarded?: boolean;
};

export const DEFAULT_CTA_LABELS: Record<CtaKind, string> = {
  link: "Link",
  bio: "Instagram",
  whatsapp: "WhatsApp",
  phone: "Telefone",
};

export const MAX_CTAS = 10;
const MAX_SHORT = 120;
const MAX_PHRASES = 500;
const MAX_LABEL = 60;
const MAX_URL = 300;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isTone(value: unknown): value is Tone {
  return typeof value === "string" && (TONES as readonly string[]).includes(value);
}

export function isCtaKind(value: unknown): value is CtaKind {
  return typeof value === "string" && (CTA_KINDS as readonly string[]).includes(value);
}

/** Telefone brasileiro: DDD + número (10 ou 11 dígitos), com ou sem o 55 na frente. */
export function normalizePhone(raw: string, nome = "telefone"): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) {
    throw new ValidationError(`Confira o ${nome}: use o DDD e o número, por exemplo 11 99999-0000.`);
  }
  return digits;
}

export function normalizeUrl(raw: string): string {
  const text = raw.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ValidationError("Confira o link: ele precisa ser um endereço de site, como gravai.app/loja.");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname.includes(".") || withScheme.length > MAX_URL) {
    throw new ValidationError("Confira o link: ele precisa ser um endereço de site, como gravai.app/loja.");
  }
  return url.href;
}

export function normalizeHandle(raw: string): string {
  const handle = raw.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
    throw new ValidationError("Confira o @ do Instagram: só letras, números, ponto e sublinhado.");
  }
  return `@${handle}`;
}

export function normalizeCta(input: unknown): CtaInput {
  if (typeof input !== "object" || input === null) throw new ValidationError("Link inválido.");
  const { kind, label, value } = input as Record<string, unknown>;
  if (!isCtaKind(kind)) throw new ValidationError("Tipo de link inválido.");
  if (typeof value !== "string" || value.trim() === "") throw new ValidationError("Preencha o link.");
  const cleanLabel = typeof label === "string" ? label.trim().slice(0, MAX_LABEL) : "";
  const finalLabel = cleanLabel || DEFAULT_CTA_LABELS[kind];
  switch (kind) {
    case "link":
      return { kind, label: finalLabel, value: normalizeUrl(value) };
    case "bio":
      return { kind, label: finalLabel, value: normalizeHandle(value) };
    case "whatsapp":
      return { kind, label: finalLabel, value: normalizePhone(value, "WhatsApp") };
    case "phone":
      return { kind, label: finalLabel, value: normalizePhone(value, "telefone") };
  }
}

export function normalizeCtas(input: unknown): CtaInput[] {
  if (!Array.isArray(input)) throw new ValidationError("Lista de links inválida.");
  if (input.length > MAX_CTAS) throw new ValidationError(`Você pode salvar até ${MAX_CTAS} links.`);
  return input.map(normalizeCta);
}

function text(value: unknown, max: number, campo: string): string | null {
  if (typeof value !== "string") throw new ValidationError(`Texto inválido em ${campo}.`);
  const clean = value.trim();
  if (clean.length > max) throw new ValidationError(`${campo} aceita até ${max} caracteres.`);
  return clean === "" ? null : clean;
}

/** Campos do banco a gravar; só o que veio definido entra. Texto vazio vira null. */
export function normalizeProfile(input: unknown) {
  if (typeof input !== "object" || input === null) throw new ValidationError("Dados inválidos.");
  const { niche, audience, tone, phrases, onboarded } = input as Record<string, unknown>;
  const row: {
    niche?: string | null;
    audience?: string | null;
    tone?: Tone;
    phrases?: string | null;
    onboarded?: boolean;
  } = {};
  if (niche !== undefined) row.niche = text(niche, MAX_SHORT, "Assunto");
  if (audience !== undefined) row.audience = text(audience, MAX_SHORT, "Público");
  if (phrases !== undefined) row.phrases = text(phrases, MAX_PHRASES, "Frases");
  if (tone !== undefined) {
    if (!isTone(tone)) throw new ValidationError("Tom de voz inválido.");
    row.tone = tone;
  }
  if (onboarded !== undefined) {
    if (typeof onboarded !== "boolean") throw new ValidationError("Dados inválidos.");
    row.onboarded = onboarded;
  }
  return row;
}
