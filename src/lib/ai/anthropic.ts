import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AiError, type OcrImage } from "./schemas";

export const OCR_MODEL = "claude-haiku-5-5";
const MAX_OCR_CHARS = 60_000;

const INSTRUCTION =
  "Transcreva fielmente o texto de cada página, na ordem, sem comentar nem explicar. " +
  "Se não houver texto legível, responda apenas com uma string vazia.";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError("A leitura de arquivos não está configurada. Tente mais tarde.");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function run(content: Anthropic.ContentBlockParam[]): Promise<string> {
  try {
    const res = await getClient().messages.create({
      model: OCR_MODEL,
      max_tokens: 32000,
      messages: [{ role: "user", content }],
    });
    let text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (res.stop_reason === "max_tokens") {
      console.warn("[ai] OCR truncado por max_tokens");
    }
    if (text.length > MAX_OCR_CHARS) {
      console.warn(`[ai] OCR acima de ${MAX_OCR_CHARS} caracteres; cortado`);
      text = text.slice(0, MAX_OCR_CHARS);
    }
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError("Não consegui ler o arquivo. Tente de novo.", { cause: e });
  }
}

export function ocrImages(images: OcrImage[]): Promise<string> {
  const blocks: Anthropic.ContentBlockParam[] = images.map((img) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: img.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: img.data.toString("base64"),
    },
  }));
  return run([...blocks, { type: "text", text: INSTRUCTION }]);
}

export function ocrPdf(pdf: Buffer): Promise<string> {
  return run([
    {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
    },
    { type: "text", text: INSTRUCTION },
  ]);
}
