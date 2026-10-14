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

let A: U;
let B: U;
let videoId: string;

beforeAll(async () => {
  A = await newUser("cuts-a");
  B = await newUser("cuts-b");
  const { data, error } = await A.client.rpc("create_project", { p_title: "Vídeo", p_source_kind: "text", p_source_text: "texto", p_source_truncated: false, p_seconds: 0 });
  if (error || !data) throw error ?? new Error("create_project");
  videoId = data as string;
});

const CUTS = [{ id: "a1", start: 2, end: 3, title: "Corte", coverPrompt: null, descriptions: { reels: "d" } }];

describe("projects.cuts", () => {
  it("começa como lista vazia", async () => {
    const { data } = await A.client.from("projects").select("cuts").eq("id", videoId).single();
    expect(data?.cuts).toEqual([]);
  });

  it("o dono grava e lê os cortes", async () => {
    const { data, error } = await A.client.from("projects").update({ cuts: CUTS }).eq("id", videoId).select("cuts");
    expect(error).toBeNull();
    expect(data?.[0].cuts).toEqual(CUTS);
  });

  it("outro usuário não consegue alterar nem ler", async () => {
    const upd = await B.client.from("projects").update({ cuts: [] }).eq("id", videoId).select("id");
    expect(upd.data ?? []).toHaveLength(0);
    const { data } = await B.client.from("projects").select("cuts").eq("id", videoId);
    expect(data ?? []).toHaveLength(0);
    const { data: mine } = await A.client.from("projects").select("cuts").eq("id", videoId).single();
    expect(mine?.cuts).toEqual(CUTS);
  });

  it("só aceita lista (o banco recusa objeto)", async () => {
    const { error } = await A.client.from("projects").update({ cuts: { a: 1 } }).eq("id", videoId);
    expect(error).not.toBeNull();
  });
});
