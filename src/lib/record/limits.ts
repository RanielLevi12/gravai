/** Limite de cada gravação (bucket `recordings`, plano Pro do Supabase). */
export const MAX_FILE_BYTES = 524_288_000;
export const VIDEO_BPS = 1_800_000;
export const AUDIO_BPS = 96_000;
export const MAX_TAKE_SECONDS = 200;
export const WARN_TAKE_SECONDS = 180;

export const MSG_FILE_TOO_BIG =
  "Este vídeo passa de 500 MB. Grave por blocos no app ou reduza o tamanho antes de enviar.";

export function fitsBucket(sizeBytes: number): boolean {
  return sizeBytes <= MAX_FILE_BYTES;
}

export function estimatedBytes(seconds: number): number {
  return (seconds * (VIDEO_BPS + AUDIO_BPS)) / 8;
}
