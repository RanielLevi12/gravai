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
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(URL, ANON, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, client };
}

let A: { id: string; client: SupabaseClient };
let B: { id: string; client: SupabaseClient };

beforeAll(async () => {
  A = await newUser("a");
  B = await newUser("b");
});

describe("RLS", () => {
  it("usuário B não vê nem altera o projeto de A", async () => {
    const { data: id, error } = await A.client.rpc("create_project", { p_title: "Meu projeto", p_source_kind: "text", p_source_text: "olá" });
    expect(error).toBeNull();
    const proj = { id: id as string };

    const { data: seen } = await B.client.from("projects").select("*").eq("id", proj.id);
    expect(seen).toEqual([]);

    const { data: upd } = await B.client
      .from("projects")
      .update({ title: "invadido" })
      .eq("id", proj.id)
      .select();
    expect(upd).toEqual([]);

    const { data: own } = await A.client.from("projects").select("title").eq("id", proj.id).single();
    expect(own!.title).toBe("Meu projeto");

    const { error: insErr } = await B.client
      .from("projects")
      .insert({ user_id: A.id, title: "x", source_kind: "text", source_text: "y" });
    expect(insErr).not.toBeNull();
  });

  it("usuário não insere projeto direto na tabela (a cota só vale pela função)", async () => {
    const u = await newUser("direto");
    const { error } = await u.client.from("projects").insert({ title: "burla", source_kind: "text", source_text: "x" });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/permission denied/i);
    const { count } = await u.client.from("projects").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("create_project recusa usuário anônimo", async () => {
    const anon = createClient(URL, ANON, opts);
    const { error } = await anon.rpc("create_project", { p_title: "x", p_source_kind: "text", p_source_text: "y" });
    expect(error).not.toBeNull();
  });
});

describe("consume_usage", () => {
  it("permite 5 projetos e recusa o 6º", async () => {
    const u = await newUser("q");
    for (let i = 0; i < 5; i++) {
      const { data } = await u.client.rpc("consume_usage", { p_projects: 1, p_seconds: 0 });
      expect(data).toBe(true);
    }
    const { data: sixth } = await u.client.rpc("consume_usage", { p_projects: 1, p_seconds: 0 });
    expect(sixth).toBe(false);
    const { data: row } = await u.client.from("usage_months").select("*").single();
    expect(row!.projects).toBe(5);
  });

  it("limita transcrição a 3600 s", async () => {
    const u = await newUser("t");
    expect((await u.client.rpc("consume_usage", { p_projects: 0, p_seconds: 3600 })).data).toBe(true);
    expect((await u.client.rpc("consume_usage", { p_projects: 0, p_seconds: 1 })).data).toBe(false);
    const { data: row } = await u.client.from("usage_months").select("*").single();
    expect(row!.transcription_seconds).toBe(3600);
  });

  it("recusa argumentos negativos sem alterar nada", async () => {
    const u = await newUser("n");
    await u.client.rpc("consume_usage", { p_projects: 2, p_seconds: 100 });
    expect((await u.client.rpc("consume_usage", { p_projects: -1, p_seconds: 0 })).data).toBe(false);
    expect((await u.client.rpc("consume_usage", { p_projects: 0, p_seconds: -50 })).data).toBe(false);
    const { data: row } = await u.client.from("usage_months").select("*").single();
    expect(row!.projects).toBe(2);
    expect(row!.transcription_seconds).toBe(100);
  });

  it("usuário não escreve direto em usage_months", async () => {
    const u = await newUser("w");
    await u.client.rpc("consume_usage", { p_projects: 1, p_seconds: 0 });
    const { data } = await u.client.from("usage_months").update({ projects: 0 }).eq("user_id", u.id).select();
    expect(data ?? []).toEqual([]);
    const { error: insErr } = await u.client
      .from("usage_months")
      .insert({ user_id: u.id, month: "2000-01-01", projects: 0 });
    expect(insErr).not.toBeNull();
    const { data: row } = await u.client.from("usage_months").select("projects").single();
    expect(row!.projects).toBe(1);
  });

  it("refund_usage: usuário recebe erro de permissão; service_role consegue", async () => {
    const u = await newUser("r");
    await u.client.rpc("consume_usage", { p_projects: 3, p_seconds: 600 });
    const { error } = await u.client.rpc("refund_usage", { p_user: u.id, p_projects: 3, p_seconds: 600 });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/permission denied/i);

    const { error: e2 } = await admin.rpc("refund_usage", { p_user: u.id, p_projects: 1, p_seconds: 100 });
    expect(e2).toBeNull();
    const { data: row } = await u.client.from("usage_months").select("*").single();
    expect(row!.projects).toBe(2);
    expect(row!.transcription_seconds).toBe(500);

    await admin.rpc("refund_usage", { p_user: u.id, p_projects: 99, p_seconds: 99999 });
    const { data: row2 } = await u.client.from("usage_months").select("*").single();
    expect(row2!.projects).toBe(0);
    expect(row2!.transcription_seconds).toBe(0);
  });
});
