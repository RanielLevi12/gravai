import { describe, expect, it } from "vitest";
import { INHERITED_STEPS, customSteps, projectValue } from "@/lib/folders/inherit";
import { DEFAULT_SETTINGS } from "@/lib/folders/schema";
import { applyAnswer, firstMissing, type Interview } from "@/lib/interview/steps";

const copia = (): Interview => ({
  platforms: DEFAULT_SETTINGS.platforms,
  format: DEFAULT_SETTINGS.format,
  mainSeconds: DEFAULT_SETTINGS.mainSeconds,
  cutSeconds: DEFAULT_SETTINGS.cutSeconds,
  scenery: DEFAULT_SETTINGS.scenery,
  cover: DEFAULT_SETTINGS.cover,
  ctaId: DEFAULT_SETTINGS.ctaId,
});

describe("vídeo dentro de um projeto", () => {
  it("cópia fiel das configurações: só falta o título (entrevista curta)", () => {
    expect(firstMissing(copia())).toBe("titulos");
    expect(customSteps(copia(), DEFAULT_SETTINGS)).toEqual([]);
  });

  it("marca como personalizado só o que mudou", () => {
    const i = { ...copia(), mainSeconds: 180, cutSeconds: null, ctaId: "meu-cta" };
    expect(customSteps(i, DEFAULT_SETTINGS)).toEqual(["duracao", "cortes", "cta"]);
  });

  it("cenário e plataformas comparam pelo conteúdo", () => {
    const i = { ...copia(), scenery: { mode: "ai" as const, natural: "", aiPrompt: "praia" }, platforms: ["reels" as const, "tiktok" as const] };
    expect(customSteps(i, DEFAULT_SETTINGS)).toEqual(["plataformas", "cenario"]);
  });

  it("pergunta sem resposta não conta como personalizada", () => {
    const { mainSeconds: _m, cutSeconds: _c, ...i } = copia();
    expect(customSteps(i, DEFAULT_SETTINGS)).toEqual([]);
    expect(firstMissing(i)).toBe("duracao");
  });

  it("voltar ao padrão: o valor do projeto passa pela validação normal de cada pergunta", () => {
    const ctx = { sourceText: Array.from({ length: 600 }, (_, k) => `p${k}`).join(" "), ctaIds: [] };
    let i: Interview = { ...copia(), mainSeconds: 180, cutSeconds: null, titles: { options: [], chosen: "Meu título" } };
    for (const step of ["duracao", "cortes"] as const) {
      const r = applyAnswer(i, step, projectValue(step, DEFAULT_SETTINGS), ctx);
      if (!r.ok) throw new Error(r.error);
      i = r.interview;
    }
    expect(customSteps(i, DEFAULT_SETTINGS)).toEqual([]);
    expect(i.titles?.chosen).toBe("Meu título");
  });

  it("cobre todas as perguntas que o projeto preenche", () => {
    expect(INHERITED_STEPS.map((s) => projectValue(s, DEFAULT_SETTINGS)).length).toBe(7);
  });
});
