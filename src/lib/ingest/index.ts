import type { UserAi } from "@/lib/ai";
import { extractAudio } from "./audio";
import { extractDocx } from "./docx";
import { extractGdocs } from "./gdocs";
import { extractImages } from "./image";
import { extractPdf } from "./pdf";
import { extractPptx } from "./pptx";
import { IngestError, clip, extractPlain, readTxt } from "./text";

export { IngestError, MAX_SOURCE_CHARS } from "./text";
export { AUDIO_TOO_BIG, MAX_AUDIO_BYTES, inspectAudio } from "./audio";
export { validateImages } from "./image";

export type SourceKind = "text" | "images" | "pdf" | "docx" | "pptx" | "txt" | "gdocs" | "audio";
export const SOURCE_KINDS: SourceKind[] = ["text", "images", "pdf", "docx", "pptx", "txt", "gdocs", "audio"];
/** Tipos que podem precisar da IA do usuário (OCR ou transcrição). */
export const AI_KINDS: SourceKind[] = ["images", "pdf", "audio"];

export type ExtractInput = { kind: SourceKind; files?: File[]; text?: string; url?: string; audioSeconds?: number };
export type Extracted = { text: string; truncated: boolean; audioSeconds?: number };

const EMPTY = "Não encontrei texto neste material.";

function firstFile(input: ExtractInput): File {
  const f = input.files?.[0];
  if (!f) throw new IngestError("Envie um arquivo.");
  return f;
}

/** Extrai o texto-fonte; `ai` é a IA do usuário (necessária para fotos, PDF escaneado e áudio). */
export async function extractText(input: ExtractInput, ai?: UserAi): Promise<Extracted> {
  let raw: string;
  let audioSeconds: number | undefined;
  switch (input.kind) {
    case "text":
      raw = extractPlain(input.text);
      break;
    case "txt":
      raw = await readTxt(firstFile(input));
      break;
    case "docx":
      raw = await extractDocx(firstFile(input));
      break;
    case "pptx":
      raw = await extractPptx(firstFile(input));
      break;
    case "pdf":
      raw = await extractPdf(firstFile(input), ai);
      break;
    case "gdocs":
      raw = await extractGdocs(input.url);
      break;
    case "images":
      if (!ai) throw new IngestError("Conecte sua conta de IA para ler fotos.");
      raw = await extractImages(input.files ?? [], ai);
      break;
    case "audio": {
      if (!ai) throw new IngestError("Conecte sua conta de IA para transcrever áudio.");
      const r = await extractAudio(firstFile(input), ai, input.audioSeconds);
      raw = r.text;
      audioSeconds = r.seconds;
      break;
    }
    default:
      throw new IngestError("Tipo de material não suportado.");
  }
  const { text, truncated } = clip(raw);
  if (!text) throw new IngestError(EMPTY);
  return { text, truncated, ...(audioSeconds !== undefined ? { audioSeconds } : {}) };
}
