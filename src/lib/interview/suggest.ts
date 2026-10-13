/** Sugestões da entrevista: uma chamada à IA do usuário logo após o texto-fonte e os títulos ranqueados. */
import { z } from "zod";
import type { UserAi } from "@/lib/ai";
import { AiError } from "@/lib/ai/schemas";
import { countWords, mainDurationOptions } from "@/lib/rules/duration";
import { MSG_NOT_FOUND, type InterviewDb } from "./service";
import {
  MAX_EPISODES,
  MAX_TITLE,
  MIN_EPISODES,
  PLATFORM_LABELS,
  PLATFORMS,
  formatSeconds,
  isPlatform,
  type InterviewSuggestion,
  type TitleOption,
} from "./steps";

/** Trecho do texto-fonte enviado à IA (o suficiente para entender o tema e o tamanho). */
const SOURCE_EXCERPT = 12_000;
const TITLE_COUNT = 6;

export type ProfileContext = { niche?: string | null; audience?: string | null; tone?: string | null };

export type SuggestDeps = {
  db: InterviewDb;
  ai: () => Promise<UserAi>;
  profile?: () => Promise<ProfileContext | null>;
};

export type TitleDeps = SuggestDeps & { score: (titles: string[], context: string) => Promise<number[]> };

const REASON_KEYS = ["plataformas", "formato", "duracao", "cenario", "capa"] as const;

export const SuggestionSchema = z
  .object({
    platforms: z.array(z.enum(PLATFORMS)),
    format: z.enum(["single", "series"]),
    episodes: z.array(z.object({ title: z.string(), summary: z.string() })),
    mainSeconds: z.number(),
    scenery: z.object({ natural: z.string(), aiPrompt: z.string() }),
    cover: z.enum(["frame", "ai"]),
    reasons: z.object({
      plataformas: z.string(),
      formato: z.string(),
      duracao: z.string(),
      cenario: z.string(),
      capa: z.string(),
    }),
  })
  .meta({ title: "interview_suggestion" });

export type RawSuggestion = z.infer<typeof SuggestionSchema>;

const TitlesSchema = z.object({ titles: z.array(z.string()) }).meta({ title: "interview_titles" });

const clip = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");

/**
 * Deixa a sugestão da IA dentro das regras: plataformas válidas e sem repetição, duração só entre as
 * habilitadas para o texto, série só com 2+ episódios, textos com tamanho limitado.
 */
export function normalizeSuggestion(raw: RawSuggestion, sourceText: string): InterviewSuggestion {
  const wanted = (raw.platforms ?? []).filter(isPlatform);
  const platforms = PLATFORMS.filter((p) => wanted.includes(p));

  const episodes = (raw.episodes ?? [])
    .map((e) => ({ title: clip(e?.title, 100), summary: clip(e?.summary, 500) }))
    .filter((e) => e.title)
    .slice(0, MAX_EPISODES);
  const series = raw.format === "series" && episodes.length >= MIN_EPISODES;

  const enabled = mainDurationOptions(sourceText)
    .filter((o) => o.enabled)
    .map((o) => o.seconds);
  const fits = enabled.filter((s) => s <= raw.mainSeconds);
  const mainSeconds = fits.length > 0 ? fits[fits.length - 1] : enabled[0];

  const reasons: InterviewSuggestion["reasons"] = {};
  for (const k of REASON_KEYS) {
    const r = clip(raw.reasons?.[k], 300);
    if (r) reasons[k] = r;
  }

  return {
    platforms: platforms.length > 0 ? platforms : ["reels"],
    format: series ? "series" : "single",
    episodes: series ? episodes : [],
    mainSeconds,
    scenery: { natural: clip(raw.scenery?.natural, 500), aiPrompt: clip(raw.scenery?.aiPrompt, 2000) },
    cover: raw.cover === "ai" ? "ai" : "frame",
    reasons,
  };
}

function profileLines(p: ProfileContext | null | undefined): string {
  if (!p) return "";
  const lines = [
    p.niche ? `Nicho de quem grava: ${p.niche}` : "",
    p.audience ? `Público: ${p.audience}` : "",
    p.tone ? `Tom: ${p.tone}` : "",
  ].filter(Boolean);
  return lines.length > 0 ? `${lines.join("\n")}\n\n` : "";
}

