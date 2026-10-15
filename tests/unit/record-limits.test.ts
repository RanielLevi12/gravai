import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, estimatedBytes, fitsBucket } from "@/lib/record/limits";

describe("fitsBucket", () => {
  it("aceita até 500 MB e recusa acima", () => {
    expect(MAX_FILE_BYTES).toBe(500 * 1024 * 1024);
    expect(fitsBucket(MAX_FILE_BYTES)).toBe(true);
    expect(fitsBucket(MAX_FILE_BYTES + 1)).toBe(false);
  });
});

describe("estimatedBytes", () => {
  it("200 s em Normal ficam por volta de 47 MB", () => {
    expect(estimatedBytes(200)).toBeGreaterThan(45 * 1024 * 1024);
    expect(estimatedBytes(200)).toBeLessThan(MAX_FILE_BYTES);
  });
});
