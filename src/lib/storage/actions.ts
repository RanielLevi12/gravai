"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { deleteProjectWith } from "./cleanup";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Apaga o vídeo e todos os arquivos dele (gravações e vídeos gerados). Devolve o espaço à cota. */
export async function deleteProject(projectId: string): Promise<{ ok: true } | { error: string }> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { error: "Projeto não encontrado." };
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Sua sessão expirou. Entre de novo." };
  try {
    if (!(await deleteProjectWith(supabase, projectId))) return { error: "Projeto não encontrado." };
  } catch (e) {
    console.error("[storage] apagar projeto falhou", e instanceof Error ? e.message : e);
    return { error: "Não foi possível agora. Tente de novo." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
