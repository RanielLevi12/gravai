import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptKey } from "./keys";

export const OPENROUTER_KEY_INFO_URL = "https://openrouter.ai/api/v1/key";

const MAX_KEY = 300;

/** Só o formato que o OpenRouter usa nas chaves; a conferência de verdade é a chamada à API. */
export function looksLikeOpenRouterKey(raw: string): boolean {
  return raw.length >= 20 && raw.length <= MAX_KEY && raw.startsWith("sk-or-") && !/\s/.test(raw);
}

/** Cifra e grava a chave do usuário (uma por usuário). Devolve false se não deu para cifrar ou gravar; nunca loga a chave. */
export async function saveUserAiKey(userId: string, key: string): Promise<boolean> {
  let keyCiphertext: string;
  try {
    keyCiphertext = encryptKey(key);
  } catch {
    console.warn("[ai] não foi possível cifrar a chave de IA (segredo de cifra indisponível)");
    return false;
  }
  const { error } = await createAdminClient()
    .from("ai_connections")
    .upsert(
      { user_id: userId, provider: "openrouter", key_ciphertext: keyCiphertext, key_hint: key.slice(-4), created_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) console.warn("[ai] falha ao gravar conexão de IA");
  return !error;
}

/** Pergunta ao OpenRouter se a chave vale: "ok", "invalid" (recusada) ou "unavailable" (sem resposta útil). */
export async function checkOpenRouterKey(key: string, doFetch: typeof fetch = fetch): Promise<"ok" | "invalid" | "unavailable"> {
  try {
    const res = await doFetch(OPENROUTER_KEY_INFO_URL, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    if (res.ok) return "ok";
    if (res.status === 401 || res.status === 403) return "invalid";
    console.warn(`[ai] conferência da chave OpenRouter: ${res.status}`);
    return "unavailable";
  } catch {
    console.warn("[ai] conferência da chave OpenRouter falhou");
    return "unavailable";
  }
}
