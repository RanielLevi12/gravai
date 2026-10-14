import { describe, expect, it } from "vitest";
import { MSG_FILE_NOT_FOUND, signedUrlWith, type DeliveryDb, type ExportRow } from "@/lib/delivery/service";

const row = (over: Partial<ExportRow>): ExportRow => ({
  id: "e1",
  kind: "cut",
  cutId: "c2",
  storagePath: "u1/p1/e1.mp4",
  mime: "video/mp4",
  durationSeconds: 12,
  sizeBytes: 100,
  expiresAt: "2026-11-13T00:00:00Z",
  ...over,
});

/** Banco falso: `mine` são as linhas que a RLS deixaria o usuário ver. */
function fakeDb(mine: ExportRow[]): DeliveryDb & { signed: { path: string; seconds: number; name: string | null }[] } {
  const signed: { path: string; seconds: number; name: string | null }[] = [];
  return {
    signed,
    async project() {
      return null;
    },
    async latestJob() {
      return null;
    },
    async createJob() {
      return "j";
    },
    async exportsOf() {
      return mine;
    },
    async cuts() {
      return [
        { id: "c1", title: "A", start: 1, end: 1, descriptions: {} },
        { id: "c2", title: "B", start: 2, end: 2, descriptions: {} },
      ];
    },
    async signUrl(path, seconds, name) {
      signed.push({ path, seconds, name });
      return `https://exemplo.test/${path}?exp=${seconds}`;
    },
  };
}

describe("signedUrlWith", () => {
  it("arquivo de outro usuário (a RLS não devolve a linha) → não encontrado", async () => {
    await expect(signedUrlWith(fakeDb([]), "p1", "e1")).rejects.toThrow(MSG_FILE_NOT_FOUND);
  });

  it("arquivo próprio → URL de 300 s com o nome do arquivo", async () => {
    const db = fakeDb([row({})]);
    const res = await signedUrlWith(db, "p1", "e1");
    expect(res.url).toContain("exp=300");
    expect(db.signed).toEqual([{ path: "u1/p1/e1.mp4", seconds: 300, name: "corte-02.mp4" }]);
  });

  it("final e capa têm os nomes certos", async () => {
    const db = fakeDb([row({ id: "f", kind: "final", cutId: null }), row({ id: "k", kind: "cover", cutId: "c1", mime: "image/jpeg", storagePath: "u1/p1/k.jpg" })]);
    await signedUrlWith(db, "p1", "f");
    await signedUrlWith(db, "p1", "k");
    expect(db.signed.map((s) => s.name)).toEqual(["final.mp4", "capa-01.jpg"]);
  });

  it("id que não é de arquivo desse projeto → não encontrado", async () => {
    await expect(signedUrlWith(fakeDb([row({})]), "p1", "outro")).rejects.toThrow(MSG_FILE_NOT_FOUND);
  });
});
