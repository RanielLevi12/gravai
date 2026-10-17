/** Agente de títulos: 3 títulos de tipos diferentes, com nota do jev; refaz o fraco e marca o melhor. */
import { z } from "zod";
import type { UserAi } from "../index";
import { contextBlock, type AgentContext } from "./contexto";
import { pickBest, type Scored } from "./escolher";
import { GUIA_SEM_SLOP, GUIA_TITULOS } from "./guia";

export const TITLE_TYPES = ["beneficio", "erro_comum", "pergunta", "contraste", "numero"] as const;
export const MAX_TITLE_CHARS = 70;

export const TitleAgentSchema = z
  .object({
    options: z.array(z.object({ type: z.enum(TITLE_TYPES), text: z.string() })),
  })
  .meta({ title: "agent_titles" });

export type TitleChoice = { type: string; text: string };
export type ScoredTitle = Scored<TitleChoice>;
export type TitleScoreFn = (titles: string[], context: string) => Promise<number[]>;

const SYSTEM = `Você escreve títulos de vídeos curtos para redes sociais, para criadores brasileiros.
Entregue exatamente 3 títulos, cada um de um TIPO diferente, escolhendo os 3 tipos que mais combinam com o tema:
- beneficio: benefício claro com número ou prazo.
- erro_comum: o erro que a pessoa comete, ou o jeito certo contra o jeito errado.
- pergunta: pergunta específica que o vídeo responde.
- contraste: duas ideias que se chocam, ou quebra de um mito.
- numero: lista ou número concreto tirado do texto.
Cada título tem até ${MAX_TITLE_CHARS} caracteres, promete só o que o texto-fonte entrega e usa o idioma do texto.

${GUIA_TITULOS}

${GUIA_SEM_SLOP}

Responda só com o JSON pedido.`;

export type TitlesDeps = { ai: UserAi; score: TitleScoreFn };

export async function titulosAgent(deps: TitlesDeps, ctx: AgentContext): Promise<ScoredTitle[]> {
  const base = contextBlock(ctx);
  const scoreContext = [ctx.episode ? `Episódio: ${ctx.episode.title}. ${ctx.episode.summary}` : "", ctx.sourceText.slice(0, 1500)].filter(Boolean).join("\n");
  const options = await pickBest<TitleChoice>({
    types: TITLE_TYPES,
    generate: async ({ redo }) => {
      const user = redo
        ? `${base}\n\nREFAÇA só os tipos ${redo.types.join(", ")} (a primeira versão falhou: ${redo.problem}). Entregue 1 título novo para cada um desses tipos.`
        : base;
      const raw = await deps.ai.generateJson(TitleAgentSchema, SYSTEM, user);
      return raw.options.map((o) => ({ type: o.type, text: o.text.trim().replace(/\s+/g, " ").slice(0, MAX_TITLE_CHARS) }));
    },
    score: (texts) => deps.score(texts, scoreContext),
  });
  return options;
}
