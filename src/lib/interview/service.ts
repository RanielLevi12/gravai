/** Regras da entrevista sobre um banco abstrato (Supabase no app, memória nos testes). */
import type { FolderStyle } from "@/lib/folders/schema";
import { PROJECTS_LIMIT } from "@/lib/usage";
import { applyAnswer, changesScriptInputs, hasScript, nextAfter, validateEpisodes, EPISODES_STEP, type AnswerStep, type Episode, type Interview, type RouteStep } from "./steps";

export type InterviewProject = {
  id: string;
  title: string;
  source_kind: string;
  source_text: string;
  source_truncated: boolean;
  status: string;
  interview: Interview;
  series_id: string | null;
  episode_index: number | null;
  /** Projeto (pasta) do vídeo; nulo = vídeo solto. */
  folder_id?: string | null;
  /** "Sobre este projeto": contexto que a IA lê ao escrever título e script. */
  folder_about?: string | null;
  /** Estilo do projeto (tom, público, exemplos), de `folders.settings.style`. */
  folder_style?: FolderStyle | null;
};

export type NewEpisodeProject = Omit<InterviewProject, "id">;

export interface InterviewDb {
  getProject(id: string): Promise<InterviewProject | null>;
  /** Grava a entrevista inteira. `scriptStale` marca o script já gerado como desatualizado. false = projeto não encontrado. */
  saveInterview(id: string, interview: Interview, opts?: { scriptStale?: boolean }): Promise<boolean>;
  ctaIds(): Promise<string[]>;
  /** Quantos projetos ainda cabem na cota do mês (só leitura; quem consome é `insertProjects`). */
  remainingProjects(): Promise<number>;
  createSeries(title: string): Promise<string | null>;
  deleteSeries(id: string): Promise<void>;
  /** Liga o projeto à série como episódio 1, só se ele ainda não for de uma série. */
  claimForSeries(projectId: string, seriesId: string, patch: { title: string; interview: Interview }): Promise<boolean>;
  releaseSeries(projectId: string, original: { title: string; interview: Interview }): Promise<void>;
  /**
   * Insere os projetos e consome 1 projeto da cota por linha, na mesma transação do banco.
   * Devolve os ids na mesma ordem; "quota" = não coube (nada foi criado); null = falhou.
   */
  insertProjects(rows: NewEpisodeProject[]): Promise<string[] | "quota" | null>;
  seriesProjectIds(seriesId: string): Promise<string[]>;
}

export const MSG_NOT_FOUND = "Projeto não encontrado.";
const MSG_SAVE_FAILED = "Não foi possível salvar agora. Tente de novo.";
const MSG_SERIES_FAILED = "Não consegui criar a série. Tente de novo.";

export type SaveAnswerResult = { next: RouteStep } | { error: string };

/** Salva a resposta de um passo. Idempotente: reenviar o mesmo valor não muda nada. */
export async function saveAnswerWith(db: InterviewDb, projectId: string, step: AnswerStep, value: unknown): Promise<SaveAnswerResult> {
  const project = await db.getProject(projectId);
  if (!project) return { error: MSG_NOT_FOUND };
  if (step === "formato" && value === "single" && project.series_id) {
    return { error: "Este vídeo já faz parte de uma série." };
  }
  const ctaIds = step === "cta" ? await db.ctaIds() : [];
  const r = applyAnswer(project.interview ?? {}, step, value, { sourceText: project.source_text, ctaIds });
  if (!r.ok) return { error: r.error };
  // Respostas que o script usa mudaram depois de ele existir: a tela do script avisa e oferece "Gerar de novo".
  const scriptStale = hasScript(project.status) && changesScriptInputs(project.interview ?? {}, r.interview);
  if (!(await db.saveInterview(projectId, r.interview, scriptStale ? { scriptStale: true } : undefined))) return { error: MSG_SAVE_FAILED };
  return { next: r.next };
}

function quotaError(remaining: number): string {
  if (remaining <= 0) return `Você usou seus ${PROJECTS_LIMIT} projetos grátis deste mês.`;
  if (remaining === 1) return "Cabe só 1 episódio este mês.";
  return `Cabem só ${remaining} episódios este mês.`;
}

export type ConfirmSeriesResult = { ids: string[] } | { error: string };

/**
 * Cria a série: o projeto original vira o episódio 1 e cada episódio novo vira um projeto
 * (mesmo texto-fonte, mesmas respostas até aqui). A cota (1 projeto por episódio novo) é consumida
 * pelo banco junto com a criação dos episódios; se algo falhar, a série é desfeita e nada foi consumido.
 * Confirmar de novo (projeto já numa série) só devolve os ids existentes.
 */
export async function confirmSeriesWith(db: InterviewDb, projectId: string, input: unknown): Promise<ConfirmSeriesResult> {
  const v = validateEpisodes(input);
  if (!v.ok) return { error: v.error };
  const episodes: Episode[] = v.episodes;

  const project = await db.getProject(projectId);
  if (!project) return { error: MSG_NOT_FOUND };
  if (project.series_id) return { ids: await db.seriesProjectIds(project.series_id) };

  const extra = episodes.length - 1;
  // Recusa cedo e com a mensagem certa; a conferência definitiva é a do `insertProjects`.
  let remaining: number;
  try {
    remaining = await db.remainingProjects();
  } catch {
    return { error: MSG_SERIES_FAILED };
  }
  if (remaining < extra) return { error: quotaError(remaining) };

  const base: Interview = { ...(project.interview ?? {}), format: "series", episodes };
  const interview: Interview = { ...base, current: nextAfter(base, EPISODES_STEP) };
  let seriesId: string | null = null;
  let claimed = false;
  try {
    seriesId = await db.createSeries(project.title);
    if (!seriesId) throw new Error("series");
    claimed = await db.claimForSeries(project.id, seriesId, { title: episodes[0].title, interview });
    if (!claimed) {
      // Outra confirmação chegou antes: desfaz esta e devolve a que ficou.
      await db.deleteSeries(seriesId);
      seriesId = null;
      const now = await db.getProject(projectId);
      return now?.series_id ? { ids: await db.seriesProjectIds(now.series_id) } : { error: MSG_SERIES_FAILED };
    }
    const rows: NewEpisodeProject[] = episodes.slice(1).map((e, i) => ({
      title: e.title,
      source_kind: project.source_kind,
      source_text: project.source_text,
      source_truncated: project.source_truncated,
      status: "entrevista",
      interview,
      series_id: seriesId,
      episode_index: i + 2,
      folder_id: project.folder_id ?? null,
    }));
    const ids = await db.insertProjects(rows);
    if (ids === "quota") {
      await db.releaseSeries(project.id, { title: project.title, interview: project.interview ?? {} }).catch(() => undefined);
      await db.deleteSeries(seriesId).catch(() => undefined);
      return { error: quotaError(await db.remainingProjects().catch(() => 0)) };
    }
    if (!ids || ids.length !== rows.length) throw new Error("insert");
    return { ids: [project.id, ...ids] };
  } catch {
    if (claimed) await db.releaseSeries(project.id, { title: project.title, interview: project.interview ?? {} }).catch(() => undefined);
    if (seriesId) await db.deleteSeries(seriesId).catch(() => undefined);
    return { error: MSG_SERIES_FAILED };
  }
}
