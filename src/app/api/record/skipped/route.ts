import { NextResponse } from "next/server";
import { withUserAi } from "@/lib/ai";
import { labelBlocks } from "@/lib/record/missing";
import { findSkipped } from "@/lib/record/skipped";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Limite de corpo das funções da Vercel é 4,5 MB; o navegador manda um WAV pequeno (ver lib/record/wav.ts).
const MAX_AUDIO_BYTES = 4.5 * 1024 * 1024;

/**
 * Take único, antes de aprovar: transcreve só o áudio e diz quais blocos do script parecem pulados.
 * Nunca bloqueia: sem IA, sem cota ou com erro, devolve lista vazia (o aviso simplesmente não aparece).
 * A transcrição fica em `transcripts`, então o worker não paga de novo.
 */
export async function POST(req: Request) {
  const none = () => NextResponse.json({ skipped: [] });
  const url = new URL(req.url);
  const projectId = url.searchParams.get("project") ?? "";
  const recordingId = url.searchParams.get("recording") ?? "";
  if (!UUID.test(projectId) || !UUID.test(recordingId)) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: rec } = await supabase.from("recordings").select("id, kind").eq("id", recordingId).eq("project_id", projectId).maybeSingle();
  if (!rec || rec.kind !== "take") return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  try {
    const audio = Buffer.from(await req.arrayBuffer());
    if (audio.length === 0 || audio.length > MAX_AUDIO_BYTES) return none();

    const { data: rows } = await supabase.from("script_blocks").select("id, kind, cut_index, text").eq("project_id", projectId).order("position");
    const blocks = rows ?? [];
    if (blocks.length < 2) return none();
    const labels = labelBlocks(blocks);

    const { words } = await (await withUserAi(auth.user.id)).transcribeWords(audio, "audio.wav");
    // Guarda para o worker reaproveitar (mesma linha do tempo do vídeo). Falhar aqui não atrapalha o aviso.
    await createAdminClient()
      .from("transcripts")
      .upsert({ recording_id: recordingId, user_id: auth.user.id, project_id: projectId, words }, { onConflict: "recording_id" });

    const skipped = findSkipped(blocks.map((b, i) => ({ id: b.id, label: labels[i].label, text: b.text })), words);
    return NextResponse.json({ skipped });
  } catch (e) {
    console.error("[skipped] sem aviso", e instanceof Error ? e.message : e);
    return none();
  }
}
