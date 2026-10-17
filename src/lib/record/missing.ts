import { blockLabel } from "@/components/script/format";
import type { BlockKind } from "@/lib/script/generate";

export type LabeledBlock = { id: string; label: string };

/** Nome de cada bloco como o leigo vê: Abertura, Trecho 1, Trecho 2… */
export function labelBlocks(rows: { id: string; kind: string; cut_index: number | null }[]): LabeledBlock[] {
  let body = 0;
  return rows.map((b) => {
    if (b.kind === "body") body += 1;
    return { id: b.id, label: b.kind === "body" ? `Trecho ${body}` : blockLabel(b.kind as BlockKind, b.cut_index) };
  });
}

/** Blocos sem vídeo pronto, na ordem do script. */
export function missingBlocks<T extends { id: string }>(blocks: T[], recorded: Record<string, boolean> | Set<string>): T[] {
  const has = (id: string) => (recorded instanceof Set ? recorded.has(id) : recorded[id] === true);
  return blocks.filter((b) => !has(b.id));
}

/**
 * O próximo bloco que falta: o primeiro depois de `afterId` na ordem do script; se não sobrar nenhum
 * depois dele, o primeiro que falta desde o começo. Nada falta → null.
 */
export function nextMissing<T extends { id: string }>(blocks: T[], recorded: Record<string, boolean> | Set<string>, afterId?: string | null): T | null {
  const missing = missingBlocks(blocks, recorded);
  if (missing.length === 0) return null;
  const at = afterId ? blocks.findIndex((b) => b.id === afterId) : -1;
  if (at >= 0) {
    const later = missing.find((m) => blocks.findIndex((b) => b.id === m.id) > at);
    if (later) return later;
  }
  return missing[0];
}

/** "Trecho 2", "Trecho 2 e Trecho 3", "Abertura, Trecho 2 e Fechamento". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Quantas partes faltam, só para vídeo gravado por blocos (já tem algum bloco pronto); senão null. */
export function missingPartsCount(blockIds: string[], readyBlockIds: (string | null)[]): number | null {
  const done = new Set(readyBlockIds.filter((x): x is string => !!x));
  if (!blockIds.some((id) => done.has(id))) return null;
  return blockIds.filter((id) => !done.has(id)).length;
}
