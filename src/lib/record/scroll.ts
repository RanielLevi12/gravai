export const DEFAULT_SPEED_WPM = 140;
export const MIN_SPEED_WPM = 80;
export const MAX_SPEED_WPM = 260;

export function pxPerSecond(
  wordsPerMinute: number,
  wordsPerLine: number,
  lineHeightPx: number,
): number {
  return (wordsPerMinute / wordsPerLine / 60) * lineHeightPx;
}

export function stepSpeed(current: number, dir: -1 | 1): number {
  return Math.min(MAX_SPEED_WPM, Math.max(MIN_SPEED_WPM, current + dir * 10));
}
