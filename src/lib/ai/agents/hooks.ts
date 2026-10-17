/** Agente de ganchos (primeiros 1 a 3 s): 3 ganchos de tipos diferentes, com fala, texto na tela e imagem. */
import { z } from "zod";
import type { UserAi } from "../index";
import { contextBlock, type AgentContext } from "./contexto";
import { pickBest, type Scored } from "./escolher";
import { GUIA_HOOK, GUIA_RETENCAO, GUIA_SEM_SLOP } from "./guia";

export const HOOK_TYPES = ["curiosidade", "contradicao", "resultado", "historia", "pergunta", "erro_comum", "prova", "visual"] as const;
const MAX_SPOKEN = 200;
const MAX_ON_SCREEN = 60;
const MAX_VISUAL = 200;

export const HookAgentSchema = z
  .object({
    options: z.array(z.object({ type: z.enum(HOOK_TYPES), spoken: z.string(), onScreen: z.string(), visual: z.string() })),
  })
  .meta({ title: "agent_hooks" });

export type HookChoice = { type: string; text: string; onScreen: string; visual: string };
export type ScoredHook = Scored<HookChoice>;
/** Nota de gancho (0..1) por texto: o jev. */
export type HookScoreFn = (texts: string[]) => Promise<number[]>;

const SYSTEM = `Você escreve o gancho de abertura (primeiros 1 a 3 segundos) de um vídeo falado de criador brasileiro.
Entregue exatamente 3 ganchos, cada um de um TIPO diferente, escolhendo os 3 que mais combinam com o texto-fonte:
curiosidade, contradicao, resultado, historia, pergunta, erro_comum, prova, visual.
Para cada gancho:
- "spoken": a frase falada, de no máximo 12 palavras, que abre o vídeo (sem saudação).
- "onScreen": o texto na tela, de 3 a 6 palavras, que reforça a lacuna.
- "visual": uma frase dizendo o que aparece no primeiro quadro e que faz sentido sem som.
Só use fatos que estão no texto-fonte. Use o idioma do texto.

${GUIA_HOOK}

${GUIA_RETENCAO}

${GUIA_SEM_SLOP}

Responda só com o JSON pedido.`;

export type HooksDeps = { ai: UserAi; score: HookScoreFn };

export async function hooksAgent(deps: HooksDeps, ctx: AgentContext): Promise<ScoredHook[]> {
  const base = contextBlock(ctx);
  return pickBest<HookChoice>({
    types: HOOK_TYPES,
    generate: async ({ redo }) => {
      const user = redo
        ? `${base}\n\nREFAÇA só os tipos ${redo.types.join(", ")} (a primeira versão falhou: ${redo.problem}). Entregue 1 gancho novo para cada um desses tipos.`
        : base;
      const raw = await deps.ai.generateJson(HookAgentSchema, SYSTEM, user);
      return raw.options.map((o) => ({
        type: o.type,
        text: o.spoken.trim().slice(0, MAX_SPOKEN),
        onScreen: o.onScreen.trim().slice(0, MAX_ON_SCREEN),
        visual: o.visual.trim().slice(0, MAX_VISUAL),
      }));
    },
    score: deps.score,
  });
}
