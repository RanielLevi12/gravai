import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { safeNext } from "../../src/lib/auth/safe-next";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: null }) } }),
}));

const o = "http://localhost:3000";
const ataques = [
  "/\\evil.com",
  "/\t/evil.com",
  "//evil.com",
  "https://evil.com",
  "javascript:alert(1)",
  "/a/..//evil.com",
  "/.//evil.com",
  "/x/%2e%2e//evil.com",
  "",
];

describe("safeNext", () => {
  it("aceita caminho interno e mantém a query", () => {
    expect(safeNext("/perfil", o).href).toBe(`${o}/perfil`);
    expect(safeNext("/perfil?a=1", o).href).toBe(`${o}/perfil?a=1`);
  });
  it.each([...ataques, null])("recusa %s", (n) => {
    expect(safeNext(n, o).href).toBe(`${o}/projetos`);
  });
});

describe("GET /auth/callback", () => {
  it.each(ataques)("nunca redireciona para fora da origem (%s)", async (n) => {
    const { GET } = await import("../../src/app/auth/callback/route");
    const res = await GET(new NextRequest(`${o}/auth/callback?code=abc&next=${encodeURIComponent(n)}`));
    const loc = new URL(res.headers.get("location")!, o);
    expect(loc.origin).toBe(o);
    expect(loc.pathname).toBe("/projetos");
  });
  it("segue um destino interno válido", async () => {
    const { GET } = await import("../../src/app/auth/callback/route");
    const res = await GET(new NextRequest(`${o}/auth/callback?code=abc&next=%2Fperfil`));
    expect(res.headers.get("location")).toBe(`${o}/perfil`);
  });
});
