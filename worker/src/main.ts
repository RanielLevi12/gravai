import { createClient } from "@supabase/supabase-js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { claimJob, finish, heartbeat, requeueStale, type Db, type Job } from "./claim";

const POLL_MS = 5_000;
const IDLE_EXIT_MS = 60_000;
const HEARTBEAT_MS = 30_000;
const MSG_FAILED = "Não foi possível gerar os vídeos. Tente de novo.";

export type JobContext = { db: Db; job: Job; workdir: string };
type Handler = (ctx: JobContext) => Promise<void>;

/** Um tratador por tipo de pedido; entram nas próximas tarefas (render, recut). */
const handlers: Partial<Record<Job["kind"], Handler>> = {};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta a variável ${name}`);
  return v;
}

async function handle(db: Db, job: Job): Promise<void> {
  const workdir = await mkdtemp(path.join(tmpdir(), `gravai-${job.id}-`));
  const beat = setInterval(() => heartbeat(db, job.id).catch((e) => console.error("[worker] heartbeat", e.message)), HEARTBEAT_MS);
  try {
    const handler = handlers[job.kind];
    if (!handler) return await finish(db, job.id, { error: "Este tipo de pedido ainda não é suportado." });
    await handler({ db, job, workdir });
    await finish(db, job.id, true);
  } catch (e) {
    // Mensagem técnica só no log do servidor; o usuário vê um texto simples.
    console.error(`[worker] pedido ${job.id} falhou:`, e instanceof Error ? e.message : e);
    await finish(db, job.id, { error: MSG_FAILED }).catch(() => {});
  } finally {
    clearInterval(beat);
    await rm(workdir, { recursive: true, force: true });
  }
}

async function main() {
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  let idleSince = Date.now();
  for (;;) {
    await requeueStale(db);
    const job = await claimJob(db);
    if (job) {
      await handle(db, job);
      idleSince = Date.now();
      continue;
    }
    if (Date.now() - idleSince > IDLE_EXIT_MS) break; // sem trabalho: a máquina do Fly desliga
    await sleep(POLL_MS);
  }
}

main().catch((e) => {
  console.error("[worker] parou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
