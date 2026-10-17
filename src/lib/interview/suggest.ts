/** Sugestões da entrevista: uma chamada à IA do usuário logo após o texto-fonte e os títulos ranqueados. */
import { z } from "zod";
import type { UserAi } from "@/lib/ai";
import { AiError } from "@/lib/ai/schemas";
import { titulosAgent } from "@/lib/ai/agents/titulos";
import { countWords, mainDurationOptions } from "@/lib/rules/duration";
import { MSG_NOT_FOUND, type InterviewDb } from "./service";
import {
  MAX_EPISODES,
  MAX_TITLE,
  MIN_EPISODES,
  PLATFORMS,
  isPlatform,
  type Interview,
  type InterviewSuggestion,
  type TitleOption,
} from "./steps";

/** Trecho do texto-fonte enviado à IA (o suficiente para entender o tema e o tamanho). */
const SOURCE_EXCERPT = 12_000;

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

/**
 * Sugestão para a página: usa a salva; tenta a IA só uma vez por entrevista.
 * Sem IA conectada → `noAi`; outra falha (timeout, 5xx, JSON inválido) grava `suggestionFailedAt`
 * e os passos seguem sem sugestão, sem nova chamada.
 */
export async function loadSuggestion(
  deps: SuggestDeps,
  projectId: string,
  interview: Interview,
): Promise<{ suggestion: InterviewSuggestion | null; noAi: boolean }> {
  if (interview.suggestion) return { suggestion: interview.suggestion, noAi: false };
  if (interview.suggestionFailedAt) return { suggestion: null, noAi: false };
  try {
    return { suggestion: await suggestInterviewWith(deps, projectId), noAi: false };
  } catch (e) {
    if (e instanceof AiError && e.code === "not_connected") return { suggestion: null, noAi: true };
    console.error("[entrevista] sugestão falhou", e instanceof Error ? e.message : e);
    try {
      const fresh = await deps.db.getProject(projectId);
      if (fresh && !fresh.interview?.suggestion) {
        await deps.db.saveInterview(projectId, { ...(fresh.interview ?? {}), suggestionFailedAt: new Date().toISOString() });
      }
    } catch {
      // sem o marcador, a próxima abertura tenta de novo; nada mais a fazer
    }
    return { suggestion: null, noAi: false };
  }
}

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

/** 3 títulos de tipos diferentes (agente de títulos), com nota do jev; o melhor vem primeiro e marcado. Salvos em `interview.titleSuggestions`. */
export async function suggestTitlesWith(deps: TitleDeps, projectId: string): Promise<TitleOption[]> {
  const project = await deps.db.getProject(projectId);
  if (!project) throw new AiError(MSG_NOT_FOUND, { code: "invalid_input" });
  const ai = await deps.ai();
  const profile = deps.profile ? await deps.profile().catch(() => null) : null;
  const i = project.interview ?? {};

  const ep = project.episode_index ? i.episodes?.[project.episode_index - 1] : undefined;
  const options = await titulosAgent(
    { ai, score: deps.score },
    {
      sourceText: project.source_text,
      sourceLimit: SOURCE_EXCERPT,
      profile,
      about: project.folder_about,
      style: project.folder_style,
      episode: ep && project.episode_index ? { index: project.episode_index, title: ep.title, summary: ep.summary } : null,
      platforms: (i.platforms ?? []).filter(isPlatform),
      mainSeconds: i.mainSeconds,
    },
  );
  const ranked: TitleOption[] = options.map((o) => ({ text: clip(o.text, MAX_TITLE), score: o.score, type: o.type, best: o.best }));

  const fresh = await deps.db.getProject(projectId);
  if (fresh) await deps.db.saveInterview(projectId, { ...(fresh.interview ?? {}), titleSuggestions: ranked });
  return ranked;
}
