import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:58321";
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);

type U = { id: string; client: SupabaseClient };

async function newUser(tag: string): Promise<U> {
  const email = `${tag}-${crypto.randomUUID()}@teste.local`;
  const password = "senha-de-teste-123";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(URL, ANON, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, client };
}

// Insere direto (service role) para não esbarrar na cota mensal de projetos.
async function newProject(u: U, status = "gravado"): Promise<string> {
  const { data, error } = await admin
    .from("projects")
    .insert({ user_id: u.id, title: "Vídeo", source_kind: "text", source_text: "texto", status })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert project");
  return data.id;
}

const exportRow = (u: U, projectId: string, extra: Record<string, unknown> = {}) => ({
  user_id: u.id,
  project_id: projectId,
  kind: "final",
  storage_path: `${u.id}/${projectId}/${crypto.randomUUID()}.mp4`,
  mime: "video/mp4",
  size_bytes: 10,
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  ...extra,
});

let A: U;
let B: U;

beforeAll(async () => {
  [A, B] = await Promise.all([newUser("entrega-a"), newUser("entrega-b")]);
});

describe("jobs: criar e RLS", () => {
  it("dono cria pelo RPC e só ele lê; escrita direta é negada", async () => {
    const projectId = await newProject(A);
    const { data: jobId, error } = await A.client.rpc("create_render_job", { p_project: projectId, p_kind: "render" });
    expect(error).toBeNull();
    expect(jobId).toBeTruthy();

    const mine = await A.client.from("jobs").select("id, status").eq("project_id", projectId);
    expect(mine.data).toEqual([{ id: jobId, status: "queued" }]);
    const theirs = await B.client.from("jobs").select("id").eq("project_id", projectId);
    expect(theirs.data ?? []).toHaveLength(0);

    const direct = await A.client.from("jobs").insert({ project_id: projectId, kind: "render", status: "done" });
    expect(direct.error).not.toBeNull();
    const upd = await A.client.from("jobs").update({ status: "done" }).eq("id", jobId as string).select("id");
    expect(upd.error ?? (upd.data?.length ? null : "sem linhas")).not.toBeNull();
    const { data: after } = await admin.from("jobs").select("status").eq("id", jobId as string).single();
    expect(after?.status).toBe("queued");
  });

  it("recusa projeto de outra pessoa e projeto ainda não gravado", async () => {
    const projectId = await newProject(A);
    const alheio = await B.client.rpc("create_render_job", { p_project: projectId, p_kind: "render" });
    expect(alheio.error).not.toBeNull();

    const cedo = await newProject(A, "script");
    const naoGravado = await A.client.rpc("create_render_job", { p_project: cedo, p_kind: "render" });
    expect(naoGravado.error?.message).toContain("not_recorded");
  });

  it("só um pedido ativo por projeto", async () => {
    const projectId = await newProject(A);
    const first = await A.client.rpc("create_render_job", { p_project: projectId, p_kind: "render" });
    expect(first.error).toBeNull();
    const second = await A.client.rpc("create_render_job", { p_project: projectId, p_kind: "render" });
    expect(second.error?.message).toContain("job_already_active");
    const { data } = await admin.from("jobs").select("id").eq("project_id", projectId);
    expect(data).toHaveLength(1);
  });
});

describe("claim_job e requeue_stale_jobs", () => {
  it("dois workers ao mesmo tempo: só um pega o pedido", async () => {
    // Esvazia a fila (outros testes deixam pedidos) para o pedido deste teste ser o único.
    await admin.from("jobs").update({ status: "done" }).eq("status", "queued");
    const projectId = await newProject(A);
    const created = await A.client.rpc("create_render_job", { p_project: projectId, p_kind: "render" });
    const [x, y] = await Promise.all([admin.rpc("claim_job"), admin.rpc("claim_job")]);
    expect(x.error).toBeNull();
    const got = [x.data, y.data].map((d) => (Array.isArray(d) ? d : d ? [d] : []));
    expect(got.flat()).toHaveLength(1);
    expect(got.flat()[0]).toMatchObject({ id: created.data, status: "running", attempts: 1 });
  });

  it("usuário comum não chama claim_job", async () => {
    const { error } = await A.client.rpc("claim_job");
    expect(error).not.toBeNull();
  });

  it("pedido parado há 11 min volta à fila; na 3ª tentativa falha", async () => {
    const stale = new Date(Date.now() - 11 * 60_000).toISOString();
    const p1 = await newProject(A);
    const p2 = await newProject(A);
    const j1 = await admin.from("jobs").insert({ user_id: A.id, project_id: p1, kind: "render", status: "running", attempts: 1, heartbeat_at: stale }).select("id").single();
    const j2 = await admin.from("jobs").insert({ user_id: A.id, project_id: p2, kind: "render", status: "running", attempts: 3, heartbeat_at: stale }).select("id").single();
    const { error } = await admin.rpc("requeue_stale_jobs");
    expect(error).toBeNull();
    const { data: a } = await admin.from("jobs").select("status").eq("id", j1.data!.id).single();
    const { data: b } = await admin.from("jobs").select("status, error").eq("id", j2.data!.id).single();
    expect(a?.status).toBe("queued");
    expect(b?.status).toBe("failed");
    expect(b?.error).toBeTruthy();
  });
});

