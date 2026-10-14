import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, estimatedBytes, fitsBucket } from "@/lib/record/limits";

describe("fitsBucket", () => {
  it("aceita até 50 MB e recusa acima", () => {
    expect(fitsBucket(MAX_FILE_BYTES)).toBe(true);
    expect(fitsBucket(MAX_FILE_BYTES + 1)).toBe(false);
  });
});

describe("estimatedBytes", () => {
  it("200 s cabem no limite e 260 s não", () => {
    expect(estimatedBytes(200)).toBeLessThanOrEqual(MAX_FILE_BYTES);
    expect(estimatedBytes(260)).toBeGreaterThan(MAX_FILE_BYTES);
  });
});
