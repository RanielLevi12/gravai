/**
 * Roda um agente de "3 opções de tipos diferentes": gera, corta o que tem vício de IA, pede nota ao jev,
 * refaz UMA vez o que veio fraco e marca a melhor. Puro: a IA e a nota entram por função.
 */
import { AiError } from "../schemas";
import { findSlop, slopProblem } from "./slop";

/** Nota (0..1) abaixo da qual a opção é refeita. */
export const WEAK_BELOW = 0.5;
export const OPTION_COUNT = 3;

export type Option = { type: string; text: string };
export type Scored<T extends Option> = T & { score: number; best: boolean };

export type PickSpec<T extends Option> = {
  /** Tipos aceitos; a IA escolhe os que combinam e não repete nenhum. */
  types: readonly string[];
  /** Pede opções à IA. `redo` = tipos a refazer e o motivo. */
  generate: (req: { redo?: { types: string[]; problem: string } }) => Promise<T[]>;
  /** Notas do jev (0..1), na ordem dos textos. */
  score: (texts: string[]) => Promise<number[]>;
};

const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/** Só tipos válidos, sem repetir tipo nem texto, no máximo `OPTION_COUNT`. */
function distinct<T extends Option>(raw: T[], types: readonly string[], keep: Set<string> = new Set()): T[] {
  const seenType = new Set(keep);
  const seenText = new Set<string>();
  const out: T[] = [];
  for (const o of raw) {
    const text = o.text?.trim();
    if (!text || !types.includes(o.type) || seenType.has(o.type) || seenText.has(text.toLowerCase())) continue;
    seenType.add(o.type);
    seenText.add(text.toLowerCase());
    out.push({ ...o, text });
    if (out.length + keep.size >= OPTION_COUNT) break;
  }
  return out;
}

export async function pickBest<T extends Option>(spec: PickSpec<T>): Promise<Scored<T>[]> {
  const first = distinct(await spec.generate({}), spec.types);
  if (first.length === 0) throw new AiError(undefined, { code: "invalid_output" });

  const scoreAll = async (opts: T[]) => {
    const s = await spec.score(opts.map((o) => o.text));
    return opts.map((o, i) => ({ ...o, score: clamp(s[i]), slop: findSlop(o.text) }));
  };
  let scored = await scoreAll(first);

  // Uma segunda rodada, só para o que ficou fraco ou com vício de IA.
  const weak = scored.filter((o) => o.score < WEAK_BELOW || o.slop.length > 0);
  if (weak.length > 0) {
    try {
      const problem = weak
        .map((o) => (o.slop.length > 0 ? `${o.type}: evite ${slopProblem(o.slop)}` : `${o.type}: ficou genérica, deixe mais específica e concreta`))
        .join("; ");
      const redo = { types: weak.map((o) => o.type), problem };
      const keepTypes = new Set(scored.filter((o) => !weak.includes(o)).map((o) => o.type));
      const again = distinct(await spec.generate({ redo }), spec.types, keepTypes);
      const rescored = await scoreAll(again);
      // Troca cada opção fraca por uma nova do mesmo tipo (ou de tipo livre) só se for melhor (ou se a antiga tinha vício) e sem vício.
      const pool = rescored.filter((o) => o.slop.length === 0);
      for (const w of weak) {
        const candidate = pool.filter((o) => w.slop.length > 0 || o.score > w.score).sort((a, b) => b.score - a.score)[0];
        if (!candidate) continue;
        pool.splice(pool.indexOf(candidate), 1);
        scored = scored.map((o) => (o === w ? candidate : o));
      }
    } catch (e) {
      // A segunda rodada é um extra: se falhar, ficam as opções da primeira.
      console.error("[agentes] refazer opções fracas falhou", e instanceof Error ? e.message : e);
    }
  }

  // Opção com vício de IA nunca é a "melhor" se houver outra limpa. A marcada vem primeiro.
  const clean = scored.filter((o) => o.slop.length === 0);
  const best = (clean.length > 0 ? clean : scored).reduce((a, b) => (b.score > a.score ? b : a));
  return [best, ...scored.filter((o) => o !== best).sort((a, b) => b.score - a.score)].map(({ slop: _slop, ...o }) => ({
    ...o,
    best: o.text === best.text,
  })) as unknown as Scored<T>[];
}

/** A melhor opção (a marcada). */
export function bestOf<T extends Option>(options: Scored<T>[]): Scored<T> | undefined {
  return options.find((o) => o.best);
}
