/** CTA dos cortes: cada corte aponta para o vídeo principal ou para outro corte. Uma chamada à IA para todos. */
import { z } from "zod";
import type { UserAi } from "../index";
import { GUIA_SEM_SLOP } from "./guia";
import { findSlop } from "./slop";

export type CutPointerInput = { index: number; title: string; text: string };
export type CutPointer = { target: "principal" | "corte"; /** 1..n do corte apontado, quando target = "corte". */ targetIndex: number | null; line: string };

export const CutPointersSchema = z
  .object({
    pointers: z.array(z.object({ index: z.number(), target: z.enum(["principal", "corte"]), targetIndex: z.number().nullable(), line: z.string() })),
  })
  .meta({ title: "agent_cut_pointers" });

const MAX_LINE = 160;

const SYSTEM = `Você escreve a chamada final da legenda de cada CORTE de um vídeo, para publicar o corte sozinho nas redes.
Cada corte aponta para UM destino:
- "principal": o vídeo completo (o corte é um pedaço dele).
- "corte": outro corte da lista (use quando o assunto do outro corte é a continuação natural; informe targetIndex, que nunca é o próprio corte).
Escreva "line": 1 frase curta (até 20 palavras) que diga o que a pessoa vai ver lá e por quê vale, citando o nome do vídeo ou do corte. Não escreva link, telefone nem endereço: o contato é adicionado depois. Varie os destinos entre os cortes quando fizer sentido. Não prometa nada que o destino não tenha.

${GUIA_SEM_SLOP}

Responda só com o JSON pedido.`;

/** Frase padrão (sem IA): aponta para o vídeo completo. */
export function defaultPointer(mainTitle: string): CutPointer {
  const t = mainTitle.trim();
  return { target: "principal", targetIndex: null, line: t ? `Veja o vídeo completo: ${t}` : "Veja o vídeo completo" };
}

/** Valida o que a IA devolveu; o que faltar ou vier ruim usa a frase padrão. Índices são 1..n. */
export function normalizePointers(raw: z.infer<typeof CutPointersSchema>, count: number, mainTitle: string): CutPointer[] {
  return Array.from({ length: count }, (_, k) => {
    const i = k + 1;
    const p = raw.pointers.find((x) => Math.round(Number(x.index)) === i);
    const line = p?.line?.trim().replace(/\s+/g, " ").slice(0, MAX_LINE);
    if (!p || !line || findSlop(line).length > 0 || /https?:\/\/|www\.|\d{4,}/i.test(line)) return defaultPointer(mainTitle);
    const to = Math.round(Number(p.targetIndex));
    if (p.target === "corte") {
      return to >= 1 && to <= count && to !== i ? { target: "corte", targetIndex: to, line } : defaultPointer(mainTitle);
    }
    return { target: "principal", targetIndex: null, line };
  });
}

export async function cortesCtaAgent(deps: { ai: UserAi }, input: { mainTitle: string; cuts: CutPointerInput[] }): Promise<CutPointer[]> {
  if (input.cuts.length === 0) return [];
  const list = input.cuts.map((c) => `[${c.index}] ${c.title || "(sem título)"}\n${c.text.slice(0, 600)}`).join("\n\n");
  const user = `Vídeo completo: ${input.mainTitle || "(sem título)"}\n\nCortes:\n${list}`;
  try {
    const raw = await deps.ai.generateJson(CutPointersSchema, SYSTEM, user);
    return normalizePointers(raw, input.cuts.length, input.mainTitle);
  } catch (e) {
    // Os cortes já estão prontos: sem a IA, todos apontam para o vídeo completo.
    console.error("[cortes] CTA dos cortes falhou", e instanceof Error ? e.message : e);
    return input.cuts.map(() => defaultPointer(input.mainTitle));
  }
}

/** Põe a frase do corte antes do contato (última linha) de cada descrição, ou no fim se não houver contato. */
export function withPointer(descriptions: Partial<Record<string, string>>, pointerLine: string, ctaLine: string | null): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const [p, d] of Object.entries(descriptions)) {
    if (!d) continue;
    out[p] = ctaLine && d.endsWith(ctaLine) ? `${d.slice(0, -ctaLine.length).trimEnd()}\n${pointerLine}\n${ctaLine}` : `${d}\n${pointerLine}`;
  }
  return out;
}
