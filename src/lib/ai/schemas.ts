import { z } from "zod";

/** Erro da camada de IA. `userMessage` é genérica e segura para mostrar ao usuário. */
export class AiError extends Error {
  userMessage: string;
  constructor(
    userMessage = "A IA não respondeu como esperado. Tente de novo.",
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "AiError";
    this.userMessage = userMessage;
  }
}

export type OcrImage = { data: Buffer; mediaType: string };
export type Transcription = { text: string; seconds: number };
export type ScriptCheck = { toneOk: number; ctaPresent: number | null };

export const transcriptionSchema = z.object({ text: z.string(), seconds: z.number() });
export const scriptCheckSchema = z.object({
  toneOk: z.number().min(0).max(1),
  ctaPresent: z.number().min(0).max(1).nullable(),
});

/** JSON Schema (sem a chave $schema) derivado do zod, para saída estruturada. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}
