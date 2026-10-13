import "server-only";
import { z } from "zod";
import { AiError, toStrictJsonSchema, stripOptionalNulls, type OcrImage, type ScriptCheck, type Transcription } from "./schemas";

export { AiError } from "./schemas";
export type { AiErrorCode, OcrImage, ScriptCheck, Transcription } from "./schemas";

const useMock = () => {
  const mock = process.env.AI_MOCK === "1";
  if (mock && process.env.NODE_ENV === "production" && process.env.AI_MOCK_ALLOW_PROD !== "1") {
    throw new AiError("A IA está indisponível no momento. Tente mais tarde.");
  }
  return mock;
};

const RETRY_DEADLINE_MS = 100_000;

type RawJson = (jsonSchema: Record<string, unknown>, system: string, user: string) => Promise<string>;

/** Saída estruturada validada por zod; uma nova tentativa se falhar; depois AiError. */
async function generateJsonWith<T>(rawJson: RawJson, schema: z.ZodType<T>, system: string, user: string): Promise<T> {
  const jsonSchema = toStrictJsonSchema(schema);
  const { $schema: _s, ...original } = z.toJSONSchema(schema) as Record<string, unknown>;
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    // Sem folga para uma segunda chamada dentro do `maxDuration`: desiste em vez de a função ser morta.
    if (attempt > 0 && Date.now() - startedAt > RETRY_DEADLINE_MS) break;
    const raw = await rawJson(jsonSchema, system, user);
    try {
      const parsed = schema.safeParse(stripOptionalNulls(JSON.parse(raw), original));
      if (parsed.success) return parsed.data;
    } catch {
      // JSON inválido: tenta de novo
    }
  }
  throw new AiError(undefined, { code: "invalid_output" });
}

export type UserAi = {
  ocrImages(images: OcrImage[]): Promise<string>;
  ocrPdf(pdf: Buffer): Promise<string>;
  transcribeAudio(file: Buffer, filename: string): Promise<Transcription>;
  generateJson<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T>;
};

/**
 * IA cobrada na conta OpenRouter do usuário. Sem conexão → AiError code 'not_connected'.
 * Com AI_MOCK=1 devolve o mock sem exigir conexão.
 */
export async function withUserAi(userId: string): Promise<UserAi> {
  const provider = useMock()
    ? await import("./mock")
    : await (async () => {
        const key = await (await import("./keys")).getUserAiKey(userId);
        if (!key) throw new AiError("Conecte sua conta de IA para continuar.", { code: "not_connected" });
        return (await import("./openrouter")).createOpenRouterAi(key);
      })();
  return userAiFrom(provider);
}

type Provider = Omit<UserAi, "generateJson"> & { rawJson: RawJson };

/** Liga um provedor (mock ou OpenRouter) ao pipeline de generateJson. Uso interno e no smoke. */
export function userAiFrom(provider: Provider): UserAi {
  return {
    ocrImages: (images) => provider.ocrImages(images),
    ocrPdf: (pdf) => provider.ocrPdf(pdf),
    transcribeAudio: (file, filename) => provider.transcribeAudio(file, filename),
    generateJson: (schema, system, user) => generateJsonWith(provider.rawJson, schema, system, user),
  };
}

/** Julgamentos globais (jev, chave do Gravaí). */
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
