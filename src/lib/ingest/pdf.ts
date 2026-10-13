import type { UserAi } from "@/lib/ai";
import { IngestError } from "./text";

const MIN_CHARS_PER_PAGE = 200;

/** PDF com texto → unpdf; escaneado (< 200 caracteres por página em média) → OCR do usuário. */
export async function extractPdf(file: File, ai: UserAi | undefined): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  let text = "";
  let pages = 1;
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(buf));
    const res = await extractText(doc, { mergePages: true });
    text = res.text;
    pages = Math.max(res.totalPages, 1);
  } catch {
    throw new IngestError("Não consegui abrir este PDF. Confira se ele não está corrompido ou protegido por senha.");
  }
  if (text.trim().length / pages >= MIN_CHARS_PER_PAGE) return text;
  if (!ai) throw new IngestError("Conecte sua conta de IA para ler PDFs escaneados.");
  return ai.ocrPdf(buf);
}
