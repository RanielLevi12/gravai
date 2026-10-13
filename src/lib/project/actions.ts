"use server";

import { createServerClient } from "@/lib/supabase/server";
import { nextStepHref } from "./next-step";
import { MAX_SOURCE_CHARS } from "./source";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SaveSourceResult = { ok: true; href: string } | { ok: false; error: string };

/**
 * Salva o texto-fonte revisado e avança o projeto para a entrevista.
 * Usa a sessão do usuário (RLS garante que o projeto é dele). Nunca rebaixa um projeto já adiante.
 */
export async function saveSource(projectId: string, text: string): Promise<SaveSourceResult> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { ok: false, error: "Projeto não encontrado." };
  const sourceText = typeof text === "string" ? text.trim() : "";
  if (!sourceText) return { ok: false, error: "Escreva ou cole algum texto para continuar." };
  if (sourceText.length > MAX_SOURCE_CHARS) return { ok: false, error: "Texto grande demais. Corte um pouco e tente de novo." };

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sua sessão expirou. Entre de novo." };

  const { data: project, error: readError } = await supabase
    .from("projects")
    .select("id, status, interview")
    .eq("id", projectId)
    .maybeSingle();
  if (readError) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  if (!project) return { ok: false, error: "Projeto não encontrado." };

  const status = project.status === "fonte" ? "entrevista" : project.status;
  const { error } = await supabase.from("projects").update({ source_text: sourceText, status }).eq("id", projectId);
  if (error) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };

  return { ok: true, href: nextStepHref({ id: projectId, status, interview: project.interview }) };
}
