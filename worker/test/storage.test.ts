import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/claim";
import { sweepOrphans } from "../src/purge";
import { download, r2Key, setR2ForTests, upload } from "../src/storage";

// lib-storage monta o envio sozinho; aqui só conferimos o que ele recebe (o envio de verdade é provado no scripts/r2-smoke.ts).
const up = vi.hoisted(() => ({ params: [] as { Bucket?: string; Key?: string; ContentType?: string; Body?: unknown }[], fail: null as Error | null }));
vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class {
    constructor(public o: { params: (typeof up.params)[number] }) {}
    async done() {
      if (up.fail) throw up.fail;
      up.params.push(this.o.params);
      await new Promise((r) => (this.o.params.Body as Readable).resume().on("end", r));
    }
  },
}));

const db = {} as Db;
const fake = (send: (cmd: unknown) => unknown) => setR2ForTests({ client: { send: vi.fn(async (c: unknown) => send(c)), config: { requestHandler: {} } } as unknown as S3Client, bucket: "b" });
afterEach(() => {
  setR2ForTests(null);
  up.fail = null;
});

describe("download", () => {
  it("grava o arquivo inteiro no disco, lendo a chave com o prefixo do balde", async () => {
    const bytes = Buffer.from("pedaço de vídeo ".repeat(1000));
    let key = "";
    fake((c) => {
      key = (c as GetObjectCommand).input.Key!;
      return { Body: Readable.from([bytes.subarray(0, 5000), bytes.subarray(5000)]) };
    });
    const dest = path.join(await mkdtemp(path.join(tmpdir(), "dl-")), "a.webm");
    await download(db, "recordings", "u/p/a.webm", dest);
    expect(key).toBe("recordings/u/p/a.webm");
    expect((await readFile(dest)).equals(bytes)).toBe(true);
  });

  it("erro do R2 vira erro com o caminho", async () => {
    fake(() => {
      throw new Error("NoSuchKey");
    });
    const dest = path.join(await mkdtemp(path.join(tmpdir(), "dl-")), "b.webm");
    await expect(download(db, "recordings", "u/p/b.webm", dest)).rejects.toThrow("download recordings/u/p/b.webm: NoSuchKey");
  });
});

describe("upload", () => {
  it("envia em stream para exports/ e devolve o tamanho", async () => {
    up.params.length = 0;
    fake(() => ({}));
    const file = path.join(await mkdtemp(path.join(tmpdir(), "up-")), "v.mp4");
    await writeFile(file, Buffer.alloc(1234, 1));
    const r = await upload(db, "u/p/v.mp4", file, "video/mp4");
    expect(r).toEqual({ sizeBytes: 1234 });
    expect(up.params[0].Body).toBeInstanceOf(Readable);
    expect(up.params[0]).toMatchObject({ Bucket: "b", Key: r2Key("exports", "u/p/v.mp4"), ContentType: "video/mp4" });
  });

  it("falha do R2 vira erro com o caminho", async () => {
    fake(() => ({}));
    up.fail = new Error("AccessDenied");
    const file = path.join(await mkdtemp(path.join(tmpdir(), "up-")), "v.mp4");
    await writeFile(file, "x");
    await expect(upload(db, "u/p/v.mp4", file, "video/mp4")).rejects.toThrow("upload exports/u/p/v.mp4: AccessDenied");
  });
});

describe("sweepOrphans", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const old = new Date("2026-10-10T00:00:00Z");

  it("apaga só o que é velho e não está em exports", async () => {
    let deleted: string[] = [];
    fake((c) => {
      if (c instanceof ListObjectsV2Command)
        return {
          Contents: [
            { Key: "exports/u/p/known.mp4", LastModified: old },
            { Key: "exports/u/p/orphan.mp4", LastModified: old },
            { Key: "exports/u/p/fresh.mp4", LastModified: new Date("2026-10-20T11:00:00Z") },
          ],
        };
      if (c instanceof DeleteObjectsCommand) deleted = c.input.Delete!.Objects!.map((o) => o.Key!);
      return {};
    });
    const dbFake = { from: () => ({ select: async () => ({ data: [{ storage_path: "u/p/known.mp4" }], error: null }) }) } as unknown as Db;
    expect(await sweepOrphans(dbFake, now)).toBe(1);
    expect(deleted).toEqual(["exports/u/p/orphan.mp4"]);
  });

  it("sem arquivos velhos não consulta o banco", async () => {
    fake(() => ({ Contents: [] }));
    expect(await sweepOrphans({} as Db, now)).toBe(0);
  });
});
