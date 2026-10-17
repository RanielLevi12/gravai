"use server";

import { createServerClient } from "@/lib/supabase/server";
import { supabaseVersionDb } from "./versions-db";
import { restoreVersionWith, saveVersionWith } from "./versions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function db() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabaseVersionDb({ supabase }) : null;
}

/** Guarda o texto de antes de uma reescrita. Falhar não atrapalha: a tela segue com o histórico da sessão. */
export async function saveVersion(blockId: string, text: string): Promise<boolean> {
  if (typeof blockId !== "string" || !UUID.test(blockId)) return false;
  try {
    const d = await db();
    return d ? await saveVersionWith(d, blockId, text) : false;
  } catch {
    return false;
  }
}

/** Tira a versão mais nova do histórico (a tela já a aplicou ao texto). */
export async function discardLatestVersion(blockId: string): Promise<boolean> {
  if (typeof blockId !== "string" || !UUID.test(blockId)) return false;
  try {
    const d = await db();
    if (!d) return false;
    await restoreVersionWith(d, blockId);
    return true;
  } catch {
    return false;
  }
}

/** Gerar o script de novo troca os textos: o histórico antigo não vale mais. */
export async function clearVersions(projectId: string): Promise<void> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return;
  try {
    await (await db())?.clearProject(projectId);
  } catch {
    // histórico é só conforto; ignorar
  }
}
