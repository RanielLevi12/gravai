import { describe, expect, it, vi } from "vitest";
import { checkOpenRouterKey, looksLikeOpenRouterKey, OPENROUTER_KEY_INFO_URL } from "@/lib/ai/connection";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const resposta = (status: number) => (async () => new Response("{}", { status })) as unknown as typeof fetch;

describe("looksLikeOpenRouterKey", () => {
  it("aceita o formato sk-or-", () => {
    expect(looksLikeOpenRouterKey("sk-or-v1-" + "a".repeat(40))).toBe(true);
  });
  it.each(["", "sk-or-curta", "abc-" + "a".repeat(40), "sk-or-v1-com espaço " + "a".repeat(30), "sk-or-" + "a".repeat(400)])("recusa %j", (k) => {
    expect(looksLikeOpenRouterKey(k)).toBe(false);
  });
});

describe("checkOpenRouterKey", () => {
  it("200 = ok, 401/403 = recusada, outros = indisponível", async () => {
    expect(await checkOpenRouterKey("k", resposta(200))).toBe("ok");
    expect(await checkOpenRouterKey("k", resposta(401))).toBe("invalid");
    expect(await checkOpenRouterKey("k", resposta(403))).toBe("invalid");
    expect(await checkOpenRouterKey("k", resposta(500))).toBe("unavailable");
  });
  it("falha de rede = indisponível", async () => {
    expect(await checkOpenRouterKey("k", (async () => Promise.reject(new Error("x"))) as unknown as typeof fetch)).toBe("unavailable");
  });
  it("manda a chave só no cabeçalho Authorization, para a rota de conferência", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    await checkOpenRouterKey("sk-or-segredo", f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENROUTER_KEY_INFO_URL);
    expect(url).not.toContain("segredo");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-or-segredo");
  });
});
