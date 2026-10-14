import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Job } from "../src/claim";
import { probe } from "../src/ffmpeg";
import { handle } from "../src/jobs";

// Precisa do Supabase local e do ffmpeg (ver README).
const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(URL ?? "http://127.0.0.1:58321", SERVICE ?? "x", { auth: { persistSession: false } });
const dir = mkdtempSync(path.join(tmpdir(), "gravai-render-test-"));

let userId: string;

/** Gravação de mentirinha: imagem + tom, em tamanho e duração diferentes. */
function clip(name: string, seconds: number, size: string, hz: number): string {
  const file = path.join(dir, name);
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", `testsrc=duration=${seconds}:size=${size}:rate=30`, "-f", "lavfi", "-i", `sine=frequency=${hz}:duration=${seconds}`, "-shortest", "-pix_fmt", "yuv420p", file],
    { stdio: "ignore" },
  );
  return file;
}

async function setup(opts: { recorded: number[]; kind?: "block" | "take"; cuts?: object[] }) {
  const { data: p, error } = await db
    .from("projects")
    .insert({ user_id: userId, title: "Vídeo", source_kind: "text", source_text: "texto", status: "gravado", cuts: opts.cuts ?? [] })
    .select("id")
    .single();
  if (error) throw error;
  const kinds = ["opening", "body", "closing"] as const;
  const { data: blocks, error: e2 } = await db
    .from("script_blocks")
    .insert(kinds.map((kind, i) => ({ project_id: p.id, user_id: userId, position: i + 1, kind, text: `Bloco ${i + 1}` })))
    .select("id, position");
  if (e2) throw e2;
  blocks.sort((a, b) => a.position - b.position);

  const specs = [
    { secs: 2, size: "640x360", hz: 440 },
    { secs: 3, size: "720x1280", hz: 660 },
    { secs: 2, size: "1280x720", hz: 880 },
  ];
  for (const i of opts.recorded) {
    const id = crypto.randomUUID();
    const storagePath = `${userId}/${p.id}/${id}.mp4`;
    const file = clip(`${id}.mp4`, specs[i].secs, specs[i].size, specs[i].hz);
    const up = await db.storage.from("recordings").upload(storagePath, readFileSync(file), { contentType: "video/mp4" });
    if (up.error) throw up.error;
    const { error: e3 } = await db.from("recordings").insert({
      id,
      user_id: userId,
      project_id: p.id,
      kind: opts.kind ?? "block",
      block_id: (opts.kind ?? "block") === "block" ? blocks[i].id : null,
      storage_path: storagePath,
      mime: "video/mp4",
      duration_seconds: specs[i].secs,
      size_bytes: statSync(file).size,
      status: "ready",
    });
    if (e3) throw e3;
  }
  const { data: job, error: e4 } = await db
    .from("jobs")
    .insert({ user_id: userId, project_id: p.id, kind: "render", status: "running", attempts: 1, heartbeat_at: new Date().toISOString() })
    .select("id, user_id, project_id, kind, payload, attempts")
    .single();
  if (e4) throw e4;
  return { projectId: p.id as string, job: job as Job };
}

const cut = (id: string, start: number, end: number, title: string) => ({ id, start, end, title, coverPrompt: null, descriptions: {} });

async function fetchExport(storagePath: string, ext: string) {
  const { data, error } = await db.storage.from("exports").download(storagePath);
  if (error || !data) throw error;
  const file = path.join(dir, `${crypto.randomUUID()}.${ext}`);
  writeFileSync(file, Buffer.from(await data.arrayBuffer()));
  return file;
}

describe.skipIf(!URL || !SERVICE)("render por blocos", () => {
  beforeAll(async () => {
    const { data, error } = await db.auth.admin.createUser({ email: `render-${crypto.randomUUID()}@teste.local`, password: "senha-de-teste-123", email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  });

  it("junta os blocos, corta, tira capas e deixa o projeto pronto", async () => {
    const { projectId, job } = await setup({ recorded: [0, 1, 2], cuts: [cut("c1", 1, 2, "Primeiro corte do vídeo"), cut("c2", 3, 3, "Segundo")] });
    await handle(db, job);

    const { data: j } = await db.from("jobs").select("status, progress, error").eq("id", job.id).single();
    expect(j).toEqual({ status: "done", progress: 100, error: null });
    const { data: p } = await db.from("projects").select("status").eq("id", projectId).single();
    expect(p?.status).toBe("pronto");

    const { data: rows } = await db.from("exports").select("kind, cut_id, storage_path, size_bytes, duration_seconds, expires_at").eq("project_id", projectId);
    expect(rows).toHaveLength(5);
    expect(rows!.every((r) => r.size_bytes <= 50 * 1024 * 1024 && r.storage_path.startsWith(`${userId}/${projectId}/`))).toBe(true);
    expect(new Date(rows![0].expires_at).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);

    const find = (kind: string, cutId: string | null) => rows!.find((r) => r.kind === kind && r.cut_id === cutId)!;
    const final = await probe(await fetchExport(find("final", null).storage_path, "mp4"));
    expect(final.duration).toBeGreaterThan(6.7);
    expect(final.duration).toBeLessThan(7.4);
    expect([final.width, final.height]).toEqual([1080, 1920]);
    expect(final.hasAudio).toBe(true);

    const c1 = await probe(await fetchExport(find("cut", "c1").storage_path, "mp4"));
    const c2 = await probe(await fetchExport(find("cut", "c2").storage_path, "mp4"));
    expect(c1.duration).toBeGreaterThan(4.7);
    expect(c1.duration).toBeLessThan(5.4);
    expect(c2.duration).toBeGreaterThan(1.7);
    expect(c2.duration).toBeLessThan(2.4);

    const cover = await probe(await fetchExport(find("cover", "c1").storage_path, "jpg"));
    expect([cover.width, cover.height]).toEqual([1080, 1920]);
  });

  it("projeto sem cortes gera só o vídeo final", async () => {
    const { projectId, job } = await setup({ recorded: [0, 1, 2] });
    await handle(db, job);
    const { data: rows } = await db.from("exports").select("kind").eq("project_id", projectId);
    expect(rows).toEqual([{ kind: "final" }]);
  });

  it("bloco sem gravação: falha cedo, listando a posição, sem arquivos", async () => {
    const { projectId, job } = await setup({ recorded: [0, 2], cuts: [cut("c1", 1, 3, "Tudo")] });
    await handle(db, job);
    const { data: j } = await db.from("jobs").select("status, error").eq("id", job.id).single();
    expect(j).toEqual({ status: "failed", error: "Faltam gravações nos blocos: 2." });
    const { data: rows } = await db.from("exports").select("id").eq("project_id", projectId);
    expect(rows ?? []).toHaveLength(0);
  });

  it("gerar de novo troca os arquivos antigos pelos novos", async () => {
    const { projectId, job } = await setup({ recorded: [0, 1, 2] });
    await handle(db, job);
    const { data: before } = await db.from("exports").select("id, storage_path").eq("project_id", projectId);

    const { data: again } = await db
      .from("jobs")
      .insert({ user_id: userId, project_id: projectId, kind: "render", status: "running", attempts: 1, heartbeat_at: new Date().toISOString() })
      .select("id, user_id, project_id, kind, payload, attempts")
      .single();
    await handle(db, again as Job);
    const { data: after } = await db.from("exports").select("id, storage_path").eq("project_id", projectId);
    expect(after).toHaveLength(1);
    expect(after![0].id).not.toBe(before![0].id);
    expect((await db.storage.from("exports").download(before![0].storage_path)).error).not.toBeNull();
  });
});
