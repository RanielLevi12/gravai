import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { appendChunk, clearRecording, listPending, markMeta, readRecording } from "@/lib/record/store";

const realIdb = globalThis.indexedDB;

afterEach(() => {
  globalThis.indexedDB = realIdb;
});

describe("record store", () => {
  it("junta os pedaços na ordem com o tamanho somado", async () => {
    await appendChunk("r1", new Blob(["aaa"]));
    await appendChunk("r1", new Blob(["bb"]));
    await appendChunk("r1", new Blob(["c"]));
    const blob = await readRecording("r1", "video/webm");
    expect(blob).not.toBeNull();
    expect(blob!.size).toBe(6);
    expect(blob!.type).toBe("video/webm");
    expect(await blob!.text()).toBe("aaabbc");
    await clearRecording("r1");
  });

  it("lista a gravação pendente até limpar", async () => {
    await appendChunk("r2", new Blob(["x"]));
    await markMeta("r2", { mime: "video/webm", projectId: "p1", kind: "take", blockId: null });
    const before = await listPending();
    const found = before.find((p) => p.recordingId === "r2");
    expect(found?.mime).toBe("video/webm");
    expect(typeof found?.startedAt).toBe("number");
    await clearRecording("r2");
    expect((await listPending()).some((p) => p.recordingId === "r2")).toBe(false);
    expect(await readRecording("r2", "video/webm")).toBeNull();
  });

  it("sem IndexedDB não lança e devolve vazio", async () => {
    // @ts-expect-error simula navegador sem IndexedDB
    globalThis.indexedDB = undefined;
    await expect(appendChunk("r3", new Blob(["x"]))).resolves.toBeUndefined();
    expect(await readRecording("r3", "video/webm")).toBeNull();
    expect(await listPending()).toEqual([]);
  });
});
