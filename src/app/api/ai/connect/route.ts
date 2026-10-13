import { NextResponse, type NextRequest } from "next/server";
import { createPkce, OPENROUTER_AUTH_URL, setOAuthCookie } from "@/lib/ai/oauth";
import { createServerClient } from "@/lib/supabase/server";

/** Inicia o OAuth PKCE do OpenRouter para o usuário logado. */
export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { verifier, challenge, state } = createPkce();
  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set("callback_url", new URL("/api/ai/callback", request.nextUrl.origin).toString());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("key_label", "Gravai");

  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  try {
    setOAuthCookie(res, user.id, verifier, state);
  } catch {
    // AI_KEY_ENCRYPTION_SECRET ausente ou inválido: não dá para assinar o cookie.
    console.warn("[ai] não foi possível iniciar a conexão de IA (segredo de cifra indisponível)");
    const erro = NextResponse.redirect(new URL("/perfil?ia=erro", request.nextUrl.origin), 303);
    erro.headers.set("Cache-Control", "no-store");
    return erro;
  }
  return res;
}
