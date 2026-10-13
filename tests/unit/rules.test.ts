import { describe, expect, it } from "vitest";
import { mainDurationOptions } from "@/lib/rules/duration";
import { estimateSeconds, targetWords } from "@/lib/rules/duration";
import {
  allowedCutDurations,
  estimateCutCount,
  suggestCutDuration,
} from "@/lib/rules/cuts";

describe("allowedCutDurations", () => {
  it("permite cortes até metade do vídeo principal", () => {
    expect(allowedCutDurations(60)).toEqual([10, 20, 30]);
    expect(allowedCutDurations(30)).toEqual([10]);
    expect(allowedCutDurations(180)).toEqual([10, 20, 30, 60]);
  });
});

describe("estimateSeconds e targetWords", () => {
  it("estima segundos pelo ritmo de 150 palavras por minuto", () => {
    expect(estimateSeconds("palavra ".repeat(150))).toBe(60);
    expect(targetWords(180)).toBe(450);
  });
});

describe("estimateCutCount", () => {
  it("estima a quantidade de cortes com 85% do vídeo aproveitável", () => {
    expect(estimateCutCount(180, 30)).toBe(5);
    expect(estimateCutCount(180, 10)).toBe(15);
  });
});

describe("suggestCutDuration", () => {
  it("sugere 30 s para formatos verticais quando permitido", () => {
    expect(suggestCutDuration(180, ["tiktok"])).toBe(30);
  });

  it("sugere o maior corte permitido para os demais formatos", () => {
    expect(suggestCutDuration(180, ["youtube"])).toBe(60);
    expect(suggestCutDuration(30, ["youtube"])).toBe(10);
  });
});

describe("mainDurationOptions", () => {
  it("desabilita durações acima do que o texto rende, com motivo", () => {
    const options = mainDurationOptions("palavra ".repeat(80));
    const byS = Object.fromEntries(options.map((o) => [o.seconds, o]));
    expect(byS[30].enabled).toBe(true);
    expect(byS[60].enabled).toBe(true);
    for (const s of [180, 300, 600]) {
      expect(byS[s].enabled).toBe(false);
      expect(byS[s].reason).toContain("~1 min");
    }
  });

  it("mantém a opção de 30 s habilitada mesmo com texto vazio", () => {
    const options = mainDurationOptions("");
    const byS = Object.fromEntries(options.map((o) => [o.seconds, o]));
    expect(byS[30].enabled).toBe(true);
    expect(byS[60].enabled).toBe(false);
  });
});
