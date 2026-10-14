import { describe, expect, it } from "vitest";
import { blockRanges, cutRange, expiresAt, missingBlocks, targetBitrates } from "../src/plan";
import { wrapTitle } from "../src/covers";

describe("blockRanges / cutRange", () => {
  it("acumula a duração real de cada bloco", () => {
    expect(blockRanges([3, 2, 5])).toEqual([
      { startSeconds: 0, endSeconds: 3 },
      { startSeconds: 3, endSeconds: 5 },
      { startSeconds: 5, endSeconds: 10 },
    ]);
  });

  it("corte vai do início do primeiro bloco ao fim do último (posições a partir de 1)", () => {
    const ranges = blockRanges([3, 2, 5]);
    expect(cutRange(ranges, { start: 2, end: 3 })).toEqual({ startSeconds: 3, endSeconds: 10 });
    expect(cutRange(ranges, { start: 1, end: 1 })).toEqual({ startSeconds: 0, endSeconds: 3 });
  });

  it("corte que aponta para bloco inexistente falha", () => {
    expect(() => cutRange(blockRanges([3]), { start: 1, end: 2 })).toThrow();
  });
});

describe("missingBlocks", () => {
  it("devolve as posições (a partir de 1) sem gravação", () => {
    expect(missingBlocks(["a", "b", "c"], new Set(["a", "c"]))).toEqual([2]);
    expect(missingBlocks(["a"], new Set(["a"]))).toEqual([]);
  });
});

describe("targetBitrates", () => {
  it("cabe: mantém 1800 kbps", () => {
    expect(targetBitrates(60, 50e6)).toEqual({ videoKbps: 1800, audioKbps: 96 });
  });

  it("não cabe: reduz até o arquivo caber", () => {
    const { videoKbps, audioKbps } = targetBitrates(400, 50e6);
    expect(videoKbps).toBeLessThan(1800);
    expect(((videoKbps + audioKbps) * 400 * 1000) / 8).toBeLessThanOrEqual(50e6);
  });

  it("nunca desce de um piso mínimo", () => {
    expect(targetBitrates(100000, 50e6).videoKbps).toBe(200);
  });
});

describe("expiresAt", () => {
  it("30 dias depois", () => {
    expect(expiresAt(new Date("2026-10-14T00:00:00Z")).toISOString().slice(0, 10)).toBe("2026-11-13");
  });
});

describe("wrapTitle", () => {
  it("quebra o título em linhas de até 22 letras sem cortar palavras", () => {
    expect(wrapTitle("O hábito de 2 minutos que muda o seu dia")).toBe("O hábito de 2 minutos\nque muda o seu dia");
  });

  it("título curto fica em uma linha e palavra enorme não some", () => {
    expect(wrapTitle("Oi")).toBe("Oi");
    expect(wrapTitle("supercalifragilisticoexpialidoso ok")).toBe("supercalifragilisticoexpialidoso\nok");
  });
});
