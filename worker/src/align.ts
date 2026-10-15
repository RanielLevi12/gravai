import type { Range } from "./plan";

/** Palavra falada, com início e fim em segundos. */
export type Word = { w: string; s: number; e: number };

const LEAD_PAD = 0.3;
const TAIL_PAD = 0.4;

/** Minúsculas, sem acento nem pontuação; "e-mail" vira dois tokens. */
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
 * Descobre onde cada bloco do script foi falado: alinha as palavras do script com as palavras da fala
 * (distância de edição por palavra, tolerando as que faltam, sobram ou foram trocadas).
 * `confidence` = parte das palavras do script que a fala repetiu igual (0 a 1).
 */
export function alignBlocks(blockTexts: string[], words: Word[]): { ranges: Range[]; confidence: number } {
  const script: { token: string; block: number }[] = blockTexts.flatMap((t, block) => tokens(t).map((token) => ({ token, block })));
  const spoken: { token: string; word: number }[] = words.flatMap((x, word) => tokens(x.w).map((token) => ({ token, word })));
  const n = script.length;
  const m = spoken.length;

  const cols = m + 1;
  const dist = new Int32Array((n + 1) * cols);
  for (let i = 0; i <= n; i++) dist[i * cols] = i;
  for (let j = 0; j <= m; j++) dist[j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dist[(i - 1) * cols + j - 1] + (script[i - 1].token === spoken[j - 1].token ? 0 : 1);
      dist[i * cols + j] = Math.min(sub, dist[(i - 1) * cols + j] + 1, dist[i * cols + j - 1] + 1);
    }
  }

  // Volta pelo caminho de menor custo ligando cada palavra do script à palavra falada correspondente.
  const first: number[] = blockTexts.map(() => Infinity);
  const last: number[] = blockTexts.map(() => -1);
  let exact = 0;
  for (let i = n, j = m; i > 0 && j > 0; ) {
    const same = script[i - 1].token === spoken[j - 1].token;
    const here = dist[i * cols + j];
    const up = here === dist[(i - 1) * cols + j] + 1;
    const left = here === dist[i * cols + j - 1] + 1;
    const diag = here === dist[(i - 1) * cols + j - 1] + (same ? 0 : 1);
    // Em empate, vale o par igual; uma troca só quando nenhum "faltou/sobrou" dá o mesmo custo.
    if (diag && (same || (!up && !left))) {
      const b = script[i - 1].block;
      const word = spoken[j - 1].word;
      first[b] = Math.min(first[b], word);
      last[b] = Math.max(last[b], word);
      if (same) exact++;
      i--;
      j--;
    } else if (up) i--;
    else j--;
  }

  const known = blockTexts.map((_, b) => last[b] >= 0);
  const spans = blockTexts.map((_, b) => (known[b] ? { s: words[first[b]].s, e: words[last[b]].e } : null));
  const ranges: Range[] = blockTexts.map(() => ({ startSeconds: 0, endSeconds: 0 }));

  // Blocos com fala: um respiro antes e depois, sem passar da metade do silêncio até o vizinho.
  let prevEnd = 0;
  const knownIdx = blockTexts.flatMap((_, b) => (known[b] ? [b] : []));
  for (const [k, b] of knownIdx.entries()) {
    const span = spans[b]!;
    const nextStart = k + 1 < knownIdx.length ? spans[knownIdx[k + 1]]!.s : Infinity;
    ranges[b] = {
      startSeconds: Math.max(0, span.s - Math.min(LEAD_PAD, (span.s - prevEnd) / 2)),
      endSeconds: span.e + Math.min(TAIL_PAD, (nextStart - span.e) / 2),
    };
    prevEnd = span.e;
  }

  // Blocos sem fala reconhecida dividem, em partes iguais, o espaço entre os vizinhos que têm.
  const total = words.length > 0 ? words[words.length - 1].e : 0;
  for (let b = 0; b < blockTexts.length; ) {
    if (known[b]) {
      b++;
      continue;
    }
    let end = b;
    while (end < blockTexts.length && !known[end]) end++;
    const from = b > 0 ? ranges[b - 1].endSeconds : 0;
    const to = end < blockTexts.length ? ranges[end].startSeconds : Math.max(from, total);
    const step = (to - from) / (end - b);
    for (let k = b; k < end; k++) ranges[k] = { startSeconds: from + step * (k - b), endSeconds: from + step * (k - b + 1) };
    b = end;
  }

  return { ranges, confidence: n === 0 ? 0 : exact / n };
}
