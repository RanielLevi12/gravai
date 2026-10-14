"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { checkOpenRouterKey, looksLikeOpenRouterKey, saveUserAiKey } from "./connection";

/** Conecta a IA com uma chave colada. A chave é conferida no OpenRouter, guardada cifrada e nunca volta ao navegador. */
export async function connectWithKey(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Sua sessão expirou. Entre de novo." };

  const key = typeof input === "string" ? input.trim() : "";
  if (!looksLikeOpenRouterKey(key)) return { ok: false, error: "Essa chave não parece certa. Ela começa com sk-or- e é copiada inteira do OpenRouter." };

  // Com AI_MOCK=1 (testes, nunca em produção) não há conta real para conferir.
  const mock = process.env.AI_MOCK === "1" && process.env.NODE_ENV !== "production";
  const status = mock ? "ok" : await checkOpenRouterKey(key);
  if (status === "invalid") return { ok: false, error: "O OpenRouter não aceitou essa chave. Confira se copiou inteira e se ela está ativa." };
  if (status === "unavailable") return { ok: false, error: "Não consegui falar com o OpenRouter agora. Tente de novo em instantes." };

  if (!(await saveUserAiKey(data.user.id, key))) return { ok: false, error: "Não foi possível guardar a chave agora. Tente de novo." };
  revalidatePath("/perfil");
  return { ok: true };
}
