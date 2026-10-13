import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptKey, encryptKey, signValue, verifySigned } from "@/lib/ai/keys";

beforeEach(() => vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", randomBytes(32).toString("base64")));
afterEach(() => vi.unstubAllEnvs());

/** Troca um caractere no meio de um trecho base64url (o último pode ter bits ignorados). */
function tamper(cipher: string, part: number): string {
  const parts = cipher.split(":");
  const s = parts[part];
  const i = Math.floor(s.length / 2);
  parts[part] = s.slice(0, i) + (s[i] === "A" ? "B" : "A") + s.slice(i + 1);
  return parts.join(":");
}

describe("cifragem da chave de IA", () => {
  it("ida e volta", () => {
    expect(decryptKey(encryptKey("sk-or-abc"))).toBe("sk-or-abc");
  });

  it("formato v1:<iv>:<tag>:<ciphertext> em base64url, sem o texto em claro", () => {
    const c = encryptKey("sk-or-v1-segredo");
    expect(c).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    const [, iv, tag] = c.split(":");
    expect(Buffer.from(iv, "base64url")).toHaveLength(12);
    expect(Buffer.from(tag, "base64url")).toHaveLength(16);
    expect(c).not.toContain("segredo");
  });

  it("duas cifragens do mesmo texto diferem (IV aleatório)", () => {
    expect(encryptKey("sk-or-abc")).not.toBe(encryptKey("sk-or-abc"));
  });

  it("texto cifrado ou tag adulterados fazem decryptKey lançar", () => {
    const c = encryptKey("sk-or-uma-chave-mais-longa-para-ter-meio");
    expect(() => decryptKey(tamper(c, 3))).toThrow();
    expect(() => decryptKey(tamper(c, 2))).toThrow();
    expect(() => decryptKey(c.replace(/^v1/, "v2"))).toThrow();
    expect(() => decryptKey("lixo")).toThrow();
  });

  it("sem AI_KEY_ENCRYPTION_SECRET lança", () => {
    vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", "");
    expect(() => encryptKey("x")).toThrow();
  });

  it("segredo com tamanho errado lança", () => {
    vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", randomBytes(16).toString("base64"));
    expect(() => encryptKey("x")).toThrow();
  });

  it("chave cifrada com outro segredo não abre", () => {
    const c = encryptKey("sk-or-abc");
    vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", randomBytes(32).toString("base64"));
    expect(() => decryptKey(c)).toThrow();
  });
});

describe("valor assinado (cookie do OAuth)", () => {
  it("verifica o que assinou e recusa adulteração", () => {
    const s = signValue("user.verifier.state");
    expect(verifySigned(s)).toBe("user.verifier.state");
    expect(verifySigned(s.slice(0, -2) + "xx")).toBeNull();
    expect(verifySigned("outro.valor." + s.split(".").pop())).toBeNull();
    expect(verifySigned("")).toBeNull();
  });
});
