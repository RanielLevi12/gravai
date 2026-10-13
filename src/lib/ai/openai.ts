import "server-only";
import OpenAI, { toFile } from "openai";
import { AiError, type Transcription } from "./schemas";

export const TEXT_MODEL = "gpt-6-luna";
// whisper-1 é o modelo com timestamps por palavra (doc: developers.openai.com/api/docs/guides/transcription)
const DEFAULT_TRANSCRIBE_MODEL = "whisper-1";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new AiError("A IA não está configurada. Tente mais tarde.");
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/** Uma chamada com saída estruturada. Devolve o texto JSON bruto (validação fica em index.ts). */
export async function rawJson(
  jsonSchema: Record<string, unknown>,
  system: string,
  user: string,
): Promise<string> {
  try {
    const res = await getClient().chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "resposta", strict: true, schema: jsonSchema },
      },
    });
    return res.choices[0]?.message?.content ?? "";
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(undefined, { cause: e });
  }
}

export async function transcribeAudio(file: Buffer, filename: string): Promise<Transcription> {
  try {
    const model = process.env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL;
    const res = (await getClient().audio.transcriptions.create({
      file: await toFile(file, filename),
      model,
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    })) as unknown as { text: string; duration?: number };
    return { text: res.text, seconds: res.duration ?? 0 };
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError("Não consegui transcrever o áudio. Tente de novo.", { cause: e });
  }
}
