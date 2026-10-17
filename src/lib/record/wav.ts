/** Áudio só da voz, pequeno o bastante para o limite de 4,5 MB das funções da Vercel. */
export const MAX_SPEECH_BYTES = Math.floor(4.2 * 1024 * 1024);
const MAX_RATE = 16_000;
const MIN_RATE = 8_000;

/** Maior taxa (Hz, entre 8 e 16 mil) em que `seconds` de áudio mono de 16 bits cabe em `maxBytes`. */
export function pickSampleRate(seconds: number, maxBytes = MAX_SPEECH_BYTES): number {
  const fit = Math.floor((maxBytes - 44) / (2 * Math.max(1, seconds)));
  return Math.max(MIN_RATE, Math.min(MAX_RATE, fit));
}

/** WAV PCM de 16 bits, mono. */
export function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(out.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true));
  return out;
}

/** No navegador: tira só o áudio do vídeo gravado, em mono e baixa taxa, como WAV. Lança se o aparelho não decodificar. */
export async function extractSpeechWav(video: Blob): Promise<Blob> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("sem AudioContext");
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await video.arrayBuffer());
    const rate = pickSampleRate(decoded.duration);
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return new Blob([encodeWav(rendered.getChannelData(0), rate) as BlobPart], { type: "audio/wav" });
  } finally {
    void ctx.close().catch(() => {});
  }
}
