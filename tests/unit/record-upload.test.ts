import { beforeEach, describe, expect, it, vi } from "vitest";

type Opts = {
  endpoint: string;
  chunkSize: number;
  retryDelays: number[];
  headers: Record<string, string>;
  metadata: Record<string, string>;
  removeFingerprintOnSuccess: boolean;
  onProgress: (a: number, b: number) => void;
  onError: (e: Error) => void;
  onSuccess: () => void;
};

const h = vi.hoisted(() => ({
  instances: [] as { file: Blob; options: Opts; start: ReturnType<typeof vi.fn>; abort: ReturnType<typeof vi.fn> }[],
}));

vi.mock("tus-js-client", () => ({
  Upload: class {
    start = vi.fn();
    abort = vi.fn(async () => {});
    constructor(
      public file: Blob,
      public options: Opts,
    ) {
      h.instances.push(this);
    }
  },
}));

import { uploadRecording } from "@/lib/record/upload";

const base = {
  blob: new Blob(["video"]),
  path: "u1/p1/r1.webm",
  mime: "video/webm",
  accessToken: "tok",
  supabaseUrl: "https://x.supabase.co",
};

beforeEach(() => {
  h.instances.length = 0;
});

describe("uploadRecording", () => {
  it("monta endpoint, headers, metadata e chunkSize", async () => {
    const p = uploadRecording(base);
    const u = h.instances[0];
    expect(u.start).toHaveBeenCalled();
    expect(u.options.endpoint).toBe("https://x.supabase.co/storage/v1/upload/resumable");
    expect(u.options.chunkSize).toBe(6 * 1024 * 1024);
    expect(u.options.retryDelays).toEqual([0, 1000, 3000, 5000, 10000]);
    expect(u.options.headers).toEqual({ authorization: "Bearer tok", "x-upsert": "true" });
    expect(u.options.metadata).toEqual({
      bucketName: "recordings",
      objectName: "u1/p1/r1.webm",
      contentType: "video/webm",
      cacheControl: "3600",
    });
    expect(u.options.removeFingerprintOnSuccess).toBe(true);
    u.options.onSuccess();
    await expect(p).resolves.toBeUndefined();
  });

  it("repassa o progresso", async () => {
    const onProgress = vi.fn();
    const p = uploadRecording({ ...base, onProgress });
    h.instances[0].options.onProgress(10, 100);
    expect(onProgress).toHaveBeenCalledWith(10, 100);
    h.instances[0].options.onSuccess();
    await p;
  });

  it("erro do tus vira mensagem simples", async () => {
    const p = uploadRecording(base);
    h.instances[0].options.onError(new Error("tus: failed, originated from request"));
    await expect(p).rejects.toThrow("Não consegui enviar o vídeo. Veja a internet e tente de novo.");
  });

  it("abort do signal chama upload.abort", async () => {
    const ac = new AbortController();
    const p = uploadRecording({ ...base, signal: ac.signal });
    p.catch(() => {});
    ac.abort();
    expect(h.instances[0].abort).toHaveBeenCalled();
    await expect(p).rejects.toThrow();
  });
});
