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

async function newProject(u: U): Promise<string> {
  const { data, error } = await u.client.rpc("create_project", { p_title: "Vídeo", p_source_kind: "text", p_source_text: "texto", p_source_truncated: false, p_seconds: 0 });
  if (error || !data) throw error ?? new Error("create_project");
  return data as string;
}

let A: U;
let B: U;
let projectId: string;

const rec = (project_id: string, extra: Record<string, unknown> = {}) => ({
  project_id,
  kind: "take",
  storage_path: `x/${crypto.randomUUID()}.webm`,
  mime: "video/webm",
  size_bytes: 10,
  ...extra,
});

beforeAll(async () => {
  A = await newUser("rec-a");
  B = await newUser("rec-b");
  projectId = await newProject(A);
});

describe("recordings", () => {
  it("o dono insere (uploading) e lê", async () => {
    const { data, error } = await A.client.from("recordings").insert(rec(projectId)).select("*").single();
    expect(error).toBeNull();
    expect(data?.status).toBe("uploading");
    expect(data?.user_id).toBe(A.id);
    const list = await A.client.from("recordings").select("id").eq("project_id", projectId);
    expect(list.data?.length).toBe(1);
  });

  it("outro usuário não vê nem insere em projeto alheio", async () => {
    const { data } = await B.client.from("recordings").select("id").eq("project_id", projectId);
    expect(data ?? []).toHaveLength(0);
    const { error } = await B.client.from("recordings").insert(rec(projectId));
    expect(error).not.toBeNull();
  });

  it("uma só gravação pronta por (projeto, bloco nulo)", async () => {
    const p = await newProject(A);
    const first = await A.client.from("recordings").insert(rec(p, { status: "ready" }));
    expect(first.error).toBeNull();
    const second = await A.client.from("recordings").insert(rec(p, { status: "ready" }));
    expect(second.error).not.toBeNull();
  });

  it("recusa kind e status inválidos", async () => {
    expect((await A.client.from("recordings").insert(rec(projectId, { kind: "x" }))).error).not.toBeNull();
    expect((await A.client.from("recordings").insert(rec(projectId, { status: "x" }))).error).not.toBeNull();
  });

  it("projeto aceita status 'gravado'", async () => {
    const { data, error } = await A.client.from("projects").update({ status: "gravado" }).eq("id", projectId).select("status");
    expect(error).toBeNull();
    expect(data?.[0].status).toBe("gravado");
  });

  it("apagar o projeto apaga as gravações", async () => {
    const p = await newProject(A);
    await A.client.from("recordings").insert(rec(p));
    await admin.from("projects").delete().eq("id", p);
    const { data } = await admin.from("recordings").select("id").eq("project_id", p);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("bucket recordings", () => {
  it("o dono sobe webm e outro usuário não baixa", async () => {
    const path = `${A.id}/${projectId}/x.webm`;
    const up = await A.client.storage.from("recordings").upload(path, new Blob(["abc"], { type: "video/webm" }), { contentType: "video/webm" });
    expect(up.error).toBeNull();
    expect((await A.client.storage.from("recordings").download(path)).error).toBeNull();
    expect((await B.client.storage.from("recordings").download(path)).error).not.toBeNull();
  });

  it("recusa image/png", async () => {
    const up = await A.client.storage.from("recordings").upload(`${A.id}/${projectId}/x.png`, new Blob(["abc"], { type: "image/png" }), { contentType: "image/png" });
    expect(up.error).not.toBeNull();
  });
});

describe("finish_recording", () => {
  it("marca pronta e substitui a anterior do mesmo bloco, devolvendo o caminho", async () => {
    const p = await newProject(A);
    const r1 = await A.client.from("recordings").insert(rec(p)).select("id, storage_path").single();
    const f1 = await A.client.rpc("finish_recording", { p_id: r1.data!.id, p_size_bytes: 111, p_duration: 5.5 });
    expect(f1.error).toBeNull();
    expect(f1.data).toEqual([]);

    const blk = await admin.from("script_blocks").insert({ project_id: p, user_id: A.id, position: 0, kind: "opening", text: "t" }).select("id").single();
    const other = await A.client.from("recordings").insert(rec(p, { kind: "block", block_id: blk.data!.id })).select("id").single();
    expect((await A.client.rpc("finish_recording", { p_id: other.data!.id, p_size_bytes: 1, p_duration: null })).error).toBeNull();

    const r2 = await A.client.from("recordings").insert(rec(p)).select("id").single();
    const f2 = await A.client.rpc("finish_recording", { p_id: r2.data!.id, p_size_bytes: 222, p_duration: 7 });
    expect(f2.error).toBeNull();
    expect(f2.data).toEqual([r1.data!.storage_path]);

    const { data } = await A.client.from("recordings").select("id, status, size_bytes, duration_seconds").eq("project_id", p);
    expect(data).toHaveLength(2);
    expect(data!.find((r) => r.id === r1.data!.id)).toBeUndefined();
    const n = data!.find((r) => r.id === r2.data!.id)!;
    expect(n.status).toBe("ready");
    expect(n.size_bytes).toBe(222);
    expect(Number(n.duration_seconds)).toBe(7);
  });

  it("outro usuário não consegue finalizar gravação alheia", async () => {
    const r = await A.client.from("recordings").insert(rec(projectId)).select("id").single();
    const f = await B.client.rpc("finish_recording", { p_id: r.data!.id, p_size_bytes: 1, p_duration: 1 });
    expect(f.error).not.toBeNull();
    const { data } = await A.client.from("recordings").select("status").eq("id", r.data!.id).single();
    expect(data?.status).toBe("uploading");
  });
});
