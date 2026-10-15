import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/internal/wake/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const call = (auth?: string) => GET(new Request("http://x/api/internal/wake", { headers: auth ? { authorization: auth } : {} }));

describe("GET /api/internal/wake", () => {
  it("sem segredo configurado ou sem cabeçalho → 401", async () => {
    expect((await call()).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "s3");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer errado")).status).toBe(401);
  });

  it("com o segredo certo liga o worker", async () => {
    vi.stubEnv("CRON_SECRET", "s3");
    vi.stubEnv("FLY_API_TOKEN", "t");
    vi.stubEnv("FLY_APP", "app");
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: { method?: string }) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      return new Response(JSON.stringify([{ id: "m1", state: "stopped" }]), { status: 200 });
    });
    const res = await call("Bearer s3");
    expect(res.status).toBe(200);
    expect(calls).toEqual(["GET https://api.machines.dev/v1/apps/app/machines", "POST https://api.machines.dev/v1/apps/app/machines/m1/start"]);
  });
});
