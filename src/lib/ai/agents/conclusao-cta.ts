/**
 * Agente de conclusão + CTA: 3 fechos de tipos diferentes. A IA escreve a frase; o contato
 * (telefone, link) nunca sai da mão dela, quem monta é o código (formatCta).
 */
import { z } from "zod";
import type { CtaKind } from "@/lib/profile/schema";
import type { UserAi } from "../index";
import { contextBlock, type AgentContext } from "./contexto";
import { pickBest, type Scored } from "./escolher";
import { GUIA_FECHO, GUIA_SEM_SLOP } from "./guia";

export const CLOSING_TYPES = ["fechar_gancho", "frase_que_fica", "aplicacao_pratica", "virada_final"] as const;
const MAX_PART = 300;

export const ClosingAgentSchema = z
  .object({
    options: z.array(z.object({ type: z.enum(CLOSING_TYPES), conclusion: z.string(), cta: z.string() })),
  })
  .meta({ title: "agent_closing" });

/** A chamada para ação salva no perfil, que define o objetivo do fecho. */
export type CtaSpec = { kind: CtaKind; label: string | null; value: string | null };

export type ClosingChoice = { type: string; text: string; conclusion: string; cta: string };
export type ScoredClosing = Scored<ClosingChoice>;
export type ClosingScoreFn = (texts: string[], context: string) => Promise<number[]>;

/** O que o fecho precisa conseguir, dito para a IA. Sem CTA salvo, ela escolhe uma ação simples. */
export function ctaObjective(cta: CtaSpec | null): string {
  if (!cta?.value?.trim()) {
    return "Sem contato salvo: peça UMA ação simples ligada ao assunto (seguir para ver a continuação, comentar uma pergunta, salvar ou mandar para alguém).";
  }
  switch (cta.kind) {
    case "whatsapp":
      return "Levar a pessoa a chamar no WhatsApp. O número vai na descrição: diga algo como \"chama no WhatsApp, o contato está na descrição\", sem falar número.";
    case "bio":
      return `Levar a pessoa ao link da bio${cta.label?.trim() ? ` (${cta.label.trim()})` : ""}. Diga \"link na bio\", sem soletrar endereço.`;
    case "link":
      return `Levar a pessoa ao link "${cta.label?.trim() || "Link"}", que fica na descrição. Diga \"o link está na descrição\", sem soletrar endereço.`;
    case "phone":
      return "Levar a pessoa a ligar. O telefone vai na descrição: diga \"o telefone está na descrição\", sem falar número.";
  }
}

const SYSTEM = `Você escreve o fecho de um vídeo falado de criador brasileiro: a conclusão e a chamada para ação (CTA).
Entregue exatamente 3 opções, cada uma de um TIPO de conclusão diferente, escolhendo os 3 que mais combinam com o roteiro:
- fechar_gancho: responde o que a abertura prometeu.
- frase_que_fica: uma frase curta e memorável (contraste, inversão ou imagem concreta).
- aplicacao_pratica: o que a pessoa faz hoje ou esta semana.
- virada_final: a última peça que faltava, que muda como se vê o começo.
Cada opção tem "conclusion" (1 ou 2 frases) e "cta" (1 frase, UMA ação, ligada ao objetivo pedido). Juntas, de 15 a 40 palavras.
Use só fatos do roteiro. Não repita o roteiro inteiro. Use o idioma do roteiro.

${GUIA_FECHO}

${GUIA_SEM_SLOP}

Responda só com o JSON pedido.`;

export type ClosingInput = {
  ctx: AgentContext;
  /** Roteiro sem o fecho (abertura e desenvolvimento). */
  scriptBody: string;
  cta: CtaSpec | null;
};

export type ClosingDeps = { ai: UserAi; score: ClosingScoreFn };

export async function conclusaoCtaAgent(deps: ClosingDeps, input: ClosingInput): Promise<ScoredClosing[]> {
  const objective = ctaObjective(input.cta);
  const base = `${contextBlock(input.ctx, { withSource: false })}\n\nObjetivo do CTA: ${objective}\n\nRoteiro até aqui:\n"""\n${input.scriptBody.slice(-6000)}\n"""`;
  const scoreContext = `Objetivo: ${objective}\n${input.scriptBody.slice(0, 600)}`;
  return pickBest<ClosingChoice>({
    types: CLOSING_TYPES,
    generate: async ({ redo }) => {
      const user = redo
        ? `${base}\n\nREFAÇA só os tipos ${redo.types.join(", ")} (a primeira versão falhou: ${redo.problem}). Entregue 1 opção nova para cada um desses tipos.`
        : base;
      const raw = await deps.ai.generateJson(ClosingAgentSchema, SYSTEM, user);
      return raw.options.map((o) => {
        const conclusion = o.conclusion.trim().slice(0, MAX_PART);
        const cta = o.cta.trim().slice(0, MAX_PART);
        return { type: o.type, conclusion, cta, text: `${conclusion} ${cta}`.trim() };
      });
    },
    score: (texts) => deps.score(texts, scoreContext),
  });
}
