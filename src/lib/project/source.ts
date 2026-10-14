import { MAX_SOURCE_CHARS } from "@/lib/ingest/text";
import { countWords, maxMainSecondsForSource } from "@/lib/rules/duration";

/** Mesmo teto de texto colado aceito por POST /api/projects (que depois corta em MAX_SOURCE_CHARS). */
export const MAX_PASTE_CHARS = 500_000;

/** Teto do texto-fonte salvo: o mesmo corte da ingestão (60 mil caracteres). */
export { MAX_SOURCE_CHARS };

export type UploadKind = "images" | "pdf" | "docx" | "pptx" | "txt" | "audio";

const EXT_KIND: Record<string, UploadKind> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
  txt: "txt",
  jpg: "images",
  jpeg: "images",
  png: "images",
  webp: "images",
  heic: "images",
  heif: "images",
  mp3: "audio",
  m4a: "audio",
  mp4: "audio",
  wav: "audio",
  ogg: "audio",
  oga: "audio",
  opus: "audio",
};

/** Tipo de material de um arquivo, pela extensão e, na falta dela, pelo MIME. */
export function kindForFile(file: { name: string; type: string }): UploadKind | null {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  if (ext && EXT_KIND[ext]) return EXT_KIND[ext];
  if (file.type.startsWith("image/")) return "images";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

/** Vários arquivos só valem se forem todos imagens (páginas); senão, um por vez. */
export function kindForFiles(files: { name: string; type: string }[]): UploadKind | "misto" | null {
  if (files.length === 0) return null;
  const kinds = files.map(kindForFile);
  if (kinds.some((k) => k === null)) return null;
  if (files.length === 1) return kinds[0];
  return kinds.every((k) => k === "images") ? "images" : "misto";
}

/** Nome seguro para a chave do Storage: ASCII, sem barras, até 120 caracteres. */
export function safeFileName(name: string): string {
  const ascii = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+/, "");
  const dot = ascii.lastIndexOf(".");
  const ext = dot > 0 ? ascii.slice(dot).slice(0, 10) : "";
  const base = (dot > 0 ? ascii.slice(0, dot) : ascii).slice(0, 120 - ext.length) || "arquivo";
  return `${base}${ext}`;
}

export function formatWords(text: string): string {
  const n = countWords(text);
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "palavra" : "palavras"}`;
}

/** "dá até ~X min de vídeo", pela regra de `maxMainSecondsForSource`. */
export function formatMaxVideo(text: string): string {
  const s = maxMainSecondsForSource(text);
  return s < 60 ? `dá até ~${s} s de vídeo` : `dá até ~${Math.round(s / 60)} min de vídeo`;
}
