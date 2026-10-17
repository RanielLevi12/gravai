/** Contexto comum dos agentes de roteiro (título, gancho, fecho). Puro: só monta texto. */
import type { FolderStyle } from "@/lib/folders/schema";
import { PLATFORM_LABELS, formatSeconds, type Platform } from "@/lib/interview/steps";

export type AgentProfile = { niche?: string | null; audience?: string | null; tone?: string | null; phrases?: string | null };
export type AgentEpisode = { index: number; title: string; summary: string };

export type AgentContext = {
  sourceText: string;
  /** Quantos caracteres do texto-fonte vão para a IA. */
  sourceLimit?: number;
  title?: string | null;
  profile?: AgentProfile | null;
  /** "Sobre este projeto". */
  about?: string | null;
  /** Estilo do projeto (folders.settings.style): vale mais que o perfil. */
  style?: FolderStyle | null;
  episode?: AgentEpisode | null;
  platforms?: Platform[];
  mainSeconds?: number;
};

const SOURCE_DEFAULT = 12_000;
const clean = (s: string | null | undefined) => (s ?? "").trim();

/** Linhas de quem fala, do público e do tom. O estilo do projeto vence o perfil geral. */
export function styleLines(profile: AgentProfile | null | undefined, style: FolderStyle | null | undefined, about?: string | null): string[] {
  const tone = clean(style?.tone) || clean(profile?.tone);
  const audience = clean(style?.audience) || clean(profile?.audience);
  const lines = [
    clean(profile?.niche) && `Nicho de quem grava: ${clean(profile?.niche)}`,
    audience && `Público: ${audience}`,
    tone && `Tom de voz: ${tone}`,
    clean(profile?.phrases) && `Frases e expressões da pessoa: ${clean(profile?.phrases)}`,
    clean(about) && `Sobre o projeto deste vídeo (tema e público do canal): ${clean(about)}`,
    clean(style?.examples) &&
      `Exemplos de como a pessoa fala (imite o ritmo e o vocabulário, sem copiar as frases):\n${clean(style?.examples)}`,
  ];
  return lines.filter((l): l is string => Boolean(l));
}

/** Pedido-base de todos os agentes: estilo, episódio, plataformas, duração e o texto-fonte. */
export function contextBlock(ctx: AgentContext, opts: { withSource?: boolean } = {}): string {
  const lines = styleLines(ctx.profile, ctx.style, ctx.about);
  if (ctx.episode) lines.push(`Este vídeo é o episódio ${ctx.episode.index} de uma série: ${ctx.episode.title}. ${ctx.episode.summary}`);
  if (ctx.title) lines.push(`Título do vídeo: ${ctx.title}`);
  if (ctx.platforms?.length) lines.push(`Plataformas: ${ctx.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}`);
  if (ctx.mainSeconds) lines.push(`Duração: ${formatSeconds(ctx.mainSeconds)}`);
  if (opts.withSource === false) return lines.join("\n");
  const source = ctx.sourceText.slice(0, ctx.sourceLimit ?? SOURCE_DEFAULT);
  return `${lines.join("\n")}${lines.length ? "\n\n" : ""}Texto-fonte:\n"""\n${source}\n"""`;
}
