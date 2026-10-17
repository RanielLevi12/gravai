/** Detector simples de "cara de IA" em pt-BR. Puro. Limiares são palpites: calibrar com roteiros bons. */

export type SlopHit = { rule: string; text: string };

/** Padrões escritos SEM acento: o texto é comparado sem acento (\b do JS só entende letras sem acento). */
const PATTERNS: [string, RegExp][] = [
  ["abertura", /\bvoce sabia que\b|\bneste video\b|\bhoje (vamos|eu vou) (falar|te mostrar|mostrar)\b|\b(imagine|imagina) (que|so|ter)\b|\bse voce chegou (ate )?aqui\b|\bno mundo de hoje\b|\bnos dias (de )?hoje\b|\bnos dias atuais\b|\bhoje em dia\b|\bsem mais (delongas|enrolacao)\b|\bvamos la\b|\bantes de mais nada\b|\bfica ate o final\b/i],
  ["segredo", /\bo segredo que ninguem (te )?conta\b|\bninguem te conta\b/i],
  ["palavra de IA", /\bmergulh(ar|e|emos|o)\b|\bjornada\b|\bcrucial\b|\binsights?\b|\bdesbloque(ar|ie|ando)\b|\bpotencializ(ar|e|a)\b|\balavanc(ar|e|a)\b|\bholistic[oa]\b|\bsinergia\b|\bparadigma\b|\bdisruptiv[oa]\b|\brevolucion(ar|ario|aria)\b|\bgame.?changer\b|\bnext level\b/i],
  ["conector", /\be (importante|fundamental) (ressaltar|notar|destacar|entender|lembrar) que\b|\bvale (ressaltar|destacar|lembrar|notar|mencionar) que\b|\b(alem disso|ademais|outrossim|adicionalmente)\b|\bdito isso\b|\bcom isso em mente\b|\bneste? sentido\b|\bem (suma|resumo|conclusao)\b|\bno fim das contas\b|\bquando se trata de\b|\bcomo todos sabemos\b/i],
  ["estrutura", /\bnao e (apenas|so|somente|simplesmente) .{1,60}[,;] (mas|e)\b|\bnao se trata de .{1,60} mas (de|sim)\b|\bisso muda tudo\b|\be ai que mora\b|\be (o|a) (resultado|segredo|verdade)\?/i],
  ["vaga", /\b(especialistas|estudos|pesquisas) (dizem|mostram|apontam|afirmam)\b|\b(a verdade|a realidade) e que\b|\bvou ser sincero\b|\bvoce merece\b|\bacredite em voce\b/i],
  ["fecho", /\be isso,? (pessoal|galera|gente)\b|\bcurta,? (compartilhe|comente)\b|\bse inscreve no canal\b|\bdeixa o like\b/i],
  ["travessão", /—|–/],
  ["markdown", /\*\*|^#{1,6}\s/m],
];

const stripAccents = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "");

/** Trechos proibidos encontrados. Lista vazia = limpo. */
export function findSlop(text: string): SlopHit[] {
  // NFC primeiro: cada letra acentuada vira um caractere só, e o texto sem acento mantém o mesmo tamanho.
  const original = text.normalize("NFC");
  const plain = stripAccents(original);
  const hits: SlopHit[] = [];
  for (const [rule, re] of PATTERNS) {
    const g = new RegExp(re.source, `${re.flags.replace("g", "")}g`);
    for (const m of plain.matchAll(g)) hits.push({ rule, text: original.slice(m.index, m.index + m[0].length) });
  }
  return hits;
}

export function hasSlop(text: string): boolean {
  return findSlop(text).length > 0;
}

/** Frase curta para pedir à IA que refaça: "evite: 'mergulhar', 'jornada'". */
export function slopProblem(hits: SlopHit[]): string {
  return [...new Set(hits.map((h) => `"${h.text.trim()}"`))].slice(0, 6).join(", ");
}

/** Pontos por 100 palavras (frase proibida = 3, travessão/markdown = 2, o resto = 3). Mais de 3 reprova. */
export function slopScore(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  const points = findSlop(text).reduce((s, h) => s + (h.rule === "travessão" || h.rule === "markdown" ? 2 : 3), 0);
  return Math.round((points / words) * 1000) / 10;
}
