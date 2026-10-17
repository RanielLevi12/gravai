/** Limite de cada gravação (bucket `recordings`, plano Pro do Supabase). */
export const MAX_FILE_BYTES = 524_288_000;
export const VIDEO_BPS = 4_000_000;
export const AUDIO_BPS = 128_000;
export const MAX_TAKE_SECONDS = 200;
export const WARN_TAKE_SECONDS = 180;

export const MSG_FILE_TOO_BIG =
  "Este vídeo passa de 500 MB. Grave por blocos no app ou reduza o tamanho antes de enviar.";

export const STORAGE_LIMIT_BYTES = 5 * 1024 ** 3;
export const MSG_STORAGE_FULL = "Você usou os 5 GB de espaço. Apague vídeos que não precisa mais para enviar novos.";

export function fitsBucket(sizeBytes: number): boolean {
  return sizeBytes <= MAX_FILE_BYTES;
}

export function estimatedBytes(seconds: number, videoBps = VIDEO_BPS, audioBps = AUDIO_BPS): number {
  return (seconds * (videoBps + audioBps)) / 8;
}

/** Segundos que cabem em 500 MB (com 5% de folga) nesse bitrate, nunca acima do limite de sempre. */
export function maxSecondsFor(videoBps: number, audioBps = AUDIO_BPS): number {
  return Math.min(MAX_TAKE_SECONDS, Math.floor((MAX_FILE_BYTES * 0.95) / ((videoBps + audioBps) / 8)));
}
