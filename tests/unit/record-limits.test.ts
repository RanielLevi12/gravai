import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, MAX_TAKE_SECONDS, estimatedBytes, fitsBucket, maxSecondsFor } from "@/lib/record/limits";

describe("fitsBucket", () => {
  it("aceita até 500 MB e recusa acima", () => {
    expect(MAX_FILE_BYTES).toBe(500 * 1024 * 1024);
    expect(fitsBucket(MAX_FILE_BYTES)).toBe(true);
    expect(fitsBucket(MAX_FILE_BYTES + 1)).toBe(false);
  });
});

describe("estimatedBytes", () => {
  it("200 s em 720p (~4 Mbps) ficam por volta de 100 MB", () => {
    expect(estimatedBytes(200)).toBeGreaterThan(95 * 1024 * 1024);
    expect(estimatedBytes(200)).toBeLessThan(MAX_FILE_BYTES);
  });
});

describe("maxSecondsFor", () => {
  it("1080p a 7 Mbps cabe em 200 s", () => {
    expect(maxSecondsFor(7_000_000)).toBe(MAX_TAKE_SECONDS);
  });
  it("bitrate alto demais: o tempo máximo é 500 MB ÷ bitrate (com 5% de folga)", () => {
    const s = maxSecondsFor(30_000_000);
    expect(s).toBeLessThan(MAX_TAKE_SECONDS);
    expect((s * (30_000_000 + 128_000)) / 8).toBeLessThanOrEqual(MAX_FILE_BYTES * 0.95);
  });
});
