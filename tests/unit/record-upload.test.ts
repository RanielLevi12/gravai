import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MSG_UPLOAD_FAILED, UploadRejected, uploadRecording } from "@/lib/record/upload";

const PART = 8 * 1024 * 1024;
type Call = { path: string; body: Record<string, unknown> };

/** Servidor falso: responde /api/upload/* como as rotas de verdade. */
function server(o: { done?: { PartNumber: number; ETag: string }[]; startError?: { status: number; error: string }; completeStatus?: number } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string }) => {
      const path = url.replace("/api/upload/", "");
      const body = JSON.parse(init.body);
      calls.push({ path, body });
      const ok = (j: unknown) => ({ ok: true, status: 200, json: async () => j });
      if (path === "start") return o.startError ? { ok: false, status: o.startError.status, json: async () => ({ error: o.startError!.error }) } : ok({ uploadId: "U1", partSize: PART, done: o.done ?? [] });
      if (path === "part-urls") return ok({ urls: body.partNumbers.map((n: number) => ({ PartNumber: n, url: `https://r2/${n}` })) });
      return o.completeStatus ? { ok: false, status: o.completeStatus, json: async () => null } : ok({ sizeBytes: 4242 });
    }),
  );
  return calls;
}

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("uploadRecording", () => {
  it("manda em partes de 8 MB, reporta o progresso e conclui com o tamanho do R2", async () => {
    const calls = server();
    const put = vi.fn(async (url: string, _b: Blob, onProgress: (n: number) => void) => (onProgress(1), `"etag-${url.split("/").pop()}"`));
    const onProgress = vi.fn();
    const blob = new Blob([new Uint8Array(PART * 2 + 5)]);
    const res = await uploadRecording({ blob, recordingId: "r1", onProgress }, put);
    expect(res).toEqual({ sizeBytes: 4242 });
    expect(put).toHaveBeenCalledTimes(3);
    expect(put.mock.calls.map((c) => c[1].size).sort((a, b) => a - b)).toEqual([5, PART, PART]);
    expect(onProgress).toHaveBeenLastCalledWith(blob.size, blob.size);
    const complete = calls.find((c) => c.path === "complete")!;
    expect(complete.body.parts).toEqual([1, 2, 3].map((n) => ({ PartNumber: n, ETag: `"etag-${n}"` })));
    expect(store.size).toBe(0); // envio concluído: esquece o uploadId
  });

  it("retoma: usa o uploadId guardado e não reenvia as partes que o R2 já tem", async () => {
    store.set("gravai:upload:r1", "OLD");
    const calls = server({ done: [{ PartNumber: 1, ETag: '"e1"' }] });
    const put = vi.fn(async (_url: string, _b: Blob) => '"e2"');
    await uploadRecording({ blob: new Blob([new Uint8Array(PART + 9)]), recordingId: "r1" }, put);
    expect(calls[0].body.uploadId).toBe("OLD");
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1].size).toBe(9);
  });

  it("tenta a parte de novo quando a rede falha", async () => {
    server();
    const put = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValue('"e"');
    const p = uploadRecording({ blob: new Blob(["video"]), recordingId: "r1" }, put);
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).resolves.toEqual({ sizeBytes: 4242 });
    expect(put).toHaveBeenCalledTimes(2);
  });

  it("rede que não volta vira a mensagem simples e guarda o envio para retomar", async () => {
    server();
    const put = vi.fn().mockRejectedValue(new Error("rede"));
    const p = uploadRecording({ blob: new Blob(["video"]), recordingId: "r1" }, put);
    p.catch(() => {});
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(p).rejects.toThrow(MSG_UPLOAD_FAILED);
    expect(store.get("gravai:upload:r1")).toBe("U1");
  });

  it("recusa do servidor (ex.: espaço cheio) mostra a mensagem dele e não tenta de novo", async () => {
    server({ startError: { status: 413, error: "Você usou os 5 GB de espaço." } });
    const put = vi.fn();
    const err = await uploadRecording({ blob: new Blob(["v"]), recordingId: "r1" }, put).catch((e) => e);
    expect(err).toBeInstanceOf(UploadRejected);
    expect(err.message).toBe("Você usou os 5 GB de espaço.");
    expect(put).not.toHaveBeenCalled();
  });

  it("falha ao juntar as partes vira a mensagem simples", async () => {
    server({ completeStatus: 500 });
    await expect(uploadRecording({ blob: new Blob(["v"]), recordingId: "r1" }, async () => '"e"')).rejects.toThrow(MSG_UPLOAD_FAILED);
  });
});
