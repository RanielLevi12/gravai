export type Range = { startSeconds: number; endSeconds: number };

/** Limite de segurança por arquivo entregue (o mesmo das gravações). */
export const MAX_FILE_BYTES = 500 * 1024 * 1024;
export const EXPORT_TTL_DAYS = 30;

/** Início e fim de cada bloco no vídeo final, pela duração real de cada gravação. */
export function blockRanges(durations: number[]): Range[] {
  let at = 0;
  return durations.map((d) => {
    const range = { startSeconds: at, endSeconds: at + d };
    at += d;
    return range;
  });
}

/** Corte = do início do bloco `start` ao fim do bloco `end` (posições a partir de 1). */
export function cutRange(ranges: Range[], cut: { start: number; end: number }): Range {
  const first = ranges[cut.start - 1];
  const last = ranges[cut.end - 1];
  if (!first || !last || cut.end < cut.start) throw new Error("Um corte aponta para blocos que não existem.");
  return { startSeconds: first.startSeconds, endSeconds: last.endSeconds };
}

/** Posições (a partir de 1) dos blocos que ainda não têm gravação. */
export function missingBlocks(blockIds: string[], recorded: Set<string>): number[] {
  return blockIds.flatMap((id, i) => (recorded.has(id) ? [] : [i + 1]));
}

export function expiresAt(from: Date): Date {
  return new Date(from.getTime() + EXPORT_TTL_DAYS * 86_400_000);
}
