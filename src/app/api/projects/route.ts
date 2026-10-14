import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createProject } from "@/lib/ingest/create";

// Chamadas de IA nesta rota/página (e nas ações que ela usa): os timeouts de src/lib/ai/openrouter.ts cabem aqui.
export const maxDuration = 300;

/** Mesma origem que o host atendido (proteção CSRF). */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || (request.headers.get("host") ?? request.nextUrl.host);
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const { status, body } = await createProject({ supabase, userId: user.id }, form);
  return NextResponse.json(body, { status });
}
