import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Db } from "../src/claim";
import { download } from "../src/storage";

/** Db falso: só o createSignedUrl que o download usa. */
function fakeDb(signed: { signedUrl: string } | null, error: { message: string } | null = null): Db {
  return { storage: { from: () => ({ createSignedUrl: async () => ({ data: signed, error }) }) } } as unknown as Db;
}

describe("download", () => {
  it("grava o arquivo inteiro no disco", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "dl-"));
    const dest = path.join(dir, "a.webm");
    const bytes = Buffer.from("pedaço de vídeo ".repeat(1000));
    await download(fakeDb({ signedUrl: `data:application/octet-stream;base64,${bytes.toString("base64")}` }), "recordings", "u/p/a.webm", dest);
    expect((await readFile(dest)).equals(bytes)).toBe(true);
  });

  it("erro do Storage vira erro com o caminho", async () => {
    const dest = path.join(await mkdtemp(path.join(tmpdir(), "dl-")), "b.webm");
    await expect(download(fakeDb(null, { message: "Object not found" }), "recordings", "u/p/b.webm", dest)).rejects.toThrow(
      "download recordings/u/p/b.webm: Object not found",
    );
  });
});
