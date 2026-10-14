export type JobStatus = "queued" | "running" | "done" | "failed";
export type ExportKind = "final" | "cut" | "cover";

export const EXPORT_TTL_DAYS = 30;
export const WARN_DAYS = 5;
export const STALE_JOB_MINUTES = 10;
export const MAX_ATTEMPTS = 3;

const DAY_MS = 86_400_000;

export const STEP_LABELS = {
  preparando: "Preparando",
  juntando: "Juntando os vídeos",
  transcrevendo: "Ouvindo a gravação",
  cortando: "Cortando",
  capas: "Criando as capas",
  enviando: "Guardando os arquivos",
} as const;

export type JobStep = keyof typeof STEP_LABELS;

/** Quando os arquivos gerados agora deixam de existir. */
export function expiresAt(from: Date): Date {
  return new Date(from.getTime() + EXPORT_TTL_DAYS * DAY_MS);
}

/** Dias inteiros que faltam até `expires` (nunca negativo). */
export function daysLeft(expires: Date, now: Date): number {
  return Math.max(0, Math.floor((expires.getTime() - now.getTime()) / DAY_MS));
}

/** Nome do arquivo na entrega e no .zip: "final.mp4", "corte-02.mp4", "capa-02.jpg". */
export function exportFileName(kind: ExportKind, cutIndex: number | null, ext: "mp4" | "jpg"): string {
  if (kind === "final") return `final.${ext}`;
  const n = String(cutIndex ?? 0).padStart(2, "0");
  return `${kind === "cut" ? "corte" : "capa"}-${n}.${ext}`;
}
