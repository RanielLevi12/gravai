import "server-only";
import { z } from "zod";
import { AiError, toStrictJsonSchema, stripOptionalNulls, type OcrImage, type ScriptCheck, type Transcription } from "./schemas";

export { AiError } from "./schemas";
export type { OcrImage, ScriptCheck, Transcription } from "./schemas";

const useMock = () => {
  const mock = process.env.AI_MOCK === "1";
  if (mock && process.env.NODE_ENV === "production" && process.env.AI_MOCK_ALLOW_PROD !== "1") {
    throw new AiError("A IA está indisponível no momento. Tente mais tarde.");
  }
  return mock;
};

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
  const jsonSchema = toStrictJsonSchema(schema);
  const { $schema: _s, ...original } = z.toJSONSchema(schema) as Record<string, unknown>;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider.rawJson(jsonSchema, system, user);
    try {
      const parsed = schema.safeParse(stripOptionalNulls(JSON.parse(raw), original));
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
