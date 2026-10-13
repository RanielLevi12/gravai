import { AiError } from "./schemas";

export const AUDIO_UNREADABLE = "Não consegui transcrever o áudio. Tente de novo.";

export type AudioFormat = "wav" | "mp3" | "aiff" | "aac" | "ogg" | "flac" | "m4a";

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
export async function probeAudio(file: Buffer, filename: string): Promise<{ seconds: number; format: AudioFormat }> {
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
  throw new AiError(AUDIO_UNREADABLE, { code: "invalid_input" });
}

/** Duração em segundos, para checar a cota ANTES de transcrever. Lança AiError invalid_input. */
export async function readAudioSeconds(file: Buffer, filename: string): Promise<number> {
  return (await probeAudio(file, filename)).seconds;
}
