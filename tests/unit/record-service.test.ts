import { describe, expect, it, vi } from "vitest";
import type { RecordDb } from "@/lib/record/db";
import { MAX_FILE_BYTES, MSG_FILE_TOO_BIG, MSG_STORAGE_FULL } from "@/lib/record/limits";
import { approveWith, discardRecordingWith, finishRecordingWith, startRecordingWith } from "@/lib/record/service";

type Ready = { id: string; kind: "take" | "block" | "external"; blockId: string | null; path: string; durationSeconds: number | null };

function fakeDb(opts: { mainSeconds?: number; blocks?: string[]; ready?: Ready[]; noProject?: boolean; status?: string; removeFails?: boolean; full?: boolean } = {}) {
  let n = 0;
  const rows = new Map<string, { kind: Ready["kind"]; blockId: string | null; path: string; status: string }>();
  const readyList: Ready[] = [...(opts.ready ?? [])];
  const db = {
    project: vi.fn(async () => (opts.noProject ? null : { id: "p1", status: opts.status ?? "gravacao", interview: { mainSeconds: opts.mainSeconds ?? 60 } })),
    blockIds: vi.fn(async () => opts.blocks ?? ["b1", "b2"]),
    insertUploading: vi.fn(async (r: { projectId: string; kind: Ready["kind"]; blockId: string | null; mime: string }) => {
      const id = `r${++n}`;
      const path = `u1/${r.projectId}/${id}.webm`;
      rows.set(id, { kind: r.kind, blockId: r.blockId, path, status: "uploading" });
      return { id, path };
    }),
    markReady: vi.fn(async (id: string) => {
      const row = rows.get(id);
      if (!row) return null;
      const replaced = readyList.filter((x) => x.kind === row.kind && x.blockId === row.blockId);
      for (const x of replaced) readyList.splice(readyList.indexOf(x), 1);
      row.status = "ready";
      readyList.push({ id, kind: row.kind, blockId: row.blockId, path: row.path, durationSeconds: null });
      return { replacedPaths: replaced.map((x) => x.path) };
    }),
    deleteRow: vi.fn(async (id: string) => {
      const row = rows.get(id);
      if (!row) return null;
      if (row.status === "ready") return "ready" as const;
      rows.delete(id);
      return { path: row.path };
    }),
    readyRows: vi.fn(async () => [...readyList]),
    setProjectStatus: vi.fn(async () => true),
    storageFits: vi.fn(async () => !opts.full),
    uploadingRow: vi.fn(async () => null),
    removeFiles: vi.fn(async (_p: string[]) => {
      if (opts.removeFails) throw new Error("boom");
    }),
  } satisfies RecordDb;
  return db;
}

describe("startRecordingWith", () => {
  it("recusa take em vídeo de 5 min", async () => {
    const db = fakeDb({ mainSeconds: 300 });
    await expect(startRecordingWith(db, { projectId: "p1", kind: "take", blockId: null, mime: "video/webm" })).rejects.toThrow("Para um vídeo de 5 min, grave por blocos.");
    expect(db.insertUploading).not.toHaveBeenCalled();
  });
  it("recusa bloco sem blockId ou fora do projeto", async () => {
    const db = fakeDb();
    await expect(startRecordingWith(db, { projectId: "p1", kind: "block", blockId: null, mime: "video/webm" })).rejects.toThrow("Bloco não encontrado.");
    await expect(startRecordingWith(db, { projectId: "p1", kind: "block", blockId: "zz", mime: "video/webm" })).rejects.toThrow("Bloco não encontrado.");
  });
  it("recusa projeto inexistente e mime inválido", async () => {
    await expect(startRecordingWith(fakeDb({ noProject: true }), { projectId: "p1", kind: "take", blockId: null, mime: "video/webm" })).rejects.toThrow("Projeto não encontrado.");
    await expect(startRecordingWith(fakeDb(), { projectId: "p1", kind: "take", blockId: null, mime: "image/png" })).rejects.toThrow();
  });
  it("repassa o corte 9:16 para a gravação (ou nulo)", async () => {
    const db = fakeDb();
    const crop = { x: 656, y: 0, w: 606, h: 1080 };
    await startRecordingWith(db, { projectId: "p1", kind: "take", blockId: null, mime: "video/mp4;codecs=avc1,mp4a", crop });
    await startRecordingWith(db, { projectId: "p1", kind: "take", blockId: null, mime: "video/webm" });
    expect(db.insertUploading).toHaveBeenNthCalledWith(1, expect.objectContaining({ crop }));
    expect(db.insertUploading).toHaveBeenNthCalledWith(2, expect.objectContaining({ crop: null }));
  });
  it("aceita mime com codecs e bloco válido", async () => {
    const db = fakeDb();
    const r = await startRecordingWith(db, { projectId: "p1", kind: "block", blockId: "b1", mime: "video/webm;codecs=vp9,opus" });
    expect(r.id).toBe("r1");
    expect(db.insertUploading).toHaveBeenCalledOnce();
  });
});

describe("finishRecordingWith — cota", () => {
  it("recusa quando o espaço acabou, sem marcar a gravação como pronta", async () => {
    const db = fakeDb({ full: true });
    await expect(finishRecordingWith(db, "r1", { sizeBytes: 10, durationSeconds: 1 })).rejects.toThrow(MSG_STORAGE_FULL);
    expect(db.markReady).not.toHaveBeenCalled();
  });
});

