import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { wakeWorker } from "@/lib/delivery/trigger";

// Chamado uma vez por dia pelo cron da Vercel (vercel.json): liga o worker, que ao ligar apaga os arquivos vencidos.
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  if (!secret || !given.startsWith("Bearer ")) return false;
  const a = Buffer.from(given.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  await wakeWorker();
  return NextResponse.json({ ok: true });
}
