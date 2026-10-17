"use server";

import { revalidatePath } from "next/cache";
import { isInheritedStep, projectValue } from "@/lib/folders/inherit";
import { toSettings } from "@/lib/folders/queries";
import { scoreViral, withUserAi } from "@/lib/ai";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseInterviewDb } from "./db";
import { confirmSeriesWith, saveAnswerWith, type ConfirmSeriesResult, type SaveAnswerResult } from "./service";
import { STEP_FIELD, type AnswerStep, type Interview, type InterviewSuggestion, type StepValues, type TitleOption } from "./steps";
import { loadSuggestion, suggestInterviewWith, suggestTitlesWith, type SuggestDeps } from "./suggest";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPIRED = "Sua sessão expirou. Entre de novo.";
const NOT_FOUND = "Projeto não encontrado.";

async function session() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const userId = data.user.id;
  const db = supabaseInterviewDb({ supabase });
  const deps: SuggestDeps = {
    db,
    ai: () => withUserAi(userId),
    profile: async () => {
      const { data: p } = await supabase.from("profiles").select("niche, audience, tone").maybeSingle();
      return p;
    },
  };
  return { db, deps };
}

const isAnswerStep = (s: unknown): s is AnswerStep => typeof s === "string" && Object.hasOwn(STEP_FIELD, s);

/**
 * Salva a resposta de um passo e devolve o próximo. Idempotente (mesmo valor → mesmo estado);
 * zera `cutSeconds` se a nova duração o tornar inválido.
 */
export async function saveAnswer<S extends AnswerStep>(projectId: string, step: S, value: StepValues[S]): Promise<SaveAnswerResult> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { error: NOT_FOUND };
  if (!isAnswerStep(step)) return { error: "Passo inválido." };
  const s = await session();
  if (!s) return { error: EXPIRED };
  try {
    const r = await saveAnswerWith(s.db, projectId, step, value);
    // Voltar pelo navegador precisa mostrar a resposta salva, não a página guardada no cache do cliente.
    if ("next" in r) revalidatePath(`/projetos/${projectId}`, "layout");
    return r;
  } catch {
    return { error: "Não foi possível salvar agora. Tente de novo." };
  }
}

/** "Voltar ao padrão do projeto": regrava uma resposta do vídeo com o valor atual do projeto. */
export async function resetToProjectDefault(projectId: string, step: unknown): Promise<{ ok: true } | { error: string }> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { error: NOT_FOUND };
  if (!isInheritedStep(step)) return { error: "Passo inválido." };
  const s = await session();
  if (!s) return { error: EXPIRED };
  try {
    const project = await s.db.getProject(projectId);
    if (!project) return { error: NOT_FOUND };
    if (!project.folder_id) return { error: "Este vídeo não está num projeto." };
    const supabase = await createServerClient();
    const { data: folder } = await supabase.from("folders").select("settings").eq("id", project.folder_id).maybeSingle();
    if (!folder) return { error: "Projeto não encontrado." };
    const r = await saveAnswerWith(s.db, projectId, step, projectValue(step, toSettings(folder.settings)));
    if ("error" in r) return r;
    revalidatePath(`/projetos/${projectId}`, "layout");
    return { ok: true };
  } catch {
    return { error: "Não foi possível voltar ao padrão agora. Tente de novo." };
  }
}

/** Cria a série (o projeto atual vira o episódio 1) e devolve os ids dos episódios. */
export async function confirmSeries(projectId: string, episodes: { title: string; summary: string }[]): Promise<ConfirmSeriesResult> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { error: NOT_FOUND };
  const s = await session();
  if (!s) return { error: EXPIRED };
  try {
    const r = await confirmSeriesWith(s.db, projectId, episodes);
    if ("ids" in r) revalidatePath("/projetos", "layout");
    return r;
  } catch {
    return { error: "Não consegui criar a série. Tente de novo." };
  }
}

/** Sugestão da entrevista pela IA do usuário. Sem IA conectada lança AiError code 'not_connected'. */
export async function suggestInterview(projectId: string): Promise<InterviewSuggestion> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) throw new Error(NOT_FOUND);
  const s = await session();
  if (!s) throw new Error(EXPIRED);
  return suggestInterviewWith(s.deps, projectId);
}

/** Sugestão para a página da entrevista: a salva, ou uma tentativa única (falha não é repetida). */
export async function loadInterviewSuggestion(
  projectId: string,
  interview: Interview,
): Promise<{ suggestion: InterviewSuggestion | null; noAi: boolean }> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) throw new Error(NOT_FOUND);
  const s = await session();
  if (!s) throw new Error(EXPIRED);
  return loadSuggestion(s.deps, projectId, interview);
}

/** 3 títulos de tipos diferentes (agente de títulos), com nota do jev; o melhor vem primeiro. */
export async function suggestTitles(projectId: string): Promise<TitleOption[]> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) throw new Error(NOT_FOUND);
  const s = await session();
  if (!s) throw new Error(EXPIRED);
  return suggestTitlesWith({ ...s.deps, score: scoreViral }, projectId);
}
