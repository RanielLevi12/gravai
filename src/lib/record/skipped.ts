export type SpokenWord = { w: string; s: number; e: number };
export type SkippedBlock = { id: string; label: string; coverage: number };

/** Abaixo disso, a fala quase não repetiu o bloco. */
export const SKIP_THRESHOLD = 0.5;
/** Fala curta demais para julgar alguma coisa. */
const MIN_SPOKEN_WORDS = 5;

/** Minúsculas, sem acento nem pontuação (mesma regra de worker/src/align.ts). */
function tokens(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Parte (0 a 1) das palavras de cada bloco que a fala repetiu, alinhando script e fala por distância de edição
 * (a mesma ideia de `alignBlocks` em worker/src/align.ts, que o worker mantém em separado).
 */
export function blockCoverage(blockTexts: string[], words: SpokenWord[]): number[] {
  const script = blockTexts.flatMap((t, block) => tokens(t).map((token) => ({ token, block })));
  const spoken = words.flatMap((x) => tokens(x.w));
  const n = script.length;
  const m = spoken.length;
  const cols = m + 1;
  const dist = new Int32Array((n + 1) * cols);
  for (let i = 0; i <= n; i++) dist[i * cols] = i;
  for (let j = 0; j <= m; j++) dist[j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dist[(i - 1) * cols + j - 1] + (script[i - 1].token === spoken[j - 1] ? 0 : 1);
      dist[i * cols + j] = Math.min(sub, dist[(i - 1) * cols + j] + 1, dist[i * cols + j - 1] + 1);
    }
  }

  const exact = blockTexts.map(() => 0);
  for (let i = n, j = m; i > 0 && j > 0; ) {
    const same = script[i - 1].token === spoken[j - 1];
    const here = dist[i * cols + j];
    const up = here === dist[(i - 1) * cols + j] + 1;
    const left = here === dist[i * cols + j - 1] + 1;
    const diag = here === dist[(i - 1) * cols + j - 1] + (same ? 0 : 1);
    if (diag && (same || (!up && !left))) {
      if (same) exact[script[i - 1].block]++;
      i--;
      j--;
    } else if (up) i--;
    else j--;
  }

  const total = blockTexts.map((t) => tokens(t).length);
  return total.map((t, b) => (t === 0 ? 1 : exact[b] / t));
}

/**
 * Blocos que a pessoa provavelmente pulou no take único. Só avisa quando dá para confiar:
 * fala curta, ou nenhum bloco batendo (outro assunto ou transcrição ruim), não viram "pulou tudo".
 */
export function findSkipped(blocks: { id: string; label: string; text: string }[], words: SpokenWord[], threshold = SKIP_THRESHOLD): SkippedBlock[] {
  if (blocks.length === 0 || words.length < MIN_SPOKEN_WORDS) return [];
  const coverage = blockCoverage(blocks.map((b) => b.text), words);
  const low = blocks.flatMap((b, i) => (coverage[i] < threshold ? [{ id: b.id, label: b.label, coverage: coverage[i] }] : []));
  return low.length === blocks.length ? [] : low;
}

/** "Parece que você pulou o Trecho 2." / "Parece que você pulou Trecho 2 e Trecho 3." */
export function skippedMessage(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `Parece que você pulou o ${names[0]}.`;
  const head = names.slice(0, -1).join(", ");
  return `Parece que você pulou ${head} e ${names[names.length - 1]}.`;
}
