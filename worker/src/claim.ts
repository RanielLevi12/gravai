import type { SupabaseClient } from "@supabase/supabase-js";

export type Db = SupabaseClient;

export type Job = {
  id: string;
  user_id: string;
  project_id: string;
  kind: "render" | "recut";
  payload: Record<string, unknown>;
  attempts: number;
};

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

/** Pega o pedido mais antigo da fila (o banco garante que dois workers não pegam o mesmo). */
export async function claimJob(db: Db): Promise<Job | null> {
  const { data, error } = await db.rpc("claim_job");
  check(error, "claim_job");
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as Job[];
  return rows[0] ?? null;
}

/** Devolve à fila (ou falha, na 3ª tentativa) os pedidos sem sinal de vida há mais de 10 min. */
export async function requeueStale(db: Db): Promise<number> {
  const { data, error } = await db.rpc("requeue_stale_jobs");
  check(error, "requeue_stale_jobs");
  return Number(data ?? 0);
}

export async function heartbeat(db: Db, jobId: string): Promise<void> {
  const { error } = await db.from("jobs").update({ heartbeat_at: new Date().toISOString() }).eq("id", jobId);
  check(error, "heartbeat");
}

export async function progress(db: Db, jobId: string, step: string, percent: number): Promise<void> {
  const { error } = await db
    .from("jobs")
    .update({ step, progress: Math.max(0, Math.min(100, Math.round(percent))), heartbeat_at: new Date().toISOString() })
    .eq("id", jobId);
  check(error, "progress");
}

export async function finish(db: Db, jobId: string, result: true | { error: string }): Promise<void> {
  const base = { finished_at: new Date().toISOString() };
  const patch = result === true ? { ...base, status: "done", progress: 100, step: null, error: null } : { ...base, status: "failed", error: result.error };
  const { error } = await db.from("jobs").update(patch).eq("id", jobId);
  check(error, "finish");
}