describe("finishRecordingWith", () => {
  it("recusa arquivo grande demais e não marca nada", async () => {
    const db = fakeDb();
    await expect(finishRecordingWith(db, "r1", { sizeBytes: MAX_FILE_BYTES + 1, durationSeconds: 1 })).rejects.toThrow(MSG_FILE_TOO_BIG);
    expect(db.markReady).not.toHaveBeenCalled();
  });
  it("refazer apaga o arquivo da primeira gravação", async () => {
    const db = fakeDb();
    const a = await startRecordingWith(db, { projectId: "p1", kind: "block", blockId: "b1", mime: "video/webm" });
    await finishRecordingWith(db, a.id, { sizeBytes: 10, durationSeconds: 3 });
    expect(db.removeFiles).not.toHaveBeenCalled();
    const b = await startRecordingWith(db, { projectId: "p1", kind: "block", blockId: "b1", mime: "video/webm" });
    await finishRecordingWith(db, b.id, { sizeBytes: 10, durationSeconds: 3 });
    expect(db.removeFiles).toHaveBeenCalledWith([a.path]);
  });
  it("gravação inexistente dá erro", async () => {
    await expect(finishRecordingWith(fakeDb(), "nope", { sizeBytes: 1, durationSeconds: null })).rejects.toThrow("Gravação não encontrada.");
  });
});

describe("discardRecordingWith", () => {
  it("apaga a linha e o arquivo", async () => {
    const db = fakeDb();
    const a = await startRecordingWith(db, { projectId: "p1", kind: "take", blockId: null, mime: "video/webm" });
    await discardRecordingWith(db, a.id);
    expect(db.removeFiles).toHaveBeenCalledWith([a.path]);
  });
});

describe("regras novas", () => {
  it("finish recusa tamanho zero", async () => {
    const db = fakeDb();
    await expect(finishRecordingWith(db, "r1", { sizeBytes: 0, durationSeconds: 1 })).rejects.toThrow("O vídeo ficou vazio. Grave de novo.");
    expect(db.markReady).not.toHaveBeenCalled();
  });
  it("discard de gravação já pronta é recusado e não apaga arquivo", async () => {
    const db = fakeDb();
    const a = await startRecordingWith(db, { projectId: "p1", kind: "take", blockId: null, mime: "video/webm" });
    await finishRecordingWith(db, a.id, { sizeBytes: 5, durationSeconds: 1 });
    await expect(discardRecordingWith(db, a.id)).rejects.toThrow("Esta gravação já foi enviada.");
    expect(db.removeFiles).not.toHaveBeenCalled();
  });
  it("discard com falha em removeFiles ainda tem sucesso", async () => {
    const db = fakeDb({ removeFails: true });
    const a = await startRecordingWith(db, { projectId: "p1", kind: "take", blockId: null, mime: "video/webm" });
    await expect(discardRecordingWith(db, a.id)).resolves.toBeUndefined();
  });
  it("approve de 'fonte' é recusado", async () => {
    const db = fakeDb({ status: "fonte" });
    expect(await approveWith(db, "p1", "blocks")).toEqual({ ok: false, error: "Termine o script antes de aprovar." });
    expect(db.setProjectStatus).not.toHaveBeenCalled();
  });
  it.each(["gravado", "pronto"])("approve de '%s' é ok e não mexe no status", async (status) => {
    const db = fakeDb({ status });
    expect(await approveWith(db, "p1", "blocks")).toEqual({ ok: true });
    expect(db.setProjectStatus).not.toHaveBeenCalled();
  });
});

describe("approveWith", () => {
  const r = (blockId: string): Ready => ({ id: blockId, kind: "block", blockId, path: `u1/p1/${blockId}.webm`, durationSeconds: null });
  it("blocos faltando: erro e não muda status", async () => {
    const db = fakeDb({ ready: [r("b1")] });
    const res = await approveWith(db, "p1", "blocks");
    expect(res).toEqual({ ok: false, error: "Falta gravar 1 bloco." });
    expect(db.setProjectStatus).not.toHaveBeenCalled();
  });
  it("script sem blocos: erro", async () => {
    const db = fakeDb({ blocks: [] });
    expect(await approveWith(db, "p1", "blocks")).toEqual({ ok: false, error: "O script não tem blocos para gravar." });
    expect(db.setProjectStatus).not.toHaveBeenCalled();
  });
  it("ok marca gravado", async () => {
    const db = fakeDb({ ready: [r("b1"), r("b2")] });
    expect(await approveWith(db, "p1", "blocks")).toEqual({ ok: true });
    expect(db.setProjectStatus).toHaveBeenCalledWith("p1", "gravado");
  });
  it("take não permitido em 5 min", async () => {
    const db = fakeDb({ mainSeconds: 300, ready: [{ id: "t", kind: "take", blockId: null, path: "x", durationSeconds: null }] });
    const res = await approveWith(db, "p1", "take");
    expect(res.ok).toBe(false);
    expect(db.setProjectStatus).not.toHaveBeenCalled();
  });
});
