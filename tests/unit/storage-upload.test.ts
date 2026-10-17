import { describe, expect, it, vi } from "vitest";
import { MAX_FILE_BYTES, MSG_FILE_TOO_BIG, MSG_STORAGE_FULL } from "@/lib/record/limits";
import { PART_SIZE, UploadError, completeUploadWith, partUrlsWith, startUploadWith } from "@/lib/storage/upload";

function deps(o: { row?: boolean; fits?: boolean; parts?: { PartNumber: number; ETag: string; Size: number }[] | null; size?: number | null } = {}) {
  const r2 = {
    createMultipart: vi.fn(async () => "NEW"),
    listParts: vi.fn(async () => (o.parts === undefined ? null : o.parts)),
    presignPart: vi.fn(async (_k: string, _u: string, n: number) => `https://r2/part/${n}`),
    completeMultipart: vi.fn(async () => {}),
    size: vi.fn(async () => (o.size === undefined ? 100 : o.size)),
    deleteMany: vi.fn(async () => {}),
  };
  const db = {
    uploadingRow: vi.fn(async () => (o.row === false ? null : { id: "r1", path: "u1/p1/r1.webm", mime: "video/webm" })),
    storageFits: vi.fn(async () => o.fits !== false),
  };
  return { db, r2, d: { db, r2 } as never };
}
const rec = "r1";

describe("startUploadWith", () => {
  it("abre envio novo no caminho vindo do banco, com prefixo do balde", async () => {
    const { d, r2 } = deps();
    expect(await startUploadWith(d, { recordingId: rec, size: 100 })).toEqual({ uploadId: "NEW", partSize: PART_SIZE, done: [] });
    expect(r2.createMultipart).toHaveBeenCalledWith("recordings/u1/p1/r1.webm", "video/webm");
  });

  it("retoma: devolve as partes que o R2 já tem (só as inteiras e a última)", async () => {
    const size = PART_SIZE * 2 + 10;
    const { d, r2 } = deps({
      parts: [
        { PartNumber: 1, ETag: "a", Size: PART_SIZE },
        { PartNumber: 2, ETag: "b", Size: 5 },
      ],
    });
    const res = await startUploadWith(d, { recordingId: rec, size, uploadId: "OLD" });
    expect(res).toEqual({ uploadId: "OLD", partSize: PART_SIZE, done: [{ PartNumber: 1, ETag: "a" }] });
    expect(r2.createMultipart).not.toHaveBeenCalled();
  });

  it("uploadId que o R2 não conhece vira envio novo", async () => {
    const { d } = deps({ parts: null });
    expect((await startUploadWith(d, { recordingId: rec, size: 100, uploadId: "GONE" })).uploadId).toBe("NEW");
  });

  it("recusa gravação que não é do usuário, vídeo grande demais, vazio e cota cheia", async () => {
    await expect(startUploadWith(deps({ row: false }).d, { recordingId: rec, size: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(startUploadWith(deps().d, { recordingId: rec, size: MAX_FILE_BYTES + 1 })).rejects.toThrow(MSG_FILE_TOO_BIG);
    await expect(startUploadWith(deps().d, { recordingId: rec, size: 0 })).rejects.toBeInstanceOf(UploadError);
    await expect(startUploadWith(deps({ fits: false }).d, { recordingId: rec, size: 10 })).rejects.toThrow(MSG_STORAGE_FULL);
  });
});

describe("partUrlsWith", () => {
  it("assina cada parte pedida", async () => {
    const { d } = deps();
    expect(await partUrlsWith(d, { recordingId: rec, uploadId: "U", partNumbers: [1, 4] })).toEqual([
      { PartNumber: 1, url: "https://r2/part/1" },
      { PartNumber: 4, url: "https://r2/part/4" },
    ]);
  });

  it("recusa número de parte inválido, lista vazia, longa demais e gravação alheia", async () => {
    const { d } = deps();
    for (const partNumbers of [[0], [1.5], [100000], [], Array.from({ length: 30 }, (_, i) => i + 1)])
      await expect(partUrlsWith(d, { recordingId: rec, uploadId: "U", partNumbers })).rejects.toBeInstanceOf(UploadError);
    await expect(partUrlsWith(deps({ row: false }).d, { recordingId: rec, uploadId: "U", partNumbers: [1] })).rejects.toMatchObject({ status: 404 });
  });
});

describe("completeUploadWith", () => {
  const parts = [{ PartNumber: 1, ETag: "a" }];

  it("junta as partes e devolve o tamanho que o R2 mediu", async () => {
    const { d, r2 } = deps({ size: 777 });
    expect(await completeUploadWith(d, { recordingId: rec, uploadId: "U", parts })).toEqual({ sizeBytes: 777 });
    expect(r2.completeMultipart).toHaveBeenCalledWith("recordings/u1/p1/r1.webm", "U", parts);
  });

  it("arquivo que não chegou, ou que estoura a cota, é recusado (e o estouro é apagado)", async () => {
    await expect(completeUploadWith(deps({ size: null }).d, { recordingId: rec, uploadId: "U", parts })).rejects.toMatchObject({ status: 409 });
    const full = deps({ fits: false });
    await expect(completeUploadWith(full.d, { recordingId: rec, uploadId: "U", parts })).rejects.toThrow(MSG_STORAGE_FULL);
    expect(full.r2.deleteMany).toHaveBeenCalledWith(["recordings/u1/p1/r1.webm"]);
    const big = deps({ size: MAX_FILE_BYTES + 1 });
    await expect(completeUploadWith(big.d, { recordingId: rec, uploadId: "U", parts })).rejects.toThrow(MSG_FILE_TOO_BIG);
  });

  it("recusa lista de partes inválida", async () => {
    await expect(completeUploadWith(deps().d, { recordingId: rec, uploadId: "U", parts: [] })).rejects.toBeInstanceOf(UploadError);
    await expect(completeUploadWith(deps().d, { recordingId: rec, uploadId: "U", parts: [{ PartNumber: 1, ETag: "" }] })).rejects.toBeInstanceOf(UploadError);
  });
});
