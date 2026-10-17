"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { isTrashKind } from "./rules";
import { purgeWith, restoreWith, trashWith } from "./service";

type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run(kind: unknown, id: unknown, op: "trash" | "restore" | "purge"): Promise<Result> {
  if (!isTrashKind(kind) || typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "Item não encontrado." };
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  try {
    const done = op === "trash" ? await trashWith(supabase, kind, id) : op === "restore" ? await restoreWith(supabase, kind, id) : await purgeWith(supabase, kind, id);
    if (!done) return { ok: false, error: "Item não encontrado." };
  } catch (e) {
    console.error(`[lixeira] ${op} falhou`, e instanceof Error ? e.message : e);
    return { ok: false, error: "Não foi possível agora. Tente de novo." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moverParaLixeira(kind: unknown, id: unknown): Promise<Result> {
  return run(kind, id, "trash");
}

export async function restaurar(kind: unknown, id: unknown): Promise<Result> {
  return run(kind, id, "restore");
}

export async function apagarDeVez(kind: unknown, id: unknown): Promise<Result> {
  return run(kind, id, "purge");
}
