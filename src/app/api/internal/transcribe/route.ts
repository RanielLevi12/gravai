import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { withUserAi } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";

// A transcrição pode demorar; abaixo do limite das funções da Vercel.
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

type Word = { w: string; s: number; e: number };

function authorized(req: Request): boolean {
  const secret = process.env.WORKER_SECRET;
  const given = req.headers.get("authorization") ?? "";
  if (!secret || !given.startsWith("Bearer ")) return false;
  const a = Buffer.from(given.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const notFound = () => NextResponse.json({ error: "Não encontrado." }, { status: 404 });

/**
 * O worker manda o áudio do take único (mp3, no corpo) e recebe as palavras com tempo.
 * A IA usada é a conta do dono do pedido; o resultado fica em `transcripts` e não é pago duas vezes.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const url = new URL(req.url);
  const jobId = url.searchParams.get("job") ?? "";
  const recordingId = url.searchParams.get("recording") ?? "";
  if (!UUID.test(jobId) || !UUID.test(recordingId)) return notFound();

  const db = createAdminClient();
  const { data: job } = await db.from("jobs").select("id, user_id, project_id, status").eq("id", jobId).maybeSingle();
  if (!job || job.status !== "running") return notFound();
  const { data: rec } = await db
    .from("recordings")
    .select("id, kind, status")
    .eq("id", recordingId)
    .eq("project_id", job.project_id)
    .maybeSingle();
  if (!rec || rec.kind !== "take" || rec.status !== "ready") return notFound();

  const { data: cached } = await db.from("transcripts").select("words").eq("recording_id", recordingId).maybeSingle();
  if (cached) return NextResponse.json({ words: cached.words as Word[] });

  const audio = Buffer.from(await req.arrayBuffer());
  if (audio.length === 0) return NextResponse.json({ error: "Áudio vazio." }, { status: 400 });
  if (audio.length > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Áudio grande demais." }, { status: 413 });

  try {
    const ai = await withUserAi(job.user_id);
    const { words } = await ai.transcribeWords(audio, "audio.mp3");
    const { error } = await db
      .from("transcripts")
      .upsert({ recording_id: recordingId, user_id: job.user_id, project_id: job.project_id, words }, { onConflict: "recording_id" });
    if (error) throw new Error("gravar transcrição");
    return NextResponse.json({ words });
  } catch (e) {
    console.error("[transcribe] falhou", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui transcrever o áudio." }, { status: 502 });
  }
}
