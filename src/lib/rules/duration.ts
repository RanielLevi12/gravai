export const WORDS_PER_MINUTE = 150;
export const MAIN_DURATIONS = [30, 60, 180, 300, 600] as const;

/** Duração mínima que fica sempre habilitada, para o usuário nunca ficar sem opção. */
const MIN_ENABLED_SECONDS = 30;

export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => token.length > 0).length;
}

export function estimateSeconds(text: string): number {
  return Math.round((countWords(text) / WORDS_PER_MINUTE) * 60);
}

export function targetWords(seconds: number): number {
  return Math.round((seconds * WORDS_PER_MINUTE) / 60);
}

export function maxMainSecondsForSource(sourceText: string): number {
  return estimateSeconds(sourceText) * 2;
}

export type MainDurationOption = {
  seconds: number;
  enabled: boolean;
  reason?: string;
};

export function mainDurationOptions(sourceText: string): MainDurationOption[] {
  const maxSeconds = maxMainSecondsForSource(sourceText);
  const reason = `Seu texto rende até ~${Math.round(maxSeconds / 60)} min`;
  return MAIN_DURATIONS.map((seconds) => {
    if (seconds <= maxSeconds || seconds === MIN_ENABLED_SECONDS) {
      return { seconds, enabled: true };
    }
    return { seconds, enabled: false, reason };
  });
}