describe("exports", () => {
  it("dono lê; outro não; escrita direta negada; uma linha ativa por (projeto, tipo, corte)", async () => {
    const projectId = await newProject(A);
    const ins = await admin.from("exports").insert(exportRow(A, projectId)).select("id").single();
    expect(ins.error).toBeNull();
    const dup = await admin.from("exports").insert(exportRow(A, projectId));
    expect(dup.error).not.toBeNull();
    const cut = await admin.from("exports").insert(exportRow(A, projectId, { kind: "cut", cut_id: "c1" }));
    expect(cut.error).toBeNull();

    const mine = await A.client.from("exports").select("id").eq("project_id", projectId);
    expect(mine.data).toHaveLength(2);
    const theirs = await B.client.from("exports").select("id").eq("project_id", projectId);
    expect(theirs.data ?? []).toHaveLength(0);
    const direct = await A.client.from("exports").insert(exportRow(A, projectId, { kind: "cover", cut_id: "c2" }));
    expect(direct.error).not.toBeNull();
  });

  it("purge_expired_exports apaga só o vencido e devolve o caminho", async () => {
    const projectId = await newProject(A);
    const old = exportRow(A, projectId, { expires_at: new Date(Date.now() - 1000).toISOString() });
    const fresh = exportRow(A, projectId, { kind: "cut", cut_id: "c1" });
    await admin.from("exports").insert([old, fresh]);
    const { data, error } = await admin.rpc("purge_expired_exports");
    expect(error).toBeNull();
    expect(data).toContain(old.storage_path);
    expect(data).not.toContain(fresh.storage_path);
    const { data: left } = await admin.from("exports").select("storage_path").eq("project_id", projectId);
    expect(left).toEqual([{ storage_path: fresh.storage_path }]);
    const denied = await A.client.rpc("purge_expired_exports");
    expect(denied.error).not.toBeNull();
  });
});

describe("transcripts", () => {
  it("dono lê as próprias palavras; outro não; escrita direta negada", async () => {
    const projectId = await newProject(A);
    const rec = await admin
      .from("recordings")
      .insert({ user_id: A.id, project_id: projectId, kind: "take", storage_path: `${A.id}/${projectId}/t.webm`, mime: "video/webm", size_bytes: 1, status: "ready" })
      .select("id")
      .single();
    expect(rec.error).toBeNull();
    const row = { recording_id: rec.data!.id, user_id: A.id, project_id: projectId, words: [{ w: "oi", s: 0, e: 0.4 }] };
    expect((await admin.from("transcripts").insert(row)).error).toBeNull();
    expect((await A.client.from("transcripts").select("words").eq("recording_id", row.recording_id)).data).toHaveLength(1);
    expect((await B.client.from("transcripts").select("words").eq("recording_id", row.recording_id)).data ?? []).toHaveLength(0);
    expect((await A.client.from("transcripts").delete().eq("recording_id", row.recording_id)).error).not.toBeNull();
  });
});

describe("bucket exports", () => {
  it("dono baixa o próprio arquivo; outro não; upload direto é negado", async () => {
    const path = `${A.id}/proj/final.mp4`;
    const up = await admin.storage.from("exports").upload(path, new Blob(["x"], { type: "video/mp4" }), { contentType: "video/mp4" });
    expect(up.error).toBeNull();
    expect((await A.client.storage.from("exports").download(path)).error).toBeNull();
    expect((await B.client.storage.from("exports").download(path)).error).not.toBeNull();
    const direct = await A.client.storage.from("exports").upload(`${A.id}/proj/outro.mp4`, new Blob(["x"], { type: "video/mp4" }), { contentType: "video/mp4" });
    expect(direct.error).not.toBeNull();
    await admin.storage.from("exports").remove([path]);
  });
});
