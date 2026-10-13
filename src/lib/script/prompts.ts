/** Prompts da geração do script. Puro: só monta texto. */
import { PLATFORM_LABELS, type Interview, type Platform } from "@/lib/interview/steps";
import { estimateCutCount } from "@/lib/rules/cuts";
import { targetWords } from "@/lib/rules/duration";

/** Trecho do texto-fonte enviado à IA (o texto já vem cortado em 60 mil caracteres). */
const SOURCE_EXCERPT = 30_000;

export type ScriptProfile = { niche?: string | null; audience?: string | null; tone?: string | null; phrases?: string | null };
export type ScriptEpisode = { index: number; title: string; summary: string };

export const SCRIPT_SYSTEM = `Você escreve roteiros falados para vídeos curtos de criadores brasileiros.
Regras:
- Escreva no mesmo idioma do texto-fonte, em linguagem falada e simples, como a pessoa falaria olhando para a câmera.
- O vídeo principal tem: um bloco "opening" (abertura com gancho), os blocos "cut" (cada um é um trecho do vídeo principal que também será publicado sozinho), blocos "bridge" opcionais (transições curtas entre cortes) e um bloco "closing" (fechamento).
- Cada "cut" precisa de um gancho próprio na primeira frase e fazer sentido sozinho, sem depender dos outros; dê a ele um "cutTitle" curto e um "coverPrompt" (descrição de uma imagem de capa).
- Não invente fatos que não estejam no texto-fonte.
- Não escreva chamada para ação (link, WhatsApp, telefone) nas descrições nem no roteiro: ela é adicionada depois.
- "descriptions" de cada corte e "mainDescriptions" do vídeo principal: uma legenda por plataforma pedida, no estilo da plataforma, sem a chamada para ação. "mainCoverPrompt": descrição da capa do vídeo principal.
- Responda só com o JSON pedido.`;

export function buildScriptUser(input: {
  sourceText: string;
  interview: Interview;
  profile: ScriptProfile | null;
  episode: ScriptEpisode | null;
  platforms: Platform[];
  mainSeconds: number;
  cutSeconds: number | null;
  problem?: string;
}): string {
  const { interview: i, profile, episode, platforms, mainSeconds, cutSeconds, problem } = input;
  const cuts = cutSeconds ? estimateCutCount(mainSeconds, cutSeconds) : 0;
  const lines: string[] = [];
  if (profile?.niche) lines.push(`Nicho: ${profile.niche}`);
  if (profile?.audience) lines.push(`Público: ${profile.audience}`);
  if (profile?.tone) lines.push(`Tom de voz: ${profile.tone}`);
  if (profile?.phrases) lines.push(`Frases e expressões da pessoa: ${profile.phrases}`);
  if (episode) lines.push(`Este vídeo é o episódio ${episode.index} de uma série: ${episode.title}. ${episode.summary}`);
  if (i.titles?.chosen) lines.push(`Título do vídeo: ${i.titles.chosen}`);
  if (i.scenery) lines.push(`Cenário: ${i.scenery.mode === "ai" ? i.scenery.aiPrompt : i.scenery.natural}`);
  lines.push(`Plataformas (uma descrição para cada): ${platforms.map((p) => `${p} (${PLATFORM_LABELS[p]})`).join(", ")}`);
  lines.push(`Vídeo principal: ${mainSeconds} segundos, cerca de ${targetWords(mainSeconds)} palavras no total (todos os blocos somados).`);
  lines.push(
    cutSeconds
      ? `Cortes: exatamente ${cuts} blocos "cut", cada um com cerca de ${targetWords(cutSeconds)} palavras (${cutSeconds} segundos), no máximo ${targetWords(Math.floor(cutSeconds * 1.2))}.`
      : `Sem cortes: não escreva blocos "cut"; use só "opening" e "closing".`,
  );
  if (problem) lines.push(`ATENÇÃO: a versão anterior falhou: ${problem}. Corrija isso.`);
  return `${lines.join("\n")}\n\nTexto-fonte:\n${input.sourceText.slice(0, SOURCE_EXCERPT)}`;
}

/** Tamanho máximo do pedido livre de reescrita. */
export const MAX_CUSTOM = 300;

export type RewriteInstruction = "shorter" | "direct" | "emotional" | "hook" | "simpler" | { custom: string };

const REWRITE_INSTRUCTIONS = {
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
  kind: "opening" | "bridge" | "cut" | "closing";
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
