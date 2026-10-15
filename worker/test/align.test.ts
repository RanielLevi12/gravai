import { describe, expect, it } from "vitest";
import { alignBlocks, type Word } from "../src/align";

const w = (text: string, s: number, e: number): Word => ({ w: text, s, e });

describe("alignBlocks", () => {
  const blocks = ["Olá, mundo!", "Tudo bem com você?"];
  const spoken = [w("olá", 0.2, 0.6), w("mundo", 0.7, 1.2), w("tudo", 2.0, 2.4), w("bem", 2.5, 2.8), w("com", 2.9, 3.1), w("você", 3.2, 3.6)];

  it("fala igual ao texto: cada bloco cobre as suas palavras, sem sobrepor o vizinho", () => {
    const { ranges, confidence } = alignBlocks(blocks, spoken);
    expect(confidence).toBe(1);
    expect(ranges[0].startSeconds).toBeLessThanOrEqual(0.2);
    expect(ranges[0].endSeconds).toBeGreaterThanOrEqual(1.2);
    expect(ranges[0].endSeconds).toBeLessThanOrEqual(1.7);
    expect(ranges[1].startSeconds).toBeGreaterThanOrEqual(1.6);
    expect(ranges[1].startSeconds).toBeLessThanOrEqual(2.0);
    expect(ranges[1].startSeconds).toBeGreaterThanOrEqual(ranges[0].endSeconds);
    expect(ranges[1].endSeconds).toBeGreaterThanOrEqual(3.6);
  });

  it("uma palavra a menos e uma a mais ainda alinham", () => {
    const messy = [w("olá", 0.2, 0.6), w("mundo", 0.7, 1.2), w("tudo", 2.0, 2.4), w("bem", 2.5, 2.8), w("voce", 3.2, 3.6), w("ontem", 3.7, 4.0)];
    const { ranges, confidence } = alignBlocks(blocks, messy);
    expect(confidence).toBeGreaterThan(0.8);
    expect(ranges[1].startSeconds).toBeGreaterThanOrEqual(1.6);
    expect(ranges[1].endSeconds).toBeGreaterThanOrEqual(4.0);
  });

  it("maiúsculas, acentos e pontuação não atrapalham", () => {
    const { confidence } = alignBlocks(["Olá, mundo!"], [w("OLA", 0, 0.4), w("Mundo.", 0.5, 1)]);
    expect(confidence).toBe(1);
  });

  it("texto totalmente diferente → confiança baixa", () => {
    const other = [w("banana", 0, 1), w("laranja", 1, 2), w("abacaxi", 2, 3), w("melancia", 3, 4), w("uva", 4, 5), w("pera", 5, 6)];
    expect(alignBlocks(blocks, other).confidence).toBeLessThan(0.3);
  });

  it("bloco que ninguém falou fica entre os vizinhos, sem desordem", () => {
    const { ranges } = alignBlocks(["um dois", "três quatro", "cinco seis"], [w("um", 0, 0.4), w("dois", 0.5, 0.9), w("cinco", 5, 5.4), w("seis", 5.5, 5.9)]);
    expect(ranges).toHaveLength(3);
    expect(ranges[1].startSeconds).toBeGreaterThanOrEqual(ranges[0].endSeconds);
    expect(ranges[1].endSeconds).toBeLessThanOrEqual(ranges[2].startSeconds);
  });

  it("sem fala nenhuma não quebra", () => {
    const { ranges, confidence } = alignBlocks(["Olá"], []);
    expect(ranges).toHaveLength(1);
    expect(confidence).toBe(0);
  });
});
