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

beforeAll(async () => {
  A = await newUser("usage-a");
  B = await newUser("usage-b");
  const { error } = await admin.from("ai_usage").insert([
    { user_id: A.id, kind: "text", model: "m", cost_usd: 0.0123 },
    { user_id: A.id, kind: "ocr", model: "m", cost_usd: 0.5 },
  ]);
  if (error) throw error;
});

describe("ai_usage", () => {
  it("o dono lê só as próprias linhas", async () => {
    const { data } = await A.client.from("ai_usage").select("cost_usd");
    expect((data ?? []).map((r) => Number(r.cost_usd)).sort()).toEqual([0.0123, 0.5]);
    const other = await B.client.from("ai_usage").select("cost_usd");
    expect(other.data ?? []).toHaveLength(0);
  });

  it("usuário logado não grava, altera nem apaga (só o servidor)", async () => {
    const ins = await A.client.from("ai_usage").insert({ user_id: A.id, kind: "text", model: "m", cost_usd: 0 });
    expect(ins.error).not.toBeNull();
    const upd = await A.client.from("ai_usage").update({ cost_usd: 0 }).eq("user_id", A.id).select("id");
    expect(upd.error ?? (upd.data?.length ? new Error("alterou") : null)).not.toBeNull();
    const del = await A.client.from("ai_usage").delete().eq("user_id", A.id).select("id");
    expect(del.error ?? (del.data?.length ? new Error("apagou") : null)).not.toBeNull();
  });

  it("o banco recusa custo negativo e tipo desconhecido", async () => {
    expect((await admin.from("ai_usage").insert({ user_id: A.id, kind: "text", model: "m", cost_usd: -1 })).error).not.toBeNull();
    expect((await admin.from("ai_usage").insert({ user_id: A.id, kind: "video", model: "m", cost_usd: 0 })).error).not.toBeNull();
  });
});
