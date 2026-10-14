import type { BlockKind } from "@/lib/script/generate";

/** Segundos em m:ss (tempos usam algarismos tabulares na tela). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const KIND_LABELS: Record<Exclude<BlockKind, "cut">, string> = { opening: "Abertura", body: "Trecho", bridge: "Ligação", closing: "Fechamento" };

export function blockLabel(kind: BlockKind, cutIndex: number | null): string {
  return kind === "cut" ? `Corte ${cutIndex ?? ""}`.trim() : KIND_LABELS[kind];
}

/** Cor do corte na ordem fixa: tangerina, céu, menta, sol, e repete. */
export function cutVar(cutIndex: number): string {
  return `var(--cut-${((cutIndex - 1) % 4) + 1})`;
}
