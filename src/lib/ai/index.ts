import "server-only";
import { z } from "zod";
import { AiError, toStrictJsonSchema, stripOptionalNulls, type ExcerptReview, type OcrImage, type ScriptCheck, type Transcription, type WordTranscription } from "./schemas";

export { AiError } from "./schemas";
export type { AiErrorCode, OcrImage, ScriptCheck, Transcription, WordTranscription } from "./schemas";

const useMock = () => {
  const mock = process.env.AI_MOCK === "1";
  if (mock && process.env.NODE_ENV === "production" && process.env.AI_MOCK_ALLOW_PROD !== "1") {
    throw new AiError("A IA está indisponível no momento. Tente mais tarde.");
  }
  return mock;
};

export const MOCK_COST_USD = 0.0123;
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
  transcribeWords(file: Buffer, filename: string): Promise<WordTranscription>;
  generateJson<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T>;
};

/**
 * Qual conta paga a IA: a do próprio usuário (OAuth ou chave colada) quando conectada; senão a do Gravaí
 * (OPENROUTER_API_KEY), com limite mensal por usuário. Sem nenhuma das duas → AiError 'not_connected'.
 * Com AI_MOCK=1 devolve o mock sem exigir conexão; em `next dev`, OPENROUTER_DEV_KEY vale como conexão.
 */
export async function withUserAi(userId: string): Promise<UserAi> {
  const provider = useMock()
    ? await (async () => {
        // Teste de ponta a ponta da barra de custos: cada chamada do mock "custa" um valor fixo.
        const mock = await import("./mock");
        const { recordAiUsage } = await import("./usage");
        return {
          ...mock,
          rawJson: async (...args: Parameters<typeof mock.rawJson>) => {
            const out = await mock.rawJson(...args);
            await recordAiUsage(userId, { kind: "text", model: "mock", costUsd: MOCK_COST_USD });
            return out;
          },
        };
      })()
    : await (async () => {
        // Só em `next dev`: a chave do dono dispensa o OAuth nos testes locais. Em produção é ignorada.
        let key = (process.env.NODE_ENV === "development" && process.env.OPENROUTER_DEV_KEY) || (await (await import("./keys")).getUserAiKey(userId));
        let billedTo: "user" | "app" = "user";
        if (!key) {
          // Padrão: a chave do servidor. Só o nome da variável é citado aqui; o valor nunca é lido fora desta chamada.
          key = process.env.OPENROUTER_API_KEY || null;
          if (!key) throw new AiError("Conecte sua conta de IA para continuar.", { code: "not_connected" });
          await (await import("./limit")).assertUnderLimit(userId);
          billedTo = "app";
        }
        const { recordAiUsage } = await import("./usage");
        return (await import("./openrouter")).createOpenRouterAi(key, { onUsage: (u) => void recordAiUsage(userId, { ...u, billedTo }) });
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
    transcribeWords: (file, filename) => provider.transcribeWords(file, filename),
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

export async function reviewExcerpts(texts: string[], opts: { restart: boolean }): Promise<ExcerptReview> {
  return useMock()
    ? (await import("./mock")).reviewExcerpts(texts, opts)
    : (await import("./typesafe")).reviewExcerpts(texts, opts);
}

/** Nota (0..1) do fecho (conclusão + CTA) de cada opção. */
export async function scoreClosing(texts: string[], context: string): Promise<number[]> {
  return useMock()
    ? (await import("./mock")).scoreClosing(texts, context)
    : (await import("./typesafe")).scoreClosing(texts, context);
}

/** Nota (0..1) do gancho de cada texto (o jev). */
export async function scoreHooks(texts: string[]): Promise<number[]> {
  return (await reviewExcerpts(texts, { restart: false })).hook;
}
