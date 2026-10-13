import "server-only";
import type { z } from "zod";
import { AiError, toJsonSchema, type OcrImage, type ScriptCheck, type Transcription } from "./schemas";

export { AiError } from "./schemas";
export type { OcrImage, ScriptCheck, Transcription } from "./schemas";

const useMock = () => process.env.AI_MOCK === "1";

export async function ocrImages(images: OcrImage[]): Promise<string> {
  return useMock() ? (await import("./mock")).ocrImages(images) : (await import("./anthropic")).ocrImages(images);
}

export async function ocrPdf(pdf: Buffer): Promise<string> {
  return useMock() ? (await import("./mock")).ocrPdf(pdf) : (await import("./anthropic")).ocrPdf(pdf);
}

export async function transcribeAudio(file: Buffer, filename: string): Promise<Transcription> {
  return useMock()
    ? (await import("./mock")).transcribeAudio(file, filename)
    : (await import("./openai")).transcribeAudio(file, filename);
}

/** Saída estruturada validada por zod; uma nova tentativa se falhar; depois AiError. */
export async function generateJson<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T> {
  const provider = useMock() ? await import("./mock") : await import("./openai");
  const jsonSchema = toJsonSchema(schema);
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider.rawJson(jsonSchema, system, user);
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // JSON inválido: tenta de novo
    }
  }
  throw new AiError();
}

export async function scoreViral(titles: string[], context: string): Promise<number[]> {
  return useMock()
    ? (await import("./mock")).scoreViral(titles, context)
    : (await import("./typesafe")).scoreViral(titles, context);
}

export async function checkScript(text: string, opts: { tone: string; cta?: string }): Promise<ScriptCheck> {
  return useMock()
    ? (await import("./mock")).checkScript(text, opts)
    : (await import("./typesafe")).checkScript(text, opts);
}
