import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { purgeExpired } from "../src/purge";

// Precisa do Supabase local (ver README).
const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(URL ?? "http://127.0.0.1:58321", SERVICE ?? "x", { auth: { persistSession: false } });

let userId: string;

describe.skipIf(!URL || !SERVICE)("purgeExpired", () => {
  beforeAll(async () => {
    const { data, error } = await db.auth.admin.createUser({ email: `purge-${crypto.randomUUID()}@teste.local`, password: "senha-de-teste-123", email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  });

  it("apaga só o export vencido e o arquivo dele", async () => {
    const { data: p } = await db.from("projects").insert({ user_id: userId, title: "V", source_kind: "text", source_text: "t", status: "pronto" }).select("id").single();
    const mk = async (kind: string, cutId: string | null, expires: number) => {
      const storage_path = `${userId}/${p!.id}/${crypto.randomUUID()}.mp4`;
      const up = await db.storage.from("exports").upload(storage_path, new Blob(["x"], { type: "video/mp4" }), { contentType: "video/mp4" });
      expect(up.error).toBeNull();
      return { user_id: userId, project_id: p!.id, kind, cut_id: cutId, storage_path, mime: "video/mp4", size_bytes: 1, expires_at: new Date(Date.now() + expires).toISOString() };
    };
    const old = await mk("final", null, -1000);
    const fresh = await mk("cut", "c1", 86_400_000);
    expect((await db.from("exports").insert([old, fresh])).error).toBeNull();

    const n = await purgeExpired(db);
    expect(n).toBeGreaterThanOrEqual(1);

    const { data: left } = await db.from("exports").select("storage_path").eq("project_id", p!.id);
    expect(left).toEqual([{ storage_path: fresh.storage_path }]);
    expect((await db.storage.from("exports").download(old.storage_path)).error).not.toBeNull();
    expect((await db.storage.from("exports").download(fresh.storage_path)).error).toBeNull();
    await db.storage.from("exports").remove([fresh.storage_path]);
  });
});
