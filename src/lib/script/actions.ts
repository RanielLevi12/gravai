"use server";

import { revalidatePath } from "next/cache";
import { AiError, checkScript, reviewExcerpts, scoreClosing, scoreHooks, withUserAi } from "@/lib/ai";
import { createServerClient } from "@/lib/supabase/server";
import type { Cut } from "./cuts";
import { cutsWarnings, saveCutsWith, suggestCutsWith } from "./cuts-generate";
import { supabaseBlockDb, supabaseCutsDb, supabaseScriptDb } from "./db";
import { generateScriptWith } from "./generate";
import { MSG_BLOCK_NOT_FOUND, rewriteBlockWith, updateBlockTextWith, type RewriteMode } from "./rewrite";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gera (ou regera) o script e as descrições do projeto. Erros da IA (`AiError`, inclusive
 * `not_connected`) e de salvamento sobem para quem chama tratar.
 */
export async function generateScript(projectId: string): Promise<void> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) throw new Error("Projeto não encontrado.");
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sua sessão expirou. Entre de novo.");
  const userId = data.user.id;
  await generateScriptWith(
    { db: supabaseScriptDb({ supabase, userId }), ai: () => withUserAi(userId), check: checkScript, review: reviewExcerpts, agents: { scoreHook: scoreHooks, scoreClosing } },
    projectId,
  );
}

const MSG_EXPIRED = "Sua sessão expirou. Entre de novo.";
const MSG_UNAVAILABLE = "Não foi possível agora. Tente de novo.";

export type ActionError = { error: string; notConnected?: boolean };

/** Erros de ações voltam como valor: em produção o Next esconde a mensagem de um erro lançado. */
function failure(e: unknown): ActionError {
  if (e instanceof AiError) return { error: e.userMessage, ...(e.code === "not_connected" ? { notConnected: true } : {}) };
  console.error("[script] ação falhou", e instanceof Error ? e.message : e);
  return { error: e instanceof Error && e.message === MSG_BLOCK_NOT_FOUND ? e.message : MSG_UNAVAILABLE };
}

async function sessionUser() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, userId: data.user.id } : null;
}

/** Autosave do texto de um bloco (o cliente chama com debounce de 800 ms). */
export async function updateBlockText(blockId: string, text: string): Promise<{ ok: true } | ActionError> {
  if (typeof blockId !== "string" || !UUID.test(blockId)) return { error: MSG_BLOCK_NOT_FOUND };
  const s = await sessionUser();
  if (!s) return { error: MSG_EXPIRED };
  try {
    await updateBlockTextWith(supabaseBlockDb({ supabase: s.supabase }), blockId, text);
    // Sem isso, voltar pelo navegador reabre a tela com o texto de antes (cache do roteador do cliente).
    revalidatePath("/(app)/projetos/[id]/script", "page");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/** Reescreve só aquele bloco; devolve o novo texto sem gravar (o autosave do cliente grava). */
export async function rewriteBlock(blockId: string, mode: RewriteMode): Promise<{ text: string } | ActionError> {
  if (typeof blockId !== "string" || !UUID.test(blockId)) return { error: MSG_BLOCK_NOT_FOUND };
  const s = await sessionUser();
  if (!s) return { error: MSG_EXPIRED };
  try {
    return await rewriteBlockWith({ db: supabaseBlockDb({ supabase: s.supabase }), ai: () => withUserAi(s.userId) }, blockId, mode);
  } catch (e) {
    return failure(e);
  }
}

/** Gera o script de novo, substituindo o atual (a confirmação é feita na tela). */
export async function regenerateScript(projectId: string): Promise<{ ok: true; texts: Record<string, string> } | ActionError> {
  try {
    await generateScript(projectId);
    // Os textos novos voltam na resposta: o cliente troca a tela por eles sem depender de a página refazer.
    const supabase = await createServerClient();
    const { data } = await supabase.from("script_blocks").select("id, text").eq("project_id", projectId);
    revalidatePath(`/projetos/${projectId}/script`);
    return { ok: true, texts: Object.fromEntries((data ?? []).map((b) => [b.id, b.text])) };
  } catch (e) {
    return failure(e);
  }
}

/** A IA sugere os cortes do script (substitui os atuais). Devolve a lista nova. */
export async function suggestCuts(projectId: string): Promise<{ cuts: Cut[]; warnings: string[] } | ActionError> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { error: "Projeto não encontrado." };
  const s = await sessionUser();
  if (!s) return { error: MSG_EXPIRED };
  try {
    const db = supabaseCutsDb({ supabase: s.supabase });
    const cuts = await suggestCutsWith({ db, ai: () => withUserAi(s.userId) }, projectId);
    const warnings = await cutsWarnings(db, projectId, cuts, reviewExcerpts);
    revalidatePath("/(app)/projetos/[id]/script", "page");
    return { cuts, warnings };
  } catch (e) {
    return failure(e);
  }
}

/** Salva os cortes ajustados ou marcados à mão pelo usuário. */
export async function saveCuts(projectId: string, input: unknown): Promise<{ cuts: Cut[] } | ActionError> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { error: "Projeto não encontrado." };
  const s = await sessionUser();
  if (!s) return { error: MSG_EXPIRED };
  try {
    const r = await saveCutsWith(supabaseCutsDb({ supabase: s.supabase }), projectId, input);
    if (!r.ok) return { error: r.error };
    revalidatePath("/(app)/projetos/[id]/script", "page");
    return { cuts: r.cuts };
  } catch (e) {
    return failure(e);
  }
}
