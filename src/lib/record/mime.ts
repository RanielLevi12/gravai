const CANDIDATES = [
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
