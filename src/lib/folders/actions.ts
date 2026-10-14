"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { validateFolderInput } from "./schema";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireUser() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sessão expirada. Entre de novo.");
  return { supabase, userId: data.user.id };
}

async function parse(supabase: Awaited<ReturnType<typeof createServerClient>>, userId: string, input: unknown) {
  const { data } = await supabase.from("ctas").select("id").eq("user_id", userId);
  return validateFolderInput(
    input,
    (data ?? []).map((c) => c.id as string),
  );
}

function refresh(id?: string) {
  // Route group: o padrão precisa do segmento `(app)`.
  revalidatePath("/(app)/projetos", "page");
  if (id) revalidatePath("/(app)/pastas/[id]", "page");
}

/** Cria o projeto (pasta). Vídeos existentes não mudam. */
export async function createFolder(input: unknown): Promise<Result<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = await parse(supabase, userId, input);
  if (!parsed.ok) return parsed;
  const { name, color, about, settings } = parsed.value;
  const { data, error } = await supabase.from("folders").insert({ name, color, about, settings }).select("id").single();
  if (error || !data) return { ok: false, error: "Não foi possível criar o projeto." };
  refresh();
  return { ok: true, id: data.id as string };
}

/** Edita o projeto. Vale só para vídeos novos: os que já existem guardam a própria cópia. */
export async function updateFolder(id: string, input: unknown): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const parsed = await parse(supabase, userId, input);
  if (!parsed.ok) return parsed;
  const { name, color, about, settings } = parsed.value;
  const { data, error } = await supabase.from("folders").update({ name, color, about, settings }).eq("id", id).select("id");
  if (error || (data?.length ?? 0) !== 1) return { ok: false, error: "Não foi possível salvar o projeto." };
  refresh(id);
  return { ok: true };
}

/** Apaga o projeto. Os vídeos dele viram soltos (o banco faz `on delete set null`). */
export async function deleteFolder(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("folders").delete().eq("id", id).select("id");
  if (error || (data?.length ?? 0) !== 1) return { ok: false, error: "Não foi possível apagar o projeto." };
  refresh(id);
  return { ok: true };
}
