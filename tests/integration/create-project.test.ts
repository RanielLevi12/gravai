import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.AI_MOCK = "1";
// withUserAi (sem mock) lê a conexão de IA pelo admin client do app.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= process.env.SUPABASE_URL ?? "http://127.0.0.1:58321";

import { getMockCalls, resetMock, setMockResponse } from "@/lib/ai/mock";
import { createProject } from "@/lib/ingest/create";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:58321";
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);

async function newUser(tag: string) {
  const email = `${tag}-${crypto.randomUUID()}@teste.local`;
  const password = "senha-de-teste-123";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(URL, ANON, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, client };
}

type U = { id: string; client: SupabaseClient };
const post = (u: U, fields: Record<string, string | File>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return createProject({ supabase: u.client, admin, userId: u.id }, form);
};
const usage = async (u: U) =>
  (await admin.from("usage_months").select("projects, transcription_seconds").eq("user_id", u.id).maybeSingle()).data;
const fx = (name: string, type: string) =>
  new File([new Uint8Array(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/ingest", name)))], name, { type });

beforeAll(() => {
  if (!ANON || !SERVICE) throw new Error("Rode via `npm run test:integration`.");
});
beforeEach(() => resetMock());

describe("POST /api/projects (createProject)", () => {
  it("5 projetos passam; o 6º no mês é 402", async () => {
    const u = await newUser("quota");
    for (let i = 0; i < 5; i++) {
      const r = await post(u, { kind: "text", text: `Projeto número ${i}` });
      expect(r.status).toBe(201);
    }
    const sixth = await post(u, { kind: "text", text: "Sexto" });
    expect(sixth.status).toBe(402);
    expect(sixth.body.error).toBe("Você usou seus 5 projetos grátis deste mês.");
    expect((await usage(u))?.projects).toBe(5);
  });

  it("cria o projeto com status 'fonte' e devolve o id", async () => {
    const u = await newUser("ok");
    const r = await post(u, { kind: "text", text: "Primeira linha\nsegunda" });
    expect(r.status).toBe(201);
    const { data } = await u.client.from("projects").select("status, source_kind, source_text, title, user_id").eq("id", r.body.id as string).single();
    expect(data).toMatchObject({ status: "fonte", source_kind: "text", source_text: "Primeira linha\nsegunda", title: "Primeira linha", user_id: u.id });
  });

  it("extração que falha devolve a cota e não cria projeto (422)", async () => {
    const u = await newUser("fail");
    expect((await post(u, { kind: "text", text: "um" })).status).toBe(201);
    const before = await usage(u);
    setMockResponse("ocrImages", "");
    const r = await post(u, { kind: "images", files: fx("blank.jpg", "image/jpeg") });
    expect(r.status).toBe(422);
    expect(r.body.error).toBe("Não consegui ler esta foto. Tente com mais luz e a página inteira no quadro.");
    expect(await usage(u)).toEqual(before);
    const { count } = await u.client.from("projects").select("id", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("áudio válido consome projeto + segundos", async () => {
    const u = await newUser("audio");
    const r = await post(u, { kind: "audio", files: fx("ideia.mp3", "audio/mpeg") });
    expect(r.status).toBe(201);
    const used = await usage(u);
    expect(used?.projects).toBe(1);
    expect(used?.transcription_seconds).toBeGreaterThanOrEqual(3);
  });

  it("áudio acima da cota de minutos: 402 antes de transcrever", async () => {
    const u = await newUser("minutos");
    expect((await post(u, { kind: "text", text: "x" })).status).toBe(201);
    await admin.from("usage_months").update({ transcription_seconds: 3599 }).eq("user_id", u.id);
    const r = await post(u, { kind: "audio", files: fx("ideia.mp3", "audio/mpeg") });
    expect(r.status).toBe(402);
    expect(r.body.error).toBe("Você usou seus 60 minutos de transcrição deste mês.");
    expect(getMockCalls("transcribeAudio")).toBe(0);
    expect((await usage(u))?.projects).toBe(1);
  });

  it("áudio ilegível: 422 sem consumir cota", async () => {
    const u = await newUser("webm");
    const bad = new File([new Uint8Array([1, 2, 3])], "voz.webm", { type: "audio/webm" });
    const r = await post(u, { kind: "audio", files: bad });
    expect(r.status).toBe(422);
    expect(await usage(u)).toBeNull();
  });

  it("sem conta de IA conectada: 412 not_connected, sem consumir cota", async () => {
    const u = await newUser("semia");
    delete process.env.AI_MOCK;
    try {
      const r = await post(u, { kind: "images", files: fx("page.jpg", "image/jpeg") });
      expect(r.status).toBe(412);
      expect(r.body).toEqual({ error: "Conecte sua conta de IA para continuar.", code: "not_connected" });
    } finally {
      process.env.AI_MOCK = "1";
    }
    expect(await usage(u)).toBeNull();
  });
});
