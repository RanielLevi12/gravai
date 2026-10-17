/** Prompts da geração do script. Puro: só monta texto. */
import { PLATFORM_LABELS, type Interview, type Platform } from "@/lib/interview/steps";
import { GUIA_ROTEIRO } from "@/lib/ai/agents/guia";
import { styleLines } from "@/lib/ai/agents/contexto";
import type { FolderStyle } from "@/lib/folders/schema";
import { targetWords } from "@/lib/rules/duration";
import type { BlockKind } from "./generate";

/** Trecho do texto-fonte enviado à IA (o texto já vem cortado em 60 mil caracteres). */
const SOURCE_EXCERPT = 30_000;

export type ScriptProfile = { niche?: string | null; audience?: string | null; tone?: string | null; phrases?: string | null };
export type ScriptEpisode = { index: number; title: string; summary: string };

export const SCRIPT_SYSTEM = `Você escreve o roteiro falado de UM vídeo de criador brasileiro, do começo ao fim, como um texto só e contínuo.
Regras:
- Escreva no mesmo idioma do texto-fonte, em linguagem falada e simples, como a pessoa falaria olhando para a câmera.
- É um único vídeo: um bloco "opening" (abertura com gancho), vários blocos "body" (os parágrafos do desenvolvimento, cada um continuando o anterior) e um bloco "closing" (fechamento).
- A abertura começa direto no gancho: sem saudação longa, sem apresentação, sem "neste vídeo". Se vier um gancho escolhido no pedido, a abertura COMEÇA com essa frase, palavra por palavra.
- Cumprimente a plateia no máximo UMA vez, de forma curta, e só depois do gancho, se combinar com o tom. Nenhum outro bloco começa com cumprimento, nem recomeça o assunto como se fosse outro vídeo, nem se despede antes do fechamento.
- Cada "body" liga com o anterior (use a continuação natural da fala) e avança a ideia com uma virada, nunca com "e então".
- O "closing" paga o gancho e fecha com UMA ação ligada ao objetivo pedido. Sem resumo do vídeo inteiro.
- Não faça cortes nem marque trechos para publicar separado: isso é feito depois, em outra etapa.
- Não invente fatos que não estejam no texto-fonte.
- Não escreva link, telefone nem número de WhatsApp no roteiro nem nas descrições: o contato é adicionado depois pelo sistema. Pode dizer "o link está na descrição".
- "mainDescriptions": uma legenda por plataforma pedida, no estilo da plataforma, sem a chamada para ação. "mainCoverPrompt": descrição da capa do vídeo.
- Responda só com o JSON pedido.

${GUIA_ROTEIRO}`;

export function buildScriptUser(input: {
  sourceText: string;
  interview: Interview;
  profile: ScriptProfile | null;
  episode: ScriptEpisode | null;
  platforms: Platform[];
  mainSeconds: number;
  /** "Sobre este projeto" (vídeo dentro de um projeto). */
  about?: string | null;
  /** Estilo do projeto (tom, público, exemplos): vale mais que o perfil. */
  style?: FolderStyle | null;
  /** Gancho escolhido pelo agente de ganchos: a abertura começa com ele. */
  hook?: { text: string; onScreen?: string } | null;
  /** O que o fecho precisa conseguir (ver `ctaObjective`). */
  ctaObjective?: string | null;
  problem?: string;
}): string {
  const { interview: i, profile, episode, platforms, mainSeconds, about, style, hook, problem } = input;
  const lines: string[] = styleLines(profile, style, about);
  if (hook?.text) lines.push(`Gancho escolhido (a abertura começa com esta frase, sem mudar): ${hook.text}`);
  if (input.ctaObjective) lines.push(`Objetivo do fecho: ${input.ctaObjective}`);
  if (episode) lines.push(`Este vídeo é o episódio ${episode.index} de uma série: ${episode.title}. ${episode.summary}`);
  if (i.titles?.chosen) lines.push(`Título do vídeo: ${i.titles.chosen}`);
  if (i.scenery) lines.push(`Cenário: ${i.scenery.mode === "ai" ? i.scenery.aiPrompt : i.scenery.natural}`);
  lines.push(`Plataformas (uma descrição para cada): ${platforms.map((p) => `${p} (${PLATFORM_LABELS[p]})`).join(", ")}`);
  lines.push(`Vídeo principal: ${mainSeconds} segundos, cerca de ${targetWords(mainSeconds)} palavras no total (todos os blocos somados), em 4 a 8 blocos "body".`);
  if (problem) lines.push(`ATENÇÃO: a versão anterior falhou: ${problem}. Corrija isso.`);
  return `${lines.join("\n")}\n\nTexto-fonte:\n${input.sourceText.slice(0, SOURCE_EXCERPT)}`;
}

/** Tamanho máximo do pedido livre de reescrita. */
export const MAX_CUSTOM = 300;

export type RewriteInstruction = "noGreeting" | "shorter" | "direct" | "emotional" | "hook" | "simpler" | { custom: string };

const REWRITE_INSTRUCTIONS = {
  noGreeting:
    "Tire a saudação e as expressões de chamar a plateia (\"Fala, pessoal\", \"Meu povo\", \"Olá\", \"E aí\" etc.) do começo do trecho: comece direto na ideia e mantenha o resto como está.",
  shorter: "Deixe mais curto: tire o que é repetido ou secundário e mantenha a ideia central.",
  direct: "Deixe mais direto: vá ao ponto logo, sem rodeios nem introduções.",
  emotional: "Deixe mais emocional: aproxime da vivência da pessoa que assiste, com mais sentimento e menos explicação seca.",
  hook: "Reforce o gancho: a primeira frase precisa prender a atenção de quem está rolando o feed.",
  simpler: "Deixe mais simples: palavras e frases curtas do dia a dia, sem termos difíceis.",
} as const;

export const REWRITE_SYSTEM = `Você reescreve UM trecho de um roteiro falado para vídeo de criador brasileiro.
Regras:
- Reescreva só o trecho indicado, no mesmo idioma dele, em linguagem falada e simples, mantendo o tom de voz.
- Use o texto vizinho só para manter a continuidade: não repita nem reescreva o que está nele.
- Não invente fatos e não escreva chamada para ação (link, WhatsApp, telefone).
- Responda só com o JSON pedido, com o novo texto do trecho em "text".`;

export function buildRewriteUser(input: {
  kind: BlockKind;
  text: string;
  previous: string | null;
  next: string | null;
  instruction: RewriteInstruction;
  tone: string | null;
  cutSeconds: number | null;
  problem?: string;
}): string {
  const { kind, text, previous, next, instruction, tone, cutSeconds, problem } = input;
  const lines: string[] = [];
  if (tone) lines.push(`Tom de voz: ${tone}`);
  lines.push(`Pedido: ${typeof instruction === "string" ? REWRITE_INSTRUCTIONS[instruction] : instruction.custom.trim()}`);
  if (kind === "cut" && cutSeconds) {
    lines.push(
      `Este trecho é um corte de ${cutSeconds} segundos: o novo texto deve ter cerca de ${targetWords(cutSeconds)} palavras e no máximo ${targetWords(Math.floor(cutSeconds * 1.2))}.`,
    );
  }
  if (problem) lines.push(`ATENÇÃO: a versão anterior falhou: ${problem}. Corrija isso.`);
  if (previous) lines.push(`\nTexto que vem antes (não reescreva):\n${previous}`);
  if (next) lines.push(`\nTexto que vem depois (não reescreva):\n${next}`);
  lines.push(`\nTrecho a reescrever:\n${text}`);
  return lines.join("\n");
}