const SUGGEST_SYSTEM = `Você ajuda criadores de conteúdo a transformar um texto em vídeo falado para redes sociais.
Leia o texto e sugira, para um vídeo gravado pela própria pessoa:
- platforms: onde publicar (youtube, reels, feed_instagram, facebook, tiktok, x), de 1 a 3, as que mais combinam com o tema.
- format: "single" (vídeo único) ou "series" (série). Sugira série só se o texto tiver partes independentes que rendem vídeos separados; nesse caso, liste em episodes de 2 a 5 episódios com título curto e resumo de uma frase. Para vídeo único, episodes = [].
- mainSeconds: duração do vídeo principal em segundos, uma das durações possíveis informadas.
- scenery.natural: um cenário simples que a pessoa monta em casa (uma frase).
- scenery.aiPrompt: um prompt detalhado para gerar esse fundo com IA de imagem (sem pessoas, sem texto).
- cover: "frame" (um quadro do próprio vídeo com o título) ou "ai" (capa criada com IA).
- reasons: uma frase curta e simples, em português do Brasil, explicando cada escolha (plataformas, formato, duracao, cenario, capa).
Escreva os títulos e resumos dos episódios no mesmo idioma do texto.`;

/** Uma chamada à IA do usuário; a sugestão fica salva em `interview.suggestion`. */
export async function suggestInterviewWith(deps: SuggestDeps, projectId: string): Promise<InterviewSuggestion> {
  const project = await deps.db.getProject(projectId);
  if (!project) throw new AiError(MSG_NOT_FOUND, { code: "invalid_input" });
  const ai = await deps.ai();
  const profile = deps.profile ? await deps.profile().catch(() => null) : null;

  const durations = mainDurationOptions(project.source_text)
    .filter((o) => o.enabled)
    .map((o) => o.seconds);
  const user = `${profileLines(profile)}Durações possíveis (segundos): ${durations.join(", ")}
O texto tem ${countWords(project.source_text)} palavras.

Texto:
"""
${project.source_text.slice(0, SOURCE_EXCERPT)}
"""`;
  const raw = await ai.generateJson(SuggestionSchema, SUGGEST_SYSTEM, user);
  const suggestion = normalizeSuggestion(raw, project.source_text);

  // Relê antes de gravar para não apagar uma resposta salva enquanto a IA pensava.
  const fresh = await deps.db.getProject(projectId);
  if (fresh) await deps.db.saveInterview(projectId, { ...(fresh.interview ?? {}), suggestion });
  return suggestion;
}

const TITLES_SYSTEM = `Você escreve títulos de vídeos curtos para redes sociais.
Crie ${TITLE_COUNT} títulos diferentes para o vídeo descrito: curtos (até 70 caracteres), específicos, com gancho de curiosidade ou benefício claro, sem caça-clique enganoso e sem hashtags.
Escreva no mesmo idioma do texto.`;

/** 6 títulos da IA do usuário, ranqueados por potencial de viralizar (maior primeiro); salvos em `interview.titleSuggestions`. */
export async function suggestTitlesWith(deps: TitleDeps, projectId: string): Promise<TitleOption[]> {
  const project = await deps.db.getProject(projectId);
  if (!project) throw new AiError(MSG_NOT_FOUND, { code: "invalid_input" });
  const ai = await deps.ai();
  const profile = deps.profile ? await deps.profile().catch(() => null) : null;
  const i = project.interview ?? {};

  const episode =
    project.episode_index && i.episodes?.[project.episode_index - 1]
      ? `Este vídeo é o episódio ${project.episode_index} de uma série: ${i.episodes[project.episode_index - 1].title}. ${i.episodes[project.episode_index - 1].summary}\n`
      : "";
  const where = (i.platforms ?? []).map((p) => PLATFORM_LABELS[p]).join(", ");
  const context = [
    where ? `Plataformas: ${where}` : "",
    i.mainSeconds ? `Duração: ${formatSeconds(i.mainSeconds)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const user = `${profileLines(profile)}${episode}${context}

Texto:
"""
${project.source_text.slice(0, SOURCE_EXCERPT)}
"""`;

  const raw = await ai.generateJson(TitlesSchema, TITLES_SYSTEM, user);
  const titles = [...new Set(raw.titles.map((t) => clip(t, MAX_TITLE)).filter(Boolean))].slice(0, TITLE_COUNT);
  if (titles.length === 0) throw new AiError(undefined, { code: "invalid_output" });

  const scores = await deps.score(titles, `${episode}${context}\n${project.source_text.slice(0, 1500)}`.trim());
  const ranked = titles
    .map((text, k) => ({ text, score: Math.min(1, Math.max(0, Number.isFinite(scores[k]) ? scores[k] : 0)) }))
    .sort((a, b) => b.score - a.score);

  const fresh = await deps.db.getProject(projectId);
  if (fresh) await deps.db.saveInterview(projectId, { ...(fresh.interview ?? {}), titleSuggestions: ranked });
  return ranked;
}
