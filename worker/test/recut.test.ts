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
const dir = mkdtempSync(path.join(tmpdir(), "gravai-recut-test-"));

let userId: string;

/** Vídeo final de mentirinha: 10 s, 1080×1920, com áudio. */
function syntheticFinal(): string {
  const file = path.join(dir, `${crypto.randomUUID()}.mp4`);
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", "testsrc=duration=10:size=1080x1920:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:duration=10", "-shortest", "-pix_fmt", "yuv420p", file],
    { stdio: "ignore" },
  );
  return file;
}

async function upload(storagePath: string, file: string, mime: string) {
  const up = await db.storage.from("exports").upload(storagePath, readFileSync(file), { contentType: mime });
  if (up.error) throw up.error;
}

async function setup(payload: object) {
  const { data: p, error } = await db
    .from("projects")
    .insert({
      user_id: userId,
      title: "Vídeo",
      source_kind: "text",
      source_text: "texto",
      status: "pronto",
      cuts: [{ id: "c1", start: 1, end: 1, title: "Primeiro corte", coverPrompt: null, descriptions: {} }],
    })
    .select("id")
    .single();
  if (error) throw error;
  const finalFile = syntheticFinal();
  const expires = new Date(Date.now() + 20 * 86_400_000).toISOString();
  const row = (kind: string, cutId: string | null, file: string, mime: string, secs: number | null) => ({
    user_id: userId,
    project_id: p.id,
    kind,
    cut_id: cutId,
    storage_path: `${userId}/${p.id}/${crypto.randomUUID()}.${mime === "image/jpeg" ? "jpg" : "mp4"}`,
    mime,
    duration_seconds: secs,
    size_bytes: statSync(file).size,
    expires_at: expires,
  });
  const rows = [row("final", null, finalFile, "video/mp4", 10), row("cut", "c1", finalFile, "video/mp4", 10), row("cover", "c1", finalFile, "image/jpeg", null)];
  for (const r of rows) await upload(r.storage_path, finalFile, r.mime);
  const ins = await db.from("exports").insert(rows);
  if (ins.error) throw ins.error;
  const { data: job, error: e2 } = await db
    .from("jobs")
    .insert({ user_id: userId, project_id: p.id, kind: "recut", status: "running", attempts: 1, payload, heartbeat_at: new Date().toISOString() })
    .select("id, user_id, project_id, kind, payload, attempts")
    .single();
  if (e2) throw e2;
  return { projectId: p.id as string, job: job as Job, old: rows };
}

async function fetchExport(storagePath: string, ext: string) {
  const { data, error } = await db.storage.from("exports").download(storagePath);
  if (error || !data) throw error;
  const file = path.join(dir, `${crypto.randomUUID()}.${ext}`);
  writeFileSync(file, Buffer.from(await data.arrayBuffer()));
  return file;
}

describe.skipIf(!URL || !SERVICE)("recut", () => {
  beforeAll(async () => {
    const { data, error } = await db.auth.admin.createUser({ email: `recut-${crypto.randomUUID()}@teste.local`, password: "senha-de-teste-123", email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  });

  it("2–6 s do final vira um corte de 4 s, troca corte e capa e guarda os tempos", async () => {
    const { projectId, job, old } = await setup({ cutId: "c1", start: 2, end: 6 });
    await handle(db, job);

    const { data: j } = await db.from("jobs").select("status, error").eq("id", job.id).single();
    expect(j).toEqual({ status: "done", error: null });

    const { data: rows } = await db.from("exports").select("kind, cut_id, storage_path, duration_seconds, start_seconds, end_seconds").eq("project_id", projectId);
    expect(rows).toHaveLength(3);
    const cut = rows!.find((r) => r.kind === "cut")!;
    expect([Number(cut.start_seconds), Number(cut.end_seconds)]).toEqual([2, 6]);
    expect(Math.abs((await probe(await fetchExport(cut.storage_path, "mp4"))).duration - 4)).toBeLessThan(0.1);
    const cover = await probe(await fetchExport(rows!.find((r) => r.kind === "cover")!.storage_path, "jpg"));
    expect([cover.width, cover.height]).toEqual([1080, 1920]);

    // O final fica como estava; os arquivos antigos do corte e da capa somem.
    expect(rows!.find((r) => r.kind === "final")!.storage_path).toBe(old[0].storage_path);
    expect((await db.storage.from("exports").download(old[1].storage_path)).error).not.toBeNull();
    expect((await db.storage.from("exports").download(old[2].storage_path)).error).not.toBeNull();
  });

  it("fim além do final: falha com mensagem e mantém os arquivos", async () => {
    const { projectId, job } = await setup({ cutId: "c1", start: 2, end: 30 });
    await handle(db, job);
    const { data: j } = await db.from("jobs").select("status, error").eq("id", job.id).single();
    expect(j).toEqual({ status: "failed", error: "Início e fim do corte não são válidos." });
    const { data: rows } = await db.from("exports").select("id").eq("project_id", projectId);
    expect(rows).toHaveLength(3);
  });
});
