import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, styleFromSettings, summarizeSettings, validateFolderInput } from "@/lib/folders/schema";

const ok = (over: Record<string, unknown> = {}, settings: Record<string, unknown> = {}) => ({
  name: "  Devocional ",
  color: "azul",
  about: "devocional cristão",
  settings: { ...DEFAULT_SETTINGS, ...settings },
  ...over,
});

describe("validateFolderInput", () => {
  it("aceita os valores sugeridos e normaliza nome e plataformas", () => {
    const r = validateFolderInput(ok({}, { platforms: ["tiktok", "reels", "reels"] }), []);
    expect(r).toMatchObject({ ok: true, value: { name: "Devocional", color: "azul", about: "devocional cristão" } });
    if (r.ok) expect(r.value.settings.platforms).toEqual(["reels", "tiktok"]);
  });

  it("'Sobre' vazio vira null", () => {
    const r = validateFolderInput(ok({ about: "" }), []);
    expect(r.ok && r.value.about).toBeNull();
  });

  it.each([
    ["nome vazio", ok({ name: "   " }), "Dê um nome"],
    ["nome longo", ok({ name: "x".repeat(81) }), "no máximo 80"],
    ["cor fora da paleta", ok({ color: "neon" }), "Escolha uma cor"],
    ["sobre longo", ok({ about: "x".repeat(1001) }), "no máximo 1000"],
    ["sem plataforma", ok({}, { platforms: [] }), "pelo menos uma plataforma"],
    ["plataforma inválida", ok({}, { platforms: ["orkut"] }), "pelo menos uma plataforma"],
    ["formato inválido", ok({}, { format: "trilogia" }), "único ou série"],
    ["duração fora da lista", ok({}, { mainSeconds: 45 }), "durações"],
    ["corte maior que metade", ok({}, { mainSeconds: 30, cutSeconds: 30 }), "não cabe"],
    ["cenário inválido", ok({}, { scenery: { mode: "praia" } }), "cenário"],
    ["capa inválida", ok({}, { cover: "gif" }), "tipo de capa"],
    ["chamada de outra pessoa", ok({}, { ctaId: "abc" }), "suas chamadas"],
  ])("recusa %s", (_n, input, msg) => {
    const r = validateFolderInput(input, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });

  it("aceita sem cortes (null) e chamada própria", () => {
    const r = validateFolderInput(ok({}, { cutSeconds: null, ctaId: "meu-cta" }), ["meu-cta"]);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.value.settings).toMatchObject({ cutSeconds: null, ctaId: "meu-cta" });
  });

  it("não aceita entrada que não é objeto", () => {
    expect(validateFolderInput(null, []).ok).toBe(false);
    expect(validateFolderInput("x", []).ok).toBe(false);
  });
});

describe("summarizeSettings", () => {
  it("descreve o padrão sugerido", () => {
    expect(summarizeSettings(DEFAULT_SETTINGS)).toBe("Reels · vídeo único · 60 s · cortes de 30 s · sem chamada");
  });
  it("trata sem cortes, minutos e chamada com nome", () => {
    expect(summarizeSettings({ platforms: ["youtube", "facebook"], format: "series", mainSeconds: 300, cutSeconds: null, ctaId: "x" }, "WhatsApp")).toBe(
      "YouTube, Facebook · série · 5 min · sem cortes · chamada: WhatsApp",
    );
  });
  it("aceita configurações parciais (vídeo solto)", () => {
    expect(summarizeSettings({})).toBe("");
  });
});

describe("estilo do projeto (settings.style)", () => {
  const base = { name: "Canal", color: "rosa", about: null, settings: { platforms: ["reels"], format: "single", mainSeconds: 60, cutSeconds: 30, scenery: { mode: "natural", natural: "", aiPrompt: "" }, cover: "frame", ctaId: null } };
  it("sem estilo, o settings não ganha a chave", () => {
    const r = validateFolderInput(base, []);
    expect(r.ok && "style" in r.value.settings).toBe(false);
  });
  it("guarda tom, público e exemplos aparados; vazios somem", () => {
    const r = validateFolderInput({ ...base, settings: { ...base.settings, style: { tone: " acolhedor ", audience: "", examples: "Gente, vem comigo." } } }, []);
    expect(r.ok && r.value.settings.style).toEqual({ tone: "acolhedor", examples: "Gente, vem comigo." });
  });
  it("recusa estilo longo demais ou do tipo errado", () => {
    expect(validateFolderInput({ ...base, settings: { ...base.settings, style: { tone: "x".repeat(201) } } }, []).ok).toBe(false);
    expect(validateFolderInput({ ...base, settings: { ...base.settings, style: "texto" } }, []).ok).toBe(false);
  });
  it("styleFromSettings ignora lixo do banco", () => {
    expect(styleFromSettings({ style: { tone: "calmo" } })).toEqual({ tone: "calmo" });
    expect(styleFromSettings({ style: 5 })).toBeNull();
    expect(styleFromSettings(null)).toBeNull();
  });
});
