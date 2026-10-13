import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** Mesma origem que o host atendido (proteção CSRF do POST do formulário). */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Apaga a conexão de IA do usuário (RLS: só a própria linha). */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { error } = await supabase.from("ai_connections").delete().eq("user_id", user.id);
  // ?ia=desconectada: o Perfil orienta a apagar a chave antiga no OpenRouter (não revogamos pela API).
  const dest = error ? "/perfil?ia=erro" : "/perfil?ia=desconectada";
  return NextResponse.redirect(new URL(dest, request.nextUrl.origin), 303);
}
