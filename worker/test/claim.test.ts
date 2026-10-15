import { createClient } from "@supabase/supabase-js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { claimJob, finish, heartbeat, progress, requeueStale } from "../src/claim";
import { download, upload } from "../src/storage";

// Precisa do Supabase local: rode com o ambiente de `supabase status` (ver README).
const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(URL ?? "http://127.0.0.1:58321", SERVICE ?? "x", { auth: { persistSession: false } });

let userId: string;

async function newJob(extra: Record<string, unknown> = {}) {
  const { data: p, error } = await db
    .from("projects")
    .insert({ user_id: userId, title: "Vídeo", source_kind: "text", source_text: "texto", status: "gravado" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: j, error: e2 } = await db
    .from("jobs")
    .insert({ user_id: userId, project_id: p.id, kind: "render", ...extra })
    .select("id, project_id")
    .single();
  if (e2) throw e2;
  return j;
}

describe.skipIf(!URL || !SERVICE)("fila de pedidos", () => {
  beforeAll(async () => {
    const { data, error } = await db.auth.admin.createUser({ email: `worker-${crypto.randomUUID()}@teste.local`, password: "senha-de-teste-123", email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  });

  it("dois workers ao mesmo tempo: só um pega o pedido", async () => {
    await db.from("jobs").update({ status: "done" }).eq("status", "queued");
    const job = await newJob();
    const [a, b] = await Promise.all([claimJob(db), claimJob(db)]);
    const got = [a, b].filter((j) => j !== null);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ id: job.id, kind: "render", attempts: 1 });
  });

  it("sem pedido na fila devolve null", async () => {
    await db.from("jobs").update({ status: "done" }).eq("status", "queued");
    expect(await claimJob(db)).toBeNull();
  });

  it("andamento, sinal de vida e fim", async () => {
    await db.from("jobs").update({ status: "done" }).eq("status", "queued");
    const job = await newJob();
    await claimJob(db);
    await progress(db, job.id, "cortando", 40.4);
    await heartbeat(db, job.id);
    let { data } = await db.from("jobs").select("status, step, progress").eq("id", job.id).single();
    expect(data).toEqual({ status: "running", step: "cortando", progress: 40 });

    await finish(db, job.id, true);
    ({ data } = await db.from("jobs").select("status, step, progress").eq("id", job.id).single());
    expect(data).toEqual({ status: "done", step: null, progress: 100 });

    const other = await newJob();
    await finish(db, other.id, { error: "Faltam gravações nos blocos: 2." });
    const { data: failed } = await db.from("jobs").select("status, error").eq("id", other.id).single();
    expect(failed).toEqual({ status: "failed", error: "Faltam gravações nos blocos: 2." });
  });

  it("pedido parado volta à fila", async () => {
    const stale = new Date(Date.now() - 11 * 60_000).toISOString();
    const job = await newJob({ status: "running", attempts: 1, heartbeat_at: stale });
    expect(await requeueStale(db)).toBeGreaterThanOrEqual(1);
    const { data } = await db.from("jobs").select("status").eq("id", job.id).single();
    expect(data?.status).toBe("queued");
    await db.from("jobs").update({ status: "done" }).eq("id", job.id);
  });

  it("sobe um arquivo para exports e baixa de volta", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "gravai-storage-"));
    const src = path.join(dir, "a.mp4");
    writeFileSync(src, "conteudo");
    const remote = `${userId}/teste/${crypto.randomUUID()}.mp4`;
    expect(await upload(db, remote, src, "video/mp4")).toEqual({ sizeBytes: 8 });
    const back = path.join(dir, "b.mp4");
    await download(db, "exports", remote, back);
    expect((await import("node:fs")).readFileSync(back, "utf8")).toBe("conteudo");
    await db.storage.from("exports").remove([remote]);
  });
});
