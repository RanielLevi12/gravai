/** Avisos do jev sobre o script e os cortes: gancho fraco e trecho que recomeça o vídeo. */
import type { ExcerptReview } from "@/lib/ai/schemas";

export const HOOK_WEAK_BELOW = 0.5;
export const RESTART_AT_LEAST = 0.6;

export type ReviewFn = (texts: string[], opts: { restart: boolean }) => Promise<ExcerptReview>;

/** "abertura" ou "trecho 2" (a abertura não conta: o primeiro trecho do meio é o 1). */
function nameOf(kind: string, n: number): string {
  return kind === "opening" ? "abertura" : `trecho ${n}`;
}

const DE = (name: string) => (name === "abertura" ? "da abertura" : `do ${name}`);
const upper = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

function join(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/** `blocks` = abertura e trechos do meio, na ordem do script (sem o fechamento). */
export function scriptReviewWarnings(blocks: { kind: string }[], r: ExcerptReview): string[] {
  let body = 0;
  const names = blocks.map((b) => nameOf(b.kind, b.kind === "opening" ? 0 : ++body));
  const out: string[] = [];
  const weak = names.filter((_, i) => r.hook[i] < HOOK_WEAK_BELOW);
  if (weak.length > 0) out.push(`O gancho ${join(weak.map(DE))} está fraco: começa sem prender quem assiste.`);
  const again = names.filter((_, i) => (r.restart?.[i] ?? 0) >= RESTART_AT_LEAST);
  if (again.length > 0) out.push(`${upper(join(again.map((n) => (n === "abertura" ? "a abertura" : `o ${n}`))))} parece${again.length > 1 ? "m" : ""} recomeçar o vídeo (nova saudação ou apresentação). Vale tirar.`);
  return out;
}

export function cutReviewWarnings(hook: number[]): string[] {
  const weak = hook.flatMap((h, i) => (h < HOOK_WEAK_BELOW ? [`do corte ${i + 1}`] : []));
  return weak.length > 0 ? [`O gancho ${join(weak)} está fraco: pode não segurar quem vê o corte sozinho.`] : [];
}
