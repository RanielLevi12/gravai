import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

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

let A: { id: string; client: SupabaseClient };
let B: { id: string; client: SupabaseClient };

beforeAll(async () => {
  A = await newUser("ai-a");
  B = await newUser("ai-b");
  const { error } = await admin
    .from("ai_connections")
    .insert({ user_id: A.id, provider: "openrouter", key_ciphertext: "v1:aaa:bbb:ccc", key_hint: "9f3a" });
  if (error) throw error;
});

describe("ai_connections (RLS + coluna revogada)", () => {
  it("dono lê provider e key_hint da própria linha", async () => {
    const { data, error } = await A.client.from("ai_connections").select("provider, key_hint, created_at").eq("user_id", A.id);
    expect(error).toBeNull();
    expect(data).toEqual([expect.objectContaining({ provider: "openrouter", key_hint: "9f3a" })]);
  });

  it("select de key_ciphertext falha (inclusive select *)", async () => {
    const { data, error } = await A.client.from("ai_connections").select("key_ciphertext");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
    const all = await A.client.from("ai_connections").select("*");
    expect(all.error).not.toBeNull();
  });

  it("anon não lê nada", async () => {
    const anon = createClient(URL, ANON, opts);
    const { data } = await anon.from("ai_connections").select("provider");
    expect(data ?? []).toEqual([]);
  });

  it("usuário B não vê a linha de A", async () => {
    const { data, error } = await B.client.from("ai_connections").select("provider, key_hint");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("usuário não consegue insert nem update", async () => {
    const ins = await B.client
      .from("ai_connections")
      .insert({ user_id: B.id, provider: "openrouter", key_ciphertext: "v1:x:y:z", key_hint: "zzzz" });
    expect(ins.error).not.toBeNull();

    const upd = await A.client.from("ai_connections").update({ key_hint: "hack" }).eq("user_id", A.id).select("key_hint");
    expect(upd.error).not.toBeNull();
    const { data } = await admin.from("ai_connections").select("key_hint, key_ciphertext").eq("user_id", A.id).single();
    expect(data).toEqual({ key_hint: "9f3a", key_ciphertext: "v1:aaa:bbb:ccc" });
  });

  it("B não apaga a linha de A; A apaga a própria", async () => {
    await B.client.from("ai_connections").delete().eq("user_id", A.id);
    const still = await admin.from("ai_connections").select("user_id").eq("user_id", A.id);
    expect(still.data).toHaveLength(1);

    const { error } = await A.client.from("ai_connections").delete().eq("user_id", A.id);
    expect(error).toBeNull();
    const gone = await admin.from("ai_connections").select("user_id").eq("user_id", A.id);
    expect(gone.data).toEqual([]);
  });

  it("provider fora da lista é recusado pelo check", async () => {
    const { error } = await admin
      .from("ai_connections")
      .insert({ user_id: B.id, provider: "openai", key_ciphertext: "v1:x:y:z", key_hint: "zzzz" });
    expect(error).not.toBeNull();
  });
});
