import { AiError, type UserAi } from "@/lib/ai";
import { readAudioSeconds } from "@/lib/ai/audio";
import { IngestError } from "./text";

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const AUDIO_TOO_BIG = "Áudio acima de 25 MB. Envie um arquivo menor ou divida em partes.";
export const AUDIO_FORMAT = "Formato de áudio não suportado. Use MP3, M4A, WAV ou OGG.";

/** Valida tamanho e lê a duração do próprio arquivo, sem chamar a IA. */
export async function inspectAudio(file: File): Promise<{ seconds: number; buffer: Buffer }> {
  if (file.size > MAX_AUDIO_BYTES) throw new IngestError(AUDIO_TOO_BIG);
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    return { seconds: await readAudioSeconds(buffer, file.name), buffer };
  } catch (e) {
    if (e instanceof AiError && e.code === "invalid_input") throw new IngestError(AUDIO_FORMAT);
    throw e;
  }
}

export async function extractAudio(file: File, ai: UserAi, knownSeconds?: number): Promise<{ text: string; seconds: number }> {
  if (file.size > MAX_AUDIO_BYTES) throw new IngestError(AUDIO_TOO_BIG);
  let seconds = knownSeconds;
  let buffer: Buffer;
  if (seconds === undefined) ({ seconds, buffer } = await inspectAudio(file));
  else buffer = Buffer.from(await file.arrayBuffer());
  const { text } = await ai.transcribeAudio(buffer, file.name);
  if (text.trim().length < 1) throw new IngestError("Não encontrei fala neste áudio. Tente gravar de novo, mais perto do microfone.");
  return { text, seconds };
}
