import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { supabaseRecordDb } from "@/lib/record/db";
import { approveWith, finishRecordingWith, startRecordingWith } from "@/lib/record/service";

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
async function newProject(u: U): Promise<string> {
  const { data, error } = await admin.from("projects").insert({ user_id: u.id, title: "Vídeo", source_kind: "text", source_text: "texto" }).select("id").single();
  if (error || !data) throw error ?? new Error("insert project");
  return data.id;
}

let A: U;
let B: U;
let projectId: string;

const rec = (project_id: string, extra: Record<string, unknown> = {}, owner: U = A) => ({
  project_id,
  kind: "take",
  storage_path: `${owner.id}/${project_id}/${crypto.randomUUID()}.webm`,
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
    const { error } = await B.client.from("recordings").insert(rec(projectId, {}, B));
    expect(error).not.toBeNull();
    const { data: rows } = await admin.from("recordings").select("id").eq("project_id", projectId).eq("user_id", B.id);
    expect(rows ?? []).toHaveLength(0);
  });

  it("recusa storage_path na pasta de outro usuário (insert e update) e size_bytes negativo", async () => {
    const foreign = { storage_path: `${B.id}/${projectId}/v.webm` };
    const ins = await A.client.from("recordings").insert(rec(projectId, foreign));
    expect(ins.error).not.toBeNull();
    const { data: rows } = await admin.from("recordings").select("id").eq("storage_path", foreign.storage_path);
    expect(rows ?? []).toHaveLength(0);

    const mine = await A.client.from("recordings").insert(rec(projectId)).select("id, storage_path").single();
    const upd = await A.client.from("recordings").update(foreign).eq("id", mine.data!.id).select("id");
    expect(upd.error ?? (upd.data?.length ? null : "sem linhas")).not.toBeNull();
    const { data: after } = await admin.from("recordings").select("storage_path").eq("id", mine.data!.id).single();
    expect(after?.storage_path).toBe(mine.data!.storage_path);

    expect((await A.client.from("recordings").insert(rec(projectId, { size_bytes: -1 }))).error).not.toBeNull();
  });

  it("recusa block_id de outro usuário e de outro projeto do mesmo dono", async () => {
    const pB = await newProject(B);
    const bB = await admin.from("script_blocks").insert({ project_id: pB, user_id: B.id, position: 0, kind: "opening", text: "t" }).select("id").single();
    const pA2 = await newProject(A);
    const bA2 = await admin.from("script_blocks").insert({ project_id: pA2, user_id: A.id, position: 0, kind: "opening", text: "t" }).select("id").single();
    const pA = await newProject(A);
    for (const block_id of [bB.data!.id, bA2.data!.id]) {
      const { error } = await A.client.from("recordings").insert(rec(pA, { kind: "block", block_id }));
      expect(error).not.toBeNull();
    }
    const { data } = await admin.from("recordings").select("id").eq("project_id", pA);
    expect(data ?? []).toHaveLength(0);
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

  it("aceita gravação acima de 50 MB (limite de 500 MB)", async () => {
    const { data: bucket } = await admin.storage.getBucket("recordings");
    expect(bucket?.file_size_limit).toBe(524_288_000);
    const path = `${A.id}/${projectId}/grande.webm`;
    const up = await A.client.storage.from("recordings").upload(path, new Blob([new Uint8Array(60 * 1024 * 1024)], { type: "video/webm" }), { contentType: "video/webm" });
    expect(up.error).toBeNull();
    await admin.storage.from("recordings").remove([path]);
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

describe("supabaseRecordDb (serviço real)", () => {
  it("regravar o mesmo bloco deixa 1 linha ready e apaga o arquivo antigo; apagar o script apaga as linhas", async () => {
    const p = await newProject(A);
    const blk = await admin.from("script_blocks").insert({ project_id: p, user_id: A.id, position: 0, kind: "opening", text: "t" }).select("id").single();
    const db = supabaseRecordDb({ supabase: A.client as never, userId: A.id });
    const body = new Blob(["x"], { type: "video/webm" });

    const a = await startRecordingWith(db, { projectId: p, kind: "block", blockId: blk.data!.id, mime: "video/webm" });
    expect(a.path.startsWith(`${A.id}/${p}/`)).toBe(true);
    expect((await A.client.storage.from("recordings").upload(a.path, body, { contentType: "video/webm" })).error).toBeNull();
    await finishRecordingWith(db, a.id, { sizeBytes: 1, durationSeconds: 2 });

    const b = await startRecordingWith(db, { projectId: p, kind: "block", blockId: blk.data!.id, mime: "video/webm" });
    expect((await A.client.storage.from("recordings").upload(b.path, body, { contentType: "video/webm" })).error).toBeNull();
    await finishRecordingWith(db, b.id, { sizeBytes: 1, durationSeconds: 3 });

    const ready = await A.client.from("recordings").select("id").eq("project_id", p).eq("status", "ready");
    expect(ready.data).toEqual([{ id: b.id }]);
    const old = await A.client.storage.from("recordings").download(a.path);
    expect(old.error).not.toBeNull();
    const cur = await A.client.storage.from("recordings").download(b.path);
    expect(cur.error).toBeNull();

    await admin.from("projects").update({ status: "script" }).eq("id", p);
    expect(await approveWith(db, p, "blocks")).toEqual({ ok: true });
    const st = await admin.from("projects").select("status").eq("id", p).single();
    expect(st.data?.status).toBe("gravado");

    await admin.from("script_blocks").delete().eq("project_id", p);
    const left = await admin.from("recordings").select("id").eq("project_id", p).eq("kind", "block");
    expect(left.data).toEqual([]);
  });

  it("removeFiles ignora caminhos de outro usuário", async () => {
    const db = supabaseRecordDb({ supabase: A.client as never, userId: A.id });
    await expect(db.removeFiles([`${B.id}/x/y.webm`])).resolves.toBeUndefined();
  });

  it("deleteRow só apaga 'uploading'; setProjectStatus não sobrescreve estado posterior", async () => {
    const p = await newProject(A);
    const db = supabaseRecordDb({ supabase: A.client as never, userId: A.id });
    const a = await startRecordingWith(db, { projectId: p, kind: "take", blockId: null, mime: "video/webm" });
    await finishRecordingWith(db, a.id, { sizeBytes: 1, durationSeconds: 1 });
    expect(await db.deleteRow(a.id)).toBe("ready");
    expect((await admin.from("recordings").select("id").eq("id", a.id)).data).toHaveLength(1);
    const b = await startRecordingWith(db, { projectId: p, kind: "external", blockId: null, mime: "video/mp4" });
    expect(await db.deleteRow(b.id)).toEqual({ path: b.path });
    expect(await db.deleteRow(b.id)).toBeNull();

    await admin.from("projects").update({ status: "fonte" }).eq("id", p);
    expect(await db.setProjectStatus(p, "gravado")).toBe(false);
    await admin.from("projects").update({ status: "pronto" }).eq("id", p);
    expect(await db.setProjectStatus(p, "gravado")).toBe(false);
    expect((await admin.from("projects").select("status").eq("id", p).single()).data?.status).toBe("pronto");
    await admin.from("projects").update({ status: "script" }).eq("id", p);
    expect(await db.setProjectStatus(p, "gravado")).toBe(true);
  });
});
