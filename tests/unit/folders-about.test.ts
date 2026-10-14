import { describe, expect, it } from "vitest";
import { buildScriptUser } from "@/lib/script/prompts";

const base = { sourceText: "texto", interview: {}, profile: null, episode: null, platforms: ["reels" as const], mainSeconds: 60 };

describe("'Sobre este projeto' no prompt do script", () => {
  it("entra quando o vídeo está num projeto", () => {
    expect(buildScriptUser({ ...base, about: "  devocional cristão, tom acolhedor " })).toContain(
      "Sobre o projeto deste vídeo (tema e público do canal): devocional cristão, tom acolhedor",
    );
  });
  it("não aparece em vídeo solto nem com texto vazio", () => {
    expect(buildScriptUser(base)).not.toContain("Sobre o projeto");
    expect(buildScriptUser({ ...base, about: "   " })).not.toContain("Sobre o projeto");
  });
});
