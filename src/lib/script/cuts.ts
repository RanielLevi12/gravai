/** Cortes: trechos de blocos consecutivos do script contínuo. Puro: valida, calcula e monta o pedido à IA. */
import { z } from "zod";
import { PLATFORM_LABELS, PLATFORMS, isPlatform, type Platform } from "@/lib/interview/steps";
import { estimateSeconds } from "@/lib/rules/duration";
import { styleLines } from "@/lib/ai/agents/contexto";
import type { FolderStyle } from "@/lib/folders/schema";
import { finishDescriptions, type Descriptions } from "./generate";

/** Posições (1..n) dos blocos do script; `descriptions` já com a chamada para ação na última linha. */
export type Cut = { id: string; start: number; end: number; title: string; coverPrompt: string | null; descriptions: Descriptions };

export const MAX_CUTS = 20;
export const MAX_CUT_TITLE = 100;
const MAX_COVER = 1000;
const MAX_DESCRIPTION = 2200;
/** Um corte pode passar do alvo até esta folga; a IA que passar disso é aparada. */
const OVER = 1.3;
const UNDER = 0.3;

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

export type CutsResult = { ok: true; cuts: Cut[] } | { ok: false; error: string };

/** Valida o que veio do navegador: posições inteiras dentro do script, sem sobreposição. Devolve ordenado pelo início. */
export function validateCuts(input: unknown, blockCount: number): CutsResult {
  if (!Array.isArray(input)) return { ok: false, error: "Cortes inválidos." };
  if (input.length > MAX_CUTS) return { ok: false, error: `No máximo ${MAX_CUTS} cortes.` };
  const cuts: Cut[] = [];
  const ids = new Set<string>();
  for (const c of input) {
    if (!isObj(c)) return { ok: false, error: "Cortes inválidos." };
    const { id, start, end, title } = c;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(id) || ids.has(id)) return { ok: false, error: "Cortes inválidos." };
    ids.add(id);
    if (!Number.isInteger(start) || !Number.isInteger(end) || (start as number) < 1 || (end as number) > blockCount || (start as number) > (end as number)) {
      return { ok: false, error: "Um corte aponta para trechos que não existem." };
    }
    if (typeof title !== "string" || title.length > MAX_CUT_TITLE) return { ok: false, error: `O título do corte pode ter até ${MAX_CUT_TITLE} letras.` };
    const cover = c.coverPrompt == null ? null : c.coverPrompt;
    if (cover !== null && (typeof cover !== "string" || cover.length > MAX_COVER)) return { ok: false, error: "Descrição de capa longa demais." };
    const descriptions: Descriptions = {};
    if (c.descriptions != null) {
      if (!isObj(c.descriptions)) return { ok: false, error: "Cortes inválidos." };
      for (const [p, d] of Object.entries(c.descriptions)) {
        if (!isPlatform(p) || typeof d !== "string" || d.length > MAX_DESCRIPTION) return { ok: false, error: "Descrição de corte inválida." };
        descriptions[p] = d;
      }
    }
    cuts.push({ id, start: start as number, end: end as number, title: title.trim(), coverPrompt: cover?.trim() || null, descriptions });
  }
  cuts.sort((a, b) => a.start - b.start);
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i].start <= cuts[i - 1].end) return { ok: false, error: "Dois cortes não podem usar o mesmo trecho." };
  }
  return { ok: true, cuts };
}

/** Duração estimada (s) do corte, pelo texto dos blocos `start..end` (`texts[0]` = bloco 1). */
export function cutSecondsOf(texts: string[], cut: Pick<Cut, "start" | "end">): number {
  return texts.slice(cut.start - 1, cut.end).reduce((sum, t) => sum + estimateSeconds(t), 0);
}

const DescriptionsSchema = z.object(Object.fromEntries(PLATFORMS.map((p) => [p, z.string().optional()])));

