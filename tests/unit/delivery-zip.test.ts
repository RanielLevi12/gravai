import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { MSG_FILE_NOT_FOUND, MSG_PROJECT_NOT_FOUND, type DeliveryDb, type ExportRow } from "@/lib/delivery/service";
import { MSG_ZIP_TOO_BIG, ZipError, buildZip, descriptionsText, zipFor } from "@/lib/delivery/zip";

const bytes = (s: string) => new TextEncoder().encode(s);
const cut = (title: string, descriptions: Record<string, string>) => ({ title, descriptions });

describe("descriptionsText", () => {
  it("um bloco por corte e por plataforma, com título e descrição", () => {
    const text = descriptionsText([cut("Abertura", { reels: "Texto reels", tiktok: "Texto tiktok" }), cut("", { reels: "Outro" })], ["reels", "tiktok"]);
    expect(text).toContain("Corte 1 · Abertura");
    expect(text).toContain("Reels");
    expect(text).toContain("Texto tiktok");
    expect(text).toContain("Corte 2");
    expect(text).not.toContain("Corte 2 ·");
  });

  it("zero cortes → aviso", () => {
    expect(descriptionsText([], ["reels"])).toBe("Sem cortes.");
  });
});

describe("buildZip", () => {
  it("dois arquivos + descrições → final.mp4, corte-01.mp4 e descricoes.txt", async () => {
    const out = await buildZip(
      [
        { name: "final.mp4", data: bytes("F") },
        { name: "corte-01.mp4", data: bytes("C") },
      ],
      "desc",
    );
    const zip = await JSZip.loadAsync(out);
    expect(Object.keys(zip.files).sort()).toEqual(["corte-01.mp4", "descricoes.txt", "final.mp4"]);
    expect(await zip.file("descricoes.txt")!.async("string")).toBe("desc");
  });

  it("zero cortes → só final.mp4 e descricoes.txt com aviso", async () => {
    const out = await buildZip([{ name: "final.mp4", data: bytes("F") }], descriptionsText([], []));
    const zip = await JSZip.loadAsync(out);
    expect(Object.keys(zip.files).sort()).toEqual(["descricoes.txt", "final.mp4"]);
    expect(await zip.file("descricoes.txt")!.async("string")).toContain("Sem cortes");
  });
});

const row = (over: Partial<ExportRow>): ExportRow => ({
  id: "e1",
  kind: "final",
  cutId: null,
  storagePath: "u/p/e1.mp4",
  mime: "video/mp4",
  durationSeconds: 1,
  sizeBytes: 1,
  expiresAt: "2026-11-13T00:00:00Z",
  ...over,
});

function fakeDb(opts: { exports: ExportRow[]; mine?: boolean }): DeliveryDb {
  const mine = opts.mine ?? true;
  return {
    async project(id) {
      return mine ? { id, status: "pronto", scriptStale: false } : null;
    },
    async latestJob() {
      return null;
    },
    async createJob() {
      return "j";
    },
    async exportsOf() {
      return mine ? opts.exports : [];
    },
    async cuts() {
      return mine ? [{ id: "c1", title: "A", start: 1, end: 1, descriptions: { reels: "d1" } }] : [];
    },
    async signUrl() {
      return "";
    },
    async download(path) {
      return bytes(`conteudo:${path}`);
    },
  };
}

describe("zipFor", () => {
  it("dono: monta o zip com final, corte, capa e descrições", async () => {
    const db = fakeDb({
      exports: [
        row({}),
        row({ id: "e2", kind: "cut", cutId: "c1", storagePath: "u/p/e2.mp4" }),
        row({ id: "e3", kind: "cover", cutId: "c1", storagePath: "u/p/e3.jpg", mime: "image/jpeg" }),
      ],
    });
    const zip = await JSZip.loadAsync(await zipFor(db, "p"));
    expect(Object.keys(zip.files).sort()).toEqual(["capa-01.jpg", "corte-01.mp4", "descricoes.txt", "final.mp4"]);
    expect(await zip.file("descricoes.txt")!.async("string")).toContain("d1");
  });

  it("projeto sem cortes: só o final", async () => {
    const zip = await JSZip.loadAsync(await zipFor(fakeDb({ exports: [row({})] }), "p"));
    expect(Object.keys(zip.files).sort()).toEqual(["descricoes.txt", "final.mp4"]);
  });

  it("outro usuário (RLS esconde tudo) → projeto não encontrado", async () => {
    await expect(zipFor(fakeDb({ exports: [row({})], mine: false }), "p")).rejects.toMatchObject({ status: 404, message: MSG_PROJECT_NOT_FOUND });
  });

  it("sem arquivos prontos → arquivo não encontrado (404)", async () => {
    await expect(zipFor(fakeDb({ exports: [] }), "p")).rejects.toMatchObject({ status: 404, message: MSG_FILE_NOT_FOUND });
  });

  it("muito grande → 413 com mensagem", async () => {
    const db = fakeDb({ exports: [row({ sizeBytes: 250 * 1024 * 1024 })] });
    const err = await zipFor(db, "p").catch((e) => e);
    expect(err).toBeInstanceOf(ZipError);
    expect(err).toMatchObject({ status: 413, message: MSG_ZIP_TOO_BIG });
  });
});
