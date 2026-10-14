import { describe, expect, it } from "vitest";
import { pxPerSecond, stepSpeed } from "@/lib/record/scroll";

describe("pxPerSecond", () => {
  it("converte palavras por minuto em pixels por segundo", () => {
    expect(pxPerSecond(120, 6, 40)).toBeCloseTo(13.333);
  });
});

describe("stepSpeed", () => {
  it("anda de 10 em 10 e fica entre 80 e 260", () => {
    expect(stepSpeed(80, -1)).toBe(80);
    expect(stepSpeed(260, 1)).toBe(260);
    expect(stepSpeed(140, 1)).toBe(150);
  });
});
