import { describe, expect, it } from "vitest";
import { plural, projectCard, videoCard } from "@/lib/project/review-cards";

describe("videoCard", () => {
  it("soma as gravações e o tempo", () => {
    expect(videoCard([{ duration_seconds: 20 }, { duration_seconds: null }, { duration_seconds: 15 }], "gravacao")).toEqual({ count: 3, seconds: 35, approved: false });
  });
  it("aprovado quando o vídeo já foi guardado", () => {
    expect(videoCard([], "gravado").approved).toBe(true);
    expect(videoCard([], "pronto").approved).toBe(true);
  });
});

describe("projectCard", () => {
  it("projeto com nome, cor e quantidade; sem projeto vira vídeo solto", () => {
    expect(projectCard({ name: "Devocional", color: "azul" }, 4)).toEqual({ kind: "folder", name: "Devocional", color: "azul", videos: 4 });
    expect(projectCard(null, 0)).toEqual({ kind: "loose" });
  });
  it("plural em português", () => {
    expect(plural(1, "gravação", "gravações")).toBe("1 gravação");
    expect(plural(0, "gravação", "gravações")).toBe("0 gravações");
  });
});
