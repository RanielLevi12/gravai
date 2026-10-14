import { describe, expect, it, vi } from "vitest";
import { usd } from "@/components/ui/CostBar";
import { fetchBalanceUsd } from "@/lib/ai/cost";
import { createOpenRouterAi } from "@/lib/ai/openrouter";
import type { AiUsage } from "@/lib/ai/usage-types";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

function replyWith(usage: unknown) {
  return (async () =>
    new Response(
      JSON.stringify({
        id: "gen-1",
        object: "chat.completion",
        created: 0,
        model: "openai/teste",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: '{"a":1}' } }],
        ...(usage ? { usage } : {}),
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
}

describe("custo de cada chamada (usage.cost do OpenRouter)", () => {
  it("avisa o custo, o modelo e os tokens", async () => {
    const seen: AiUsage[] = [];
    const ai = createOpenRouterAi("sk-or-v1-teste", {
      fetch: replyWith({ prompt_tokens: 100, completion_tokens: 40, total_tokens: 140, cost: 0.0123 }),
      onUsage: (u) => seen.push(u),
    });
    await ai.rawJson({ type: "object" }, "s", "u");
    expect(seen).toEqual([{ kind: "text", model: "openai/teste", costUsd: 0.0123, promptTokens: 100, completionTokens: 40 }]);
  });

  it("sem usage.cost na resposta, não registra nada (e a chamada segue)", async () => {
    const seen: AiUsage[] = [];
    const ai = createOpenRouterAi("sk-or-v1-teste", { fetch: replyWith({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }), onUsage: (u) => seen.push(u) });
    await expect(ai.rawJson({ type: "object" }, "s", "u")).resolves.toBe('{"a":1}');
    expect(seen).toEqual([]);
  });
});

describe("fetchBalanceUsd", () => {
  const get = (map: Record<string, Record<string, unknown> | null>) => (async (path: string) => map[path] ?? null) as never;

  it("usa o que sobra do limite da chave", async () => {
    expect(await fetchBalanceUsd("k", get({ "/key": { limit_remaining: 4.5 } }))).toBe(4.5);
  });
  it("sem limite na chave, usa os créditos da conta", async () => {
    expect(await fetchBalanceUsd("k", get({ "/key": { limit_remaining: null }, "/credits": { total_credits: 10, total_usage: 3.25 } }))).toBe(6.75);
  });
  it("sem nenhuma resposta útil, saldo desconhecido", async () => {
    expect(await fetchBalanceUsd("k", get({}))).toBeNull();
  });
  it("nunca negativo", async () => {
    expect(await fetchBalanceUsd("k", get({ "/key": { limit_remaining: -1 } }))).toBe(0);
  });
});

describe("usd", () => {
  it("mostra mais casas para custos pequenos", () => {
    expect(usd(0.0123)).toMatch(/0,0123/);
    expect(usd(4.5)).toMatch(/4,50/);
    expect(usd(0)).toMatch(/0,00/);
  });
});
