import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { createR2, r2Key } from "@/lib/storage/r2";

function make(send: (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => unknown = () => ({})) {
  const client = new S3Client({
    region: "auto",
    endpoint: "https://acc.r2.cloudflarestorage.com",
    forcePathStyle: true,
    credentials: { accessKeyId: "AK", secretAccessKey: "SK" },
  });
  const spy = vi.fn(async (c: never) => send(c));
  client.send = spy as never;
  return { r2: createR2(client, "bucket"), spy };
}

describe("r2Key", () => {
  it("põe o balde antigo como prefixo", () => {
    expect(r2Key("recordings", "u/p/a.webm")).toBe("recordings/u/p/a.webm");
    expect(r2Key("exports", "u/p/a.mp4")).toBe("exports/u/p/a.mp4");
  });
});

describe("links pré-assinados", () => {
  it("leitura aponta para o R2, expira e pode forçar o nome do download", async () => {
    const url = new URL(await make().r2.presignGet("exports/u/p/a.mp4", 300, 'video "final".mp4'));
    expect(url.host).toBe("acc.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/bucket/exports/u/p/a.mp4");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("response-content-disposition")).toBe('attachment; filename="video _final_.mp4"');
  });

  it("leitura sem nome não força download", async () => {
    const url = new URL(await make().r2.presignGet("recordings/u/p/a.webm", 300));
    expect(url.searchParams.has("response-content-disposition")).toBe(false);
  });

  it("parte do envio leva uploadId e número da parte", async () => {
    const url = new URL(await make().r2.presignPart("recordings/u/p/a.webm", "UP1", 3, 3600));
    expect(url.searchParams.get("uploadId")).toBe("UP1");
    expect(url.searchParams.get("partNumber")).toBe("3");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
  });
});

describe("operações", () => {
  it("listParts junta páginas e devolve null se o envio não existe mais", async () => {
    let page = 0;
    const { r2 } = make(() =>
      page++ === 0
        ? { Parts: [{ PartNumber: 1, ETag: '"a"', Size: 8 }], IsTruncated: true, NextPartNumberMarker: 1 }
        : { Parts: [{ PartNumber: 2, ETag: '"b"', Size: 4 }], IsTruncated: false },
    );
    expect(await r2.listParts("k", "u")).toEqual([
      { PartNumber: 1, ETag: '"a"', Size: 8 },
      { PartNumber: 2, ETag: '"b"', Size: 4 },
    ]);
    const gone = make(() => {
      throw Object.assign(new Error("x"), { name: "NoSuchUpload" });
    });
    expect(await gone.r2.listParts("k", "u")).toBeNull();
  });

  it("completeMultipart manda as partes em ordem", async () => {
    const { r2, spy } = make();
    await r2.completeMultipart("k", "u", [
      { PartNumber: 2, ETag: "b" },
      { PartNumber: 1, ETag: "a" },
    ]);
    expect((spy.mock.calls[0][0] as { input: { MultipartUpload: { Parts: { PartNumber: number }[] } } }).input.MultipartUpload.Parts.map((p) => p.PartNumber)).toEqual([1, 2]);
  });

  it("size devolve null quando não existe", async () => {
    const { r2 } = make(() => {
      throw Object.assign(new Error("x"), { name: "NotFound" });
    });
    expect(await r2.size("k")).toBeNull();
    expect(await make(() => ({ ContentLength: 42 })).r2.size("k")).toBe(42);
  });

  it("deleteMany apaga em lotes de 1000 e acusa erro", async () => {
    const { r2, spy } = make();
    await r2.deleteMany(Array.from({ length: 2500 }, (_, i) => `k${i}`));
    expect(spy).toHaveBeenCalledTimes(3);
    await expect(make(() => ({ Errors: [{ Key: "k" }] })).r2.deleteMany(["k"])).rejects.toThrow("não apagou 1");
    const none = make();
    await none.r2.deleteMany([]);
    expect(none.spy).not.toHaveBeenCalled();
  });
});
