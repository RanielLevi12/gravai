import { createHash, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  upserts: [] as Record<string, unknown>[],
  upsertError: null as unknown,
  deletes: [] as { table: string; col: string; val: string }[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: (table: string) => ({
      delete: () => ({
        eq: async (col: string, val: string) => {
          state.deletes.push({ table, col, val });
          return { error: null };
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: async (row: Record<string, unknown>) => {
        state.upserts.push(row);
        return { error: state.upsertError };
      },
    }),
  }),
}));

import { GET as callback } from "@/app/api/ai/callback/route";
import { GET as connect } from "@/app/api/ai/connect/route";
import { POST as disconnect } from "@/app/api/ai/disconnect/route";
import { decryptKey, verifySigned } from "@/lib/ai/keys";

const ORIGIN = "http://localhost:3000";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const KEY = "sk-or-v1-chave-secreta-do-usuario-9f3a";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", randomBytes(32).toString("base64"));
  state.user = { id: USER_A };
  state.upserts = [];
  state.upsertError = null;
  state.deletes = [];
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ key: KEY, user_id: "or-user" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Roda o connect e devolve o que o navegador levaria ao callback. */
async function startFlow() {
  const res = await connect(new NextRequest(`${ORIGIN}/api/ai/connect`));
  const cookie = res.cookies.getAll()[0];
  const loc = new URL(res.headers.get("location")!);
  return { res, cookie, loc };
}

function callbackReq(query: string, cookie?: { name: string; value: string }) {
  const headers = cookie ? { cookie: `${cookie.name}=${cookie.value}` } : undefined;
  return new NextRequest(`${ORIGIN}/api/ai/callback?${query}`, { headers });
}

async function fullText(res: Response) {
  const headers = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
  return headers + "\n" + (await res.clone().text());
}

