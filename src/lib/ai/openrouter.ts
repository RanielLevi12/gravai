import "server-only";
import OpenAI from "openai";
import type { ChatCompletionContentPart, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { AiError, type OcrImage, type Transcription } from "./schemas";

// Ids conferidos em https://openrouter.ai/api/v1/models (13/10/2026).
export const TEXT_MODEL = "openai/gpt-6-luna";
export const OCR_MODEL = "anthropic/claude-haiku-5.5";
export const AUDIO_MODEL = "google/gemini-3.8-flash";

const BASE_URL = "https://openrouter.ai/api/v1";
const MAX_OCR_CHARS = 60_000;
// O OpenRouter reserva crédito por max_tokens; um teto alto demais dá 402 em contas com pouco saldo.
const OCR_MAX_TOKENS = 16_000;
const AUDIO_MAX_TOKENS = 8_000;

const OCR_INSTRUCTION =
  "Transcreva fielmente o texto de cada página, na ordem, sem comentar nem explicar. " +
  "Se não houver texto legível, responda apenas com uma string vazia.";
const AUDIO_INSTRUCTION =
  "Transcreva fielmente, sem comentar, o que é falado neste áudio, no idioma original. " +
  "Responda só com a transcrição. Se não houver fala, responda com uma string vazia.";

const READ_FAIL = "Não consegui ler o arquivo. Tente de novo.";
const AUDIO_FAIL = "Não consegui transcrever o áudio. Tente de novo.";

/** Campos do OpenRouter que o SDK da OpenAI não tipa (vão no corpo como estão). */
type OpenRouterExtras = {
  provider?: { require_parameters?: boolean };
  plugins?: { id: string; pdf?: { engine: string } }[];
};
type Params = ChatCompletionCreateParamsNonStreaming & OpenRouterExtras;

type AudioFormat = "wav" | "mp3" | "aiff" | "aac" | "ogg" | "flac" | "m4a";

/** Formato aceito pelo `input_audio` a partir do contêiner detectado no arquivo. */
function audioFormat(container: string | undefined): AudioFormat | null {
  const c = (container ?? "").toLowerCase();
  if (c.includes("wave")) return "wav";
  if (c === "mpeg") return "mp3";
  if (c.includes("flac")) return "flac";
  if (c.includes("ogg")) return "ogg";
  if (c.includes("aiff")) return "aiff";
  if (c.includes("adts")) return "aac";
  if (c.includes("m4a") || c.includes("mp4") || c.includes("isom")) return "m4a";
  return null;
}

/** Duração (s) e formato lidos do próprio arquivo, nunca do modelo. */
async function probeAudio(file: Buffer, filename: string): Promise<{ seconds: number; format: AudioFormat }> {
  try {
    const { parseBuffer } = await import("music-metadata");
    const meta = await parseBuffer(new Uint8Array(file), { path: filename, size: file.length }, { duration: true });
    const seconds = meta.format.duration;
    const format = audioFormat(meta.format.container);
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 && format) return { seconds, format };
  } catch {
    // arquivo ilegível: cai no erro abaixo
  }
  // Arquivo ilegível, sem duração ou em formato que o input_audio não aceita (ex.: webm).
  throw new AiError(AUDIO_FAIL, { code: "invalid_input" });
}

export type OpenRouterAi = ReturnType<typeof createOpenRouterAi>;

/**
 * Funções de IA cobradas na conta OpenRouter do usuário (`apiKey` = chave obtida no OAuth).
 * `opts.fetch` só para testes.
 */
export function createOpenRouterAi(apiKey: string, opts: { fetch?: typeof fetch } = {}) {
  const client = new OpenAI({
    apiKey,
    baseURL: BASE_URL,
    defaultHeaders: { "X-Title": "Gravai" },
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });

  async function complete(params: Params, failMessage: string): Promise<{ text: string; truncated: boolean }> {
    try {
      const res = await client.chat.completions.create(params as ChatCompletionCreateParamsNonStreaming);
      const choice = res.choices[0];
      return { text: (choice?.message?.content ?? "").trim(), truncated: choice?.finish_reason === "length" };
    } catch (e) {
      if (e instanceof AiError) throw e;
      // Só status/tipo vão para o cause; a chave nunca entra na mensagem.
      throw new AiError(failMessage, { code: "provider", cause: e });
    }
  }

  async function ocr(parts: ChatCompletionContentPart[], extras: OpenRouterExtras = {}): Promise<string> {
    const { text, truncated } = await complete(
      {
        model: OCR_MODEL,
        max_tokens: OCR_MAX_TOKENS,
        messages: [{ role: "user", content: [...parts, { type: "text", text: OCR_INSTRUCTION }] }],
        ...extras,
      },
      READ_FAIL,
    );
    if (truncated) console.warn("[ai] OCR truncado por max_tokens");
    if (text.length > MAX_OCR_CHARS) {
      console.warn(`[ai] OCR acima de ${MAX_OCR_CHARS} caracteres; cortado`);
      return text.slice(0, MAX_OCR_CHARS);
    }
    return text;
  }

  return {
    /** Texto JSON bruto com saída estruturada strict (validação fica em index.ts). */
    async rawJson(jsonSchema: Record<string, unknown>, system: string, user: string): Promise<string> {
      const { text } = await complete(
        {
          model: TEXT_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_schema", json_schema: { name: "resposta", strict: true, schema: jsonSchema } },
          // só endpoints que respeitam response_format
          provider: { require_parameters: true },
        },
        "A IA não respondeu como esperado. Tente de novo.",
      );
      return text;
    },

    /** Imagens como partes image_url (data URL), na ordem recebida. */
    ocrImages(images: OcrImage[]): Promise<string> {
      return ocr(
        images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: `data:${img.mediaType};base64,${img.data.toString("base64")}` },
        })),
      );
    },

    /** PDF como parte `file` (data URL); motor nativo do modelo (sem cobrança extra de OCR). */
    ocrPdf(pdf: Buffer): Promise<string> {
      return ocr(
        [
          {
            type: "file",
            file: { filename: "documento.pdf", file_data: `data:application/pdf;base64,${pdf.toString("base64")}` },
          },
        ],
        { plugins: [{ id: "file-parser", pdf: { engine: "native" } }] },
      );
    },

    /** Áudio como parte input_audio; `seconds` vem do arquivo. */
    async transcribeAudio(file: Buffer, filename: string): Promise<Transcription> {
      const { seconds, format } = await probeAudio(file, filename);
      const { text } = await complete(
        {
          model: AUDIO_MODEL,
          max_tokens: AUDIO_MAX_TOKENS,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: AUDIO_INSTRUCTION },
                // o SDK só tipa wav/mp3; o OpenRouter aceita os demais formatos listados na doc
                { type: "input_audio", input_audio: { data: file.toString("base64"), format: format as "wav" } },
              ],
            },
          ],
        },
        AUDIO_FAIL,
      );
      return { text, seconds };
    },
  };
}
