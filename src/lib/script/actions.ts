"use server";

import { checkScript, withUserAi } from "@/lib/ai";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseScriptDb } from "./db";
import { generateScriptWith } from "./generate";

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
    { db: supabaseScriptDb({ supabase, userId }), ai: () => withUserAi(userId), check: checkScript },
    projectId,
  );
}
