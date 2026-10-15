import { NextResponse } from "next/server";
import { supabaseDeliveryDb } from "@/lib/delivery/db";
import { MSG_PROJECT_NOT_FOUND } from "@/lib/delivery/service";
import { ZipError, zipFor } from "@/lib/delivery/zip";
import { createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  if (!UUID.test(id)) return NextResponse.json({ error: MSG_PROJECT_NOT_FOUND }, { status: 404 });
  try {
    const zip = await zipFor(supabaseDeliveryDb({ supabase }), id);
    // Em stream: respostas normais da Vercel passam de no máx. 4,5 MB; as em stream não têm esse teto.
    return new Response(new Blob([zip as BlobPart]).stream(), {
      headers: {
        "content-type": "application/zip",
        "content-length": String(zip.byteLength),
        "content-disposition": 'attachment; filename="gravai-videos.zip"',
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ZipError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[delivery] zip falhou", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível agora. Tente de novo." }, { status: 500 });
  }
}
