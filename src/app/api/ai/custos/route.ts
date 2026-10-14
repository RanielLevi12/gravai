import { NextResponse } from "next/server";
import { loadCostSummary } from "@/lib/ai/cost";
import { createServerClient } from "@/lib/supabase/server";

/** Resumo de custos de IA do usuário logado (barra fixa do app). Nunca devolve a chave. */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const summary = await loadCostSummary(supabase, user.id);
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
