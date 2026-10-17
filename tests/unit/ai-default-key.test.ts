import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

delete process.env.AI_MOCK;

const state = vi.hoisted(() => ({ userKey: null as string | null, spent: 0, spendFails: false, created: [] as { key: string }[], recorded: [] as unknown[] }));
vi.mock("@/lib/ai/keys", () => ({ getUserAiKey: async () => state.userKey }));
vi.mock("@/lib/ai/limit", async () => {
  const real = await vi.importActual<typeof import("@/lib/ai/limit")>("@/lib/ai/limit");
  return {
    ...real,
    assertUnderLimit: (id: string) =>
      real.assertUnderLimit(id, async () => {
        if (state.spendFails) throw new Error("db");
        return state.spent;
      }, 3),
  };
});
vi.mock("@/lib/ai/openrouter", () => ({
  createOpenRouterAi: (key: string, o: { onUsage?: (u: unknown) => void }) => {
    state.created.push({ key });
    o.onUsage?.({ kind: "text", model: "m", costUsd: 0.01 });
    return { ocrImages: async () => "", ocrPdf: async () => "", transcribeAudio: async () => ({ text: "", seconds: 0 }), transcribeWords: async () => ({ words: [], seconds: 0 }), rawJson: async () => "{}" };
  },
}));
vi.mock("@/lib/ai/usage", () => ({ recordAiUsage: async (_u: string, u: unknown) => void state.recorded.push(u) }));

import { withUserAi } from "@/lib/ai";
import { AiError } from "@/lib/ai/schemas";
import { DEFAULT_MONTHLY_LIMIT_USD, monthlyLimitUsd } from "@/lib/ai/limit";

const UID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  state.userKey = null;
  state.spent = 0;
  state.spendFails = false;
  state.created = [];
  state.recorded = [];
  vi.stubEnv("OPENROUTER_API_KEY", "chave-do-servidor-de-teste");
  vi.stubEnv("OPENROUTER_DEV_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("IA padrão do Gravaí", () => {
  it("sem conta do usuário usa a chave do servidor e marca o gasto como do app", async () => {
    await withUserAi(UID);
    expect(state.created).toEqual([{ key: "chave-do-servidor-de-teste" }]);
    expect(state.recorded).toEqual([{ kind: "text", model: "m", costUsd: 0.01, billedTo: "app" }]);
  });

  it("a conta do usuário (OAuth ou colada) tem prioridade e o gasto é dele", async () => {
    state.userKey = "sk-or-do-usuario";
    await withUserAi(UID);
    expect(state.created).toEqual([{ key: "sk-or-do-usuario" }]);
    expect(state.recorded).toEqual([{ kind: "text", model: "m", costUsd: 0.01, billedTo: "user" }]);
  });

  it("limite mensal estourado recusa antes de chamar o provedor", async () => {
    state.spent = 3;
    await expect(withUserAi(UID)).rejects.toMatchObject({ code: "limit_reached" });
    expect(state.created).toEqual([]);
  });

  it("limite estourado não atrapalha quem usa a própria conta", async () => {
    state.spent = 99;
    state.userKey = "sk-or-do-usuario";
    await expect(withUserAi(UID)).resolves.toBeDefined();
  });

  it("se não der para medir o gasto, recusa (protege o dinheiro)", async () => {
    state.spendFails = true;
    await expect(withUserAi(UID)).rejects.toMatchObject({ code: "provider" });
    expect(state.created).toEqual([]);
  });

  it("sem conta do usuário e sem chave do servidor: pede para conectar", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const e = await withUserAi(UID).catch((x) => x);
    expect(e).toBeInstanceOf(AiError);
    expect(e.code).toBe("not_connected");
  });
});

describe("limite mensal", () => {
  it("usa AI_MONTHLY_LIMIT_USD quando válido e o padrão quando não", () => {
    expect(monthlyLimitUsd("10")).toBe(10);
    expect(monthlyLimitUsd("0.5")).toBe(0.5);
    for (const v of [undefined, "", "abc", "0", "-2"]) expect(monthlyLimitUsd(v)).toBe(DEFAULT_MONTHLY_LIMIT_USD);
  });
});
