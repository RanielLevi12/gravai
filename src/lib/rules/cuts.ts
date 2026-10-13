export const CUT_DURATIONS = [10, 20, 30, 60] as const;

export type Platform = "youtube" | "reels" | "feed_instagram" | "facebook" | "tiktok" | "x";

const VERTICAL_PLATFORMS: readonly Platform[] = ["reels", "tiktok", "feed_instagram"];

export function allowedCutDurations(mainSeconds: number): number[] {
  return CUT_DURATIONS.filter((d) => d <= mainSeconds / 2);
}

export function estimateCutCount(mainSeconds: number, cutSeconds: number): number {
  return Math.max(1, Math.floor((mainSeconds * 0.85) / cutSeconds));
}

export function suggestCutDuration(mainSeconds: number, platforms: Platform[]): number | null {
  const allowed = allowedCutDurations(mainSeconds);
  if (allowed.length === 0) return null;
  const wantsVertical = platforms.some((p) => VERTICAL_PLATFORMS.includes(p));
  if (wantsVertical && allowed.includes(30)) return 30;
  return allowed[allowed.length - 1];
}