export const CutsSchema = z
  .object({
    cuts: z.array(z.object({ start: z.number(), end: z.number(), title: z.string(), coverPrompt: z.string(), descriptions: DescriptionsSchema })),
  })
  .meta({ title: "cuts_suggestion" });
export type RawCuts = z.infer<typeof CutsSchema>;

export const CUTS_SYSTEM = `Você escolhe os melhores cortes de um roteiro falado já pronto, para publicar separado nas redes.
Regras:
- O roteiro vem em blocos numerados. Cada corte é um trecho de blocos CONSECUTIVOS do mesmo roteiro (início e fim = números dos blocos), sem sobrepor outro corte.
- O corte é só um recorte do vídeo: não crie texto novo, saudação nem "vídeo novo". Escolha trechos que façam sentido sozinhos e tenham um bom gancho logo no começo.
- Respeite o tamanho pedido para cada corte (cada bloco mostra a duração estimada).
- "title": título curto do corte. "coverPrompt": descrição da imagem de capa do corte. "descriptions": uma legenda por plataforma pedida, no estilo da plataforma, sem a chamada para ação (ela é adicionada depois). Não escreva link, telefone nem número. Evite "Você sabia que", "Neste vídeo", "mergulhar", "jornada" e travessões.
- Responda só com o JSON pedido.`;

export function buildCutsUser(input: {
  blocks: { position: number; text: string }[];
  cutSeconds: number;
  count: number;
  platforms: Platform[];
  about?: string | null;
  style?: FolderStyle | null;
  title?: string | null;
}): string {
  const lines: string[] = styleLines(null, input.style, input.about);
  if (input.title) lines.push(`Título do vídeo: ${input.title}`);
  lines.push(`Plataformas (uma descrição para cada): ${input.platforms.map((p) => `${p} (${PLATFORM_LABELS[p]})`).join(", ")}`);
  lines.push(`Escolha até ${input.count} cortes de cerca de ${input.cutSeconds} segundos cada.`);
  const blocks = input.blocks.map((b) => `[${b.position}] (~${estimateSeconds(b.text)} s) ${b.text}`).join("\n\n");
  return `${lines.join("\n")}\n\nRoteiro:\n${blocks}`;
}

/**
 * Deixa a sugestão da IA dentro das regras: posições válidas, sem sobreposição, no máximo `maxCuts`,
 * cortes compridos demais aparados pelo fim, curtos demais descartados; chamada para ação só no código.
 */
export function normalizeCuts(
  raw: RawCuts,
  texts: string[],
  opts: { cutSeconds: number; maxCuts: number; platforms: Platform[]; ctaLine: string | null; newId: () => string },
): Cut[] {
  const n = texts.length;
  const candidates = (raw.cuts ?? [])
    .map((c) => {
      let a = Math.round(Number(c.start));
      let b = Math.round(Number(c.end));
      if (a > b) [a, b] = [b, a];
      return { ...c, start: Math.max(1, a), end: Math.min(n, b) };
    })
    .filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.start <= c.end)
    .sort((x, y) => x.start - y.start);

  const out: Cut[] = [];
  let lastEnd = 0;
  for (const c of candidates) {
    if (out.length >= opts.maxCuts) break;
    const start = Math.max(c.start, lastEnd + 1);
    let end = c.end;
    while (end > start && cutSecondsOf(texts, { start, end }) > opts.cutSeconds * OVER) end--;
    if (start > end || cutSecondsOf(texts, { start, end }) < opts.cutSeconds * UNDER) continue;
    out.push({
      id: opts.newId(),
      start,
      end,
      title: (c.title ?? "").trim().slice(0, MAX_CUT_TITLE),
      coverPrompt: (c.coverPrompt ?? "").trim().slice(0, MAX_COVER) || null,
      descriptions: finishDescriptions(c.descriptions, opts.platforms, opts.ctaLine),
    });
    lastEnd = end;
  }
  return out;
}
