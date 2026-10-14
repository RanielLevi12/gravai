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

const SETTINGS = { platforms: ["reels"], format: "single", duration: 60, cutSeconds: 30, cta: "none" };

async function newFolder(u: U, extra: Record<string, unknown> = {}) {
  const { data, error } = await u.client
    .from("folders")
    .insert({ name: "Devocional", settings: SETTINGS, ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

const createVideo = (u: U, folderId?: string) =>
  u.client.rpc("create_project", {
    p_title: "Meu vídeo",
    p_source_kind: "text",
    p_source_text: "Texto do vídeo",
    ...(folderId ? { p_folder_id: folderId } : {}),
  });

beforeAll(() => {
  if (!ANON || !SERVICE) throw new Error("Rode via `npm run test:integration`.");
});

describe("folders (Projetos)", () => {
  it("o dono cria, lê, edita e apaga a própria pasta; user_id vem de auth.uid()", async () => {
    const a = await newUser("dono");
    const id = await newFolder(a, { about: "devocional cristão", color: "azul" });
    const { data } = await a.client.from("folders").select("*").eq("id", id).single();
    expect(data).toMatchObject({ name: "Devocional", color: "azul", about: "devocional cristão", user_id: a.id, settings: SETTINGS });

    const { error: upd } = await a.client.from("folders").update({ name: "Reels" }).eq("id", id);
    expect(upd).toBeNull();
    const { error: del } = await a.client.from("folders").delete().eq("id", id);
    expect(del).toBeNull();
    expect((await a.client.from("folders").select("id").eq("id", id)).data).toEqual([]);
  });

  it("não vê, edita nem apaga a pasta de outro usuário", async () => {
    const a = await newUser("a");
    const b = await newUser("b");
    const id = await newFolder(a);
    expect((await b.client.from("folders").select("id").eq("id", id)).data).toEqual([]);
    await b.client.from("folders").update({ name: "invadida" }).eq("id", id);
    await b.client.from("folders").delete().eq("id", id);
    const { data } = await admin.from("folders").select("name").eq("id", id).single();
    expect(data?.name).toBe("Devocional");
  });

  it("recusa nome vazio e nome longo demais", async () => {
    const a = await newUser("nome");
    expect((await a.client.from("folders").insert({ name: "   " })).error).not.toBeNull();
    expect((await a.client.from("folders").insert({ name: "x".repeat(81) })).error).not.toBeNull();
  });

  it("create_project na pasta copia as configurações para o interview e consome 1 da cota", async () => {
    const a = await newUser("herda");
    const folderId = await newFolder(a);
    const { data: id, error } = await createVideo(a, folderId);
    expect(error).toBeNull();
    const { data } = await a.client.from("projects").select("folder_id, interview, status").eq("id", id).single();
    expect(data).toMatchObject({ folder_id: folderId, interview: SETTINGS, status: "fonte" });
    const usage = await admin.from("usage_months").select("projects").eq("user_id", a.id).single();
    expect(usage.data?.projects).toBe(1);
  });

  it("vídeo solto continua sem pasta e com interview vazio", async () => {
    const a = await newUser("solto");
    const { data: id, error } = await createVideo(a);
    expect(error).toBeNull();
    const { data } = await a.client.from("projects").select("folder_id, interview").eq("id", id).single();
    expect(data).toMatchObject({ folder_id: null, interview: {} });
  });

  it("create_project com pasta de outro usuário falha e não consome cota", async () => {
    const a = await newUser("dona");
    const b = await newUser("intruso");
    const folderId = await newFolder(a);
    const { error } = await createVideo(b, folderId);
    expect(error?.message).toContain("invalid_folder");
    expect((await admin.from("usage_months").select("projects").eq("user_id", b.id)).data).toEqual([]);
  });

  it("mudar a pasta depois não altera vídeos já criados (cópia, não vínculo)", async () => {
    const a = await newUser("copia");
    const folderId = await newFolder(a);
    const { data: id } = await createVideo(a, folderId);
    await a.client.from("folders").update({ settings: { platforms: ["youtube"] } }).eq("id", folderId);
    const { data } = await a.client.from("projects").select("interview").eq("id", id).single();
    expect(data?.interview).toEqual(SETTINGS);
  });

  it("apagar a pasta solta os vídeos e não apaga nenhum", async () => {
    const a = await newUser("apaga");
    const folderId = await newFolder(a);
    const { data: id } = await createVideo(a, folderId);
    await a.client.from("folders").delete().eq("id", folderId);
    const { data } = await a.client.from("projects").select("id, folder_id, interview").eq("id", id).single();
    expect(data).toMatchObject({ id, folder_id: null, interview: SETTINGS });
  });

  it("mover o vídeo muda só a pasta; mover para pasta alheia é recusado", async () => {
    const a = await newUser("move");
    const b = await newUser("alheia");
    const f1 = await newFolder(a);
    const f2 = await newFolder(a, { name: "Outra", settings: { platforms: ["tiktok"] } });
    const foreign = await newFolder(b);
    const { data: id } = await createVideo(a, f1);

    const { error } = await a.client.from("projects").update({ folder_id: f2 }).eq("id", id);
    expect(error).toBeNull();
    expect((await a.client.from("projects").select("folder_id, interview").eq("id", id).single()).data).toMatchObject({
      folder_id: f2,
      interview: SETTINGS,
    });

    const bad = await a.client.from("projects").update({ folder_id: foreign }).eq("id", id);
    expect(bad.error).not.toBeNull();
    const { error: out } = await a.client.from("projects").update({ folder_id: null }).eq("id", id);
    expect(out).toBeNull();
  });

  it("create_episode_projects aceita folder_id, herda settings e recusa pasta alheia", async () => {
    const a = await newUser("serie");
    const b = await newUser("serie-alheia");
    const folderId = await newFolder(a);
    const { data: serie } = await a.client.from("series").insert({ title: "Série" }).select("id").single();
    const row = (extra: Record<string, unknown>) => ({
      series_id: serie!.id,
      episode_index: 1,
      title: "Ep 1",
      source_kind: "text",
      source_text: "Texto",
      ...extra,
    });

    const ok = await a.client.rpc("create_episode_projects", { p_rows: [row({ folder_id: folderId })] });
    expect(ok.error).toBeNull();
    expect(ok.data).toHaveLength(1);
    const { data } = await a.client.from("projects").select("folder_id, interview").eq("id", ok.data![0].project_id).single();
    expect(data).toMatchObject({ folder_id: folderId, interview: SETTINGS });

    const foreign = await newFolder(b);
    const bad = await a.client.rpc("create_episode_projects", { p_rows: [row({ folder_id: foreign })] });
    expect(bad.error?.message).toContain("invalid_folder");
  });
});