describe("GET /api/ai/connect", () => {
  it("sem sessão → 401", async () => {
    state.user = null;
    const res = await connect(new NextRequest(`${ORIGIN}/api/ai/connect`));
    expect(res.status).toBe(401);
    expect(res.cookies.getAll()).toHaveLength(0);
  });

  it("com sessão → redireciona ao OpenRouter com PKCE S256, state e cookie do verifier", async () => {
    const { res, cookie, loc } = await startFlow();
    expect([302, 303, 307]).toContain(res.status);
    expect(loc.origin + loc.pathname).toBe("https://openrouter.ai/auth");
    expect(loc.searchParams.get("callback_url")).toBe(`${ORIGIN}/api/ai/callback`);
    expect(loc.searchParams.get("code_challenge_method")).toBe("S256");
    expect(loc.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(loc.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    expect(cookie).toBeDefined();
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/api/ai");
    expect(cookie.maxAge).toBeGreaterThan(0);
    expect(cookie.maxAge).toBeLessThanOrEqual(15 * 60);
    // o verifier (dentro do cookie assinado) não vai na URL
    const verifier = verifySigned(cookie.value)!.split(".")[1]; // payload = userId.verifier.state
    expect(verifier).toBeTruthy();
    expect(res.headers.get("location")).not.toContain(verifier);
    expect(res.headers.get("location")).not.toContain(USER_A);
  });
});

describe("GET /api/ai/callback", () => {
  it("code válido: troca com o verifier, grava a chave cifrada e não a devolve", async () => {
    const { cookie, loc } = await startFlow();
    const res = await callback(callbackReq(`code=abc123&state=${loc.searchParams.get("state")}`, cookie));

    expect(res.headers.get("location")).toBe(`${ORIGIN}/perfil?ia=conectada`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/auth/keys");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.code).toBe("abc123");
    expect(body.code_challenge_method).toBe("S256");
    // o verifier enviado bate com o challenge que foi ao OpenRouter
    expect(createHash("sha256").update(body.code_verifier).digest("base64url")).toBe(
      loc.searchParams.get("code_challenge"),
    );

    expect(state.upserts).toHaveLength(1);
    const row = state.upserts[0];
    expect(row.user_id).toBe(USER_A);
    expect(row.provider).toBe("openrouter");
    expect(row.key_hint).toBe("9f3a");
    expect(row.key_ciphertext).not.toBe(KEY);
    expect(String(row.key_ciphertext)).not.toContain(KEY);
    expect(decryptKey(String(row.key_ciphertext))).toBe(KEY);

    expect(await fullText(res)).not.toContain(KEY);
    // cookie apagado
    const cleared = res.cookies.get(cookie.name);
    expect(cleared?.value ?? "").toBe("");
  });

  it("sem cookie do verifier → /perfil?ia=erro, sem troca", async () => {
    const res = await callback(callbackReq("code=abc123&state=x"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/perfil?ia=erro`);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.upserts).toHaveLength(0);
  });

  it("state diferente do cookie → erro (CSRF)", async () => {
    const { cookie } = await startFlow();
    const res = await callback(callbackReq("code=abc123&state=outro", cookie));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/perfil?ia=erro`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cookie iniciado por outro usuário → erro", async () => {
    const { cookie, loc } = await startFlow();
    state.user = { id: USER_B };
    const res = await callback(callbackReq(`code=abc123&state=${loc.searchParams.get("state")}`, cookie));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/perfil?ia=erro`);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.upserts).toHaveLength(0);
  });

  it("cookie adulterado → erro", async () => {
    const { cookie, loc } = await startFlow();
    const forged = { name: cookie.name, value: cookie.value.replace(/^[^.]+/, USER_B) };
    state.user = { id: USER_B };
    const res = await callback(callbackReq(`code=abc123&state=${loc.searchParams.get("state")}`, forged));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/perfil?ia=erro`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("OpenRouter recusa a troca → erro, nada gravado", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Invalid code" }), { status: 403 }));
    const { cookie, loc } = await startFlow();
    const res = await callback(callbackReq(`code=abc123&state=${loc.searchParams.get("state")}`, cookie));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/perfil?ia=erro`);
    expect(state.upserts).toHaveLength(0);
  });

  it("falha ao gravar → erro e a chave não aparece na resposta", async () => {
    state.upsertError = { message: "db down" };
    const { cookie, loc } = await startFlow();
    const res = await callback(callbackReq(`code=abc123&state=${loc.searchParams.get("state")}`, cookie));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/perfil?ia=erro`);
    expect(await fullText(res)).not.toContain(KEY);
  });

  it("sem sessão → 401", async () => {
    const { cookie, loc } = await startFlow();
    state.user = null;
    const res = await callback(callbackReq(`code=abc123&state=${loc.searchParams.get("state")}`, cookie));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignora qualquer destino vindo da URL (sem open redirect)", async () => {
    const { cookie, loc } = await startFlow();
    const res = await callback(
      callbackReq(`code=abc123&state=${loc.searchParams.get("state")}&next=https://evil.example`, cookie),
    );
    expect(new URL(res.headers.get("location")!).origin).toBe(ORIGIN);
  });
});

describe("POST /api/ai/disconnect", () => {
  it("apaga a linha do usuário e volta ao perfil", async () => {
    const res = await disconnect(new NextRequest(`${ORIGIN}/api/ai/disconnect`, { method: "POST", headers: { origin: ORIGIN } }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/perfil`);
    expect(state.deletes).toEqual([{ table: "ai_connections", col: "user_id", val: USER_A }]);
  });

  it("origem de outro site → 403", async () => {
    const res = await disconnect(
      new NextRequest(`${ORIGIN}/api/ai/disconnect`, { method: "POST", headers: { origin: "https://evil.example" } }),
    );
    expect(res.status).toBe(403);
    expect(state.deletes).toHaveLength(0);
  });

  it("sem sessão → 401", async () => {
    state.user = null;
    const res = await disconnect(new NextRequest(`${ORIGIN}/api/ai/disconnect`, { method: "POST", headers: { origin: ORIGIN } }));
    expect(res.status).toBe(401);
  });
});
