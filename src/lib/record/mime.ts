// Do melhor para o mais simples: MP4 com H.264 (o aparelho codifica em hardware), depois WebM.
const CANDIDATES = [
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm",
] as const;

export function pickMimeType(isSupported: (t: string) => boolean): string | null {
  return CANDIDATES.find((t) => isSupported(t)) ?? null;
}

export function extensionFor(mime: string): "mp4" | "webm" {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

/** "H.264" / "VP9" / "VP8" a partir do tipo usado na gravação (para a Info técnica). */
export function codecLabel(mime: string | null): string {
  if (!mime) return "—";
  const m = mime.toLowerCase();
  if (m.includes("avc1") || (m.startsWith("video/mp4"))) return "H.264";
  if (m.includes("vp9")) return "VP9";
  if (m.includes("av01")) return "AV1";
  return "VP8";
}
