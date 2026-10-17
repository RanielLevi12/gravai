import { NextResponse } from "next/server";
import { supabaseRecordDb } from "@/lib/record/db";
import { createServerClient } from "@/lib/supabase/server";
import { getR2 } from "./r2";
import { UploadError } from "./upload";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Casca comum das rotas de envio: confere o login, lê o JSON e traduz erros em mensagens simples. */
export async function uploadRoute(
  req: Request,
  run: (ctx: { deps: { db: ReturnType<typeof supabaseRecordDb>; r2: ReturnType<typeof getR2> }; body: Record<string, unknown>; recordingId: string }) => Promise<unknown>,
) {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const recordingId = body?.recordingId;
  if (!body || typeof recordingId !== "string" || !UUID.test(recordingId)) return NextResponse.json({ error: "Gravação não encontrada." }, { status: 404 });
  try {
    const out = await run({ deps: { db: supabaseRecordDb({ supabase, userId: data.user.id }), r2: getR2() }, body, recordingId });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[upload] falhou", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível agora. Tente de novo." }, { status: 500 });
  }
}
