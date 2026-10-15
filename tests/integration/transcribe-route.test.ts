import { createClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:58321";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
process.env.AI_MOCK = "1";
process.env.WORKER_SECRET = "segredo-de-teste";

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const AUDIO = new Uint8Array([1, 2, 3, 4]);

let userId: string;

async function setup(opts: { jobStatus?: string; kind?: string } = {}) {
  const { data: p, error } = await admin
    .from("projects")
    .insert({ user_id: userId, title: "Vídeo", source_kind: "text", source_text: "texto", status: "gravado" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: rec, error: e2 } = await admin
    .from("recordings")
    .insert({ user_id: userId, project_id: p.id, kind: opts.kind ?? "take", storage_path: `${userId}/${p.id}/t.mp4`, mime: "video/mp4", size_bytes: 1, status: "ready" })
    .select("id")
    .single();
  if (e2) throw e2;
  const { data: job, error: e3 } = await admin
    .from("jobs")
    .insert({ user_id: userId, project_id: p.id, kind: "render", status: opts.jobStatus ?? "running", attempts: 1, heartbeat_at: new Date().toISOString() })
    .select("id")
    .single();
  if (e3) throw e3;
  return { projectId: p.id as string, recordingId: rec.id as string, jobId: job.id as string };
}

async function call(query: Record<string, string>, opts: { auth?: string | null; body?: Uint8Array } = {}) {
  const { POST } = await import("@/app/api/internal/transcribe/route");
  const qs = new globalThis.URLSearchParams(query).toString();
  const headers: Record<string, string> = { "content-type": "application/octet-stream" };
  if (opts.auth !== null) headers.authorization = opts.auth ?? `Bearer ${process.env.WORKER_SECRET}`;
  return POST(new Request(`http://localhost/api/internal/transcribe?${qs}`, { method: "POST", headers, body: (opts.body ?? AUDIO) as BodyInit }));
}

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: `transcribe-${crypto.randomUUID()}@teste.local`, password: "senha-de-teste-123", email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
});

beforeEach(async () => {
  (await import("@/lib/ai/mock")).resetMock();
});

describe("POST /api/internal/transcribe", () => {
  it("sem o segredo do worker → 401", async () => {
    const s = await setup();
    expect((await call({ job: s.jobId, recording: s.recordingId }, { auth: null })).status).toBe(401);
    expect((await call({ job: s.jobId, recording: s.recordingId }, { auth: "Bearer errado" })).status).toBe(401);
  });

  it("pedido inexistente, parado ou de outro projeto → 404", async () => {
    const s = await setup();
    const other = await setup();
    const none = crypto.randomUUID();
    expect((await call({ job: none, recording: s.recordingId })).status).toBe(404);
    expect((await call({ job: s.jobId, recording: other.recordingId })).status).toBe(404);
    const queued = await setup({ jobStatus: "queued" });
    expect((await call({ job: queued.jobId, recording: queued.recordingId })).status).toBe(404);
  });

  it("gravação que não é take único → 404", async () => {
    const s = await setup({ kind: "external" });
    expect((await call({ job: s.jobId, recording: s.recordingId })).status).toBe(404);
  });

  it("corpo vazio → 400", async () => {
    const s = await setup();
    expect((await call({ job: s.jobId, recording: s.recordingId }, { body: new Uint8Array() })).status).toBe(400);
  });

  it("transcreve, guarda e não paga duas vezes", async () => {
    const s = await setup();
    const { getMockCalls } = await import("@/lib/ai/mock");
    const first = await call({ job: s.jobId, recording: s.recordingId });
    expect(first.status).toBe(200);
    const body = (await first.json()) as { words: { w: string }[] };
    expect(body.words.map((w) => w.w)).toEqual(["olá", "mundo"]);
    expect(getMockCalls("transcribeWords")).toBe(1);

    const { data } = await admin.from("transcripts").select("project_id, user_id, words").eq("recording_id", s.recordingId).single();
    expect(data?.project_id).toBe(s.projectId);
    expect(data?.user_id).toBe(userId);

    const second = await call({ job: s.jobId, recording: s.recordingId });
    expect(((await second.json()) as { words: unknown[] }).words).toHaveLength(2);
    expect(getMockCalls("transcribeWords")).toBe(1);
  });
});
