import { describe, expect, it } from "vitest";
import { normalizeCta, normalizeCtas, normalizeProfile, ValidationError } from "../../src/lib/profile/schema";

describe("normalizeCta", () => {
  it("whatsapp mantém só dígitos e aceita o 55 na frente", () => {
    expect(normalizeCta({ kind: "whatsapp", label: "", value: "(11) 99999-0000" }).value).toBe("11999990000");
    expect(normalizeCta({ kind: "whatsapp", label: "", value: "+55 11 99999-0000" }).value).toBe("11999990000");
  });

  it("recusa telefone curto ou com letras demais", () => {
    expect(() => normalizeCta({ kind: "phone", label: "", value: "12345" })).toThrow(ValidationError);
    expect(() => normalizeCta({ kind: "whatsapp", label: "", value: "abc" })).toThrow(ValidationError);
  });

  it("link ganha https:// e recusa esquemas perigosos", () => {
    expect(normalizeCta({ kind: "link", label: "", value: "gravai.app/loja" }).value).toBe("https://gravai.app/loja");
    expect(() => normalizeCta({ kind: "link", label: "", value: "javascript:alert(1)" })).toThrow(ValidationError);
    expect(() => normalizeCta({ kind: "link", label: "", value: "localhost" })).toThrow(ValidationError);
  });

  it("bio normaliza o @ e usa rótulo padrão", () => {
    expect(normalizeCta({ kind: "bio", label: "", value: "seu.perfil" })).toEqual({
      kind: "bio",
      label: "Instagram",
      value: "@seu.perfil",
    });
    expect(() => normalizeCta({ kind: "bio", label: "", value: "com espaço" })).toThrow(ValidationError);
  });

  it("recusa tipo desconhecido e valor vazio", () => {
    expect(() => normalizeCta({ kind: "email", label: "", value: "a@b.c" })).toThrow(ValidationError);
    expect(() => normalizeCta({ kind: "link", label: "", value: "  " })).toThrow(ValidationError);
  });

  it("limita a quantidade de CTAs", () => {
    const um = { kind: "phone", label: "", value: "1133330000" };
    expect(normalizeCtas(Array(10).fill(um))).toHaveLength(10);
    expect(() => normalizeCtas(Array(11).fill(um))).toThrow(ValidationError);
  });
});

describe("normalizeProfile", () => {
  it("só devolve o que veio definido e troca texto vazio por null", () => {
    expect(normalizeProfile({ niche: "  fé  ", audience: "" })).toEqual({ niche: "fé", audience: null });
    expect(normalizeProfile({ onboarded: true })).toEqual({ onboarded: true });
  });

  it("valida o tom contra o enum", () => {
    expect(normalizeProfile({ tone: "descontraido" })).toEqual({ tone: "descontraido" });
    expect(() => normalizeProfile({ tone: "agressivo" })).toThrow(ValidationError);
  });

  it("recusa texto grande demais", () => {
    expect(() => normalizeProfile({ niche: "x".repeat(121) })).toThrow(ValidationError);
  });
});
