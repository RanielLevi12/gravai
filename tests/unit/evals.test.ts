import { beforeEach, describe, expect, it } from "vitest";
import * as mockProvider from "@/lib/ai/mock";
import { resetMock } from "@/lib/ai/mock";
import { userAiFrom } from "@/lib/ai";
import { currentPipeline, evaluate, formatComparison, legacyPipeline, type Judge } from "../evals/harness";
import { SOURCES } from "../evals/fontes";

// Com AI_MOCK: nenhum dinheiro, nenhuma chave. Prova que a bateria roda de ponta a ponta e calcula as médias.
const judge: Judge = {
  title: mockProvider.scoreViral,
  hook: async (t) => (await mockProvider.reviewExcerpts(t, { restart: false })).hook,
  closing: mockProvider.scoreClosing,
};
const ai = () => userAiFrom(mockProvider);

beforeEach(() => resetMock());

describe("fontes de exemplo", () => {
  it("são 20, com id único, texto e duração válida", () => {
    expect(SOURCES).toHaveLength(20);
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(20);
    for (const s of SOURCES) {
      expect(s.text.split(/\s+/).length).toBeGreaterThan(40);
      expect([30, 60, 90]).toContain(s.mainSeconds);
    }
    expect(new Set(SOURCES.map((s) => s.niche)).size).toBeGreaterThanOrEqual(6);
  });
});

describe("bateria do roteiro", () => {
  it("roda antes e depois nas 20 fontes e calcula as médias do jev", async () => {
    const before = await evaluate(SOURCES, legacyPipeline(ai(), judge), judge);
    const after = await evaluate(SOURCES, currentPipeline(ai(), judge), judge);
    for (const r of [before, after]) {
      expect(r.failed).toEqual([]);
      expect(r.rows).toHaveLength(20);
      for (const n of [r.mean.title, r.mean.hook, r.mean.closing, r.mean.jev]) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
      expect(r.mean.jev).toBeCloseTo((r.mean.title + r.mean.hook + r.mean.closing) / 3, 2);
    }
    const table = formatComparison(before, after);
    expect(table).toContain("Nota média do jev");
    expect(table).toContain("Fontes avaliadas: 20 antes, 20 depois. Falhas: 0.");
  });

  it("uma fonte que falha não derruba as outras", async () => {
    const r = await evaluate(
      SOURCES.slice(0, 3),
      async (s) => {
        if (s.id === SOURCES[1].id) throw new Error("caiu");
        return { title: "t", opening: "abertura", closing: "fecho", script: "texto" };
      },
      judge,
    );
    expect(r.failed).toEqual([SOURCES[1].id]);
    expect(r.rows).toHaveLength(2);
  });
});
