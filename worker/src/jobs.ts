import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { finish, heartbeat, type Db, type Job } from "./claim";
import { UserError } from "./errors";
import { renderProject } from "./render";

const HEARTBEAT_MS = 30_000;
const MSG_FAILED = "Não foi possível gerar os vídeos. Tente de novo.";

export type JobContext = { db: Db; job: Job; workdir: string };
type Handler = (ctx: JobContext) => Promise<void>;

/** Um tratador por tipo de pedido; `recut` entra na Tarefa 8. */
const handlers: Partial<Record<Job["kind"], Handler>> = { render: renderProject };

/** Processa um pedido já pego: roda o tratador, mantém o sinal de vida e grava o resultado. */
export async function handle(db: Db, job: Job): Promise<void> {
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
    await finish(db, job.id, { error: e instanceof UserError ? e.message : MSG_FAILED }).catch(() => {});
  } finally {
    clearInterval(beat);
    await rm(workdir, { recursive: true, force: true });
  }
}
