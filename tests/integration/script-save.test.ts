import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { BlockKind, NewScriptBlock } from "@/lib/script/generate";
import { supabaseScriptDb } from "@/lib/script/db";
import type { Database } from "@/lib/supabase/types";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:58321";
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);

let client: SupabaseClient<Database>;
let userId: string;
let projectId: string;

/** opening + (n-2) cortes + closing */
function blocks(n: number): NewScriptBlock[] {
  let cut = 0;
  return Array.from({ length: n }, (_, i) => {
    const kind: BlockKind = i === 0 ? "opening" : i === n - 1 ? "closing" : "cut";
    return {
      position: i + 1,
      kind,
      text: `bloco ${i + 1} de ${n}`,
      cut_index: kind === "cut" ? ++cut : null,
      cut_title: null,
      descriptions: {},
      cover_prompt: null,
    };
  });
}

beforeAll(async () => {
  const email = `script-${crypto.randomUUID()}@teste.local`;
  const password = "senha-de-teste-123";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  client = createClient<Database>(URL, ANON, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const { data: p, error: e3 } = await client
    .from("projects")
    .insert({ title: "P", source_kind: "text", source_text: "texto" })
    .select("id")
    .single();
  if (e3) throw e3;
  projectId = p.id;
});

async function rows() {
  const { data, error } = await client.from("script_blocks").select("position, kind, cut_index").eq("project_id", projectId).order("position");
  if (error) throw error;
  return data;
}

describe("supabaseScriptDb.saveScript", () => {
  it("regerar com menos blocos apaga as sobras; com mais, volta a ter todos, sem duplicar", async () => {
    const db = supabaseScriptDb({ supabase: client, userId });
    const save = (n: number) => db.saveScript(projectId, { blocks: blocks(n), descriptions: {}, coverPrompt: "capa", interview: {} });

    expect(await save(7)).toBe(true);
    expect(await rows()).toHaveLength(7);

    expect(await save(4)).toBe(true);
    expect(await rows()).toEqual([
      { position: 1, kind: "opening", cut_index: null },
      { position: 2, kind: "cut", cut_index: 1 },
      { position: 3, kind: "cut", cut_index: 2 },
      { position: 4, kind: "closing", cut_index: null },
    ]);

    expect(await save(7)).toBe(true);
    const again = await rows();
    expect(again).toHaveLength(7);
    expect(again.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(again.filter((r) => r.kind === "cut").map((r) => r.cut_index)).toEqual([1, 2, 3, 4, 5]);

    const { data } = await client.from("projects").select("status, cover_prompt").eq("id", projectId).single();
    expect(data).toEqual({ status: "script", cover_prompt: "capa" });
  });
});
