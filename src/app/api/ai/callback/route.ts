import { NextResponse, type NextRequest } from "next/server";
import { encryptKey } from "@/lib/ai/keys";
import { clearOAuthCookie, OAUTH_COOKIE, OPENROUTER_KEYS_URL, readOAuthCookie, sameString } from "@/lib/ai/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Volta do OpenRouter: confere sessão, cookie assinado (mesmo usuário) e state;
 * troca code + verifier pela chave; grava só a chave cifrada. Destino sempre fixo (/perfil).
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const done = (result: "conectada" | "erro") => {
    const res = NextResponse.redirect(new URL(`/perfil?ia=${result}`, origin), 303);
    res.headers.set("Cache-Control", "no-store");
    clearOAuthCookie(res);
    return res;
  };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const saved = readOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  if (!code || !state || !saved || saved.userId !== user.id || !sameString(state, saved.state)) {
    return done("erro");
  }

  let key: unknown;
  try {
    const res = await fetch(OPENROUTER_KEYS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: saved.verifier, code_challenge_method: "S256" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[ai] troca do código OpenRouter recusada: ${res.status}`);
      return done("erro");
    }
    key = ((await res.json()) as { key?: unknown }).key;
  } catch {
    console.warn("[ai] troca do código OpenRouter falhou");
    return done("erro");
  }
  if (typeof key !== "string" || key.length < 8) return done("erro");

  const { error } = await createAdminClient()
    .from("ai_connections")
    .upsert(
      {
        user_id: user.id,
        provider: "openrouter",
        key_ciphertext: encryptKey(key),
        key_hint: key.slice(-4),
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.warn("[ai] falha ao gravar conexão de IA");
    return done("erro");
  }
  return done("conectada");
}
