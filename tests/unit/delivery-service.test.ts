import { afterEach, describe, expect, it, vi } from "vitest";
import { MSG_ALREADY_RUNNING, MSG_NOT_RECORDED, createRenderJobWith, type DeliveryDb, type JobView } from "@/lib/delivery/service";
import { MSG_PROJECT_NOT_FOUND } from "@/lib/record/service";
import { wakeWorker } from "@/lib/delivery/trigger";

/** Banco falso que imita o índice único: só um pedido ativo por projeto. */
function fakeDb(status: string | null): DeliveryDb & { jobs: JobView[] } {
  const jobs: JobView[] = [];
  return {
    jobs,
    async project(id) {
      return status === null ? null : { id, status, scriptStale: false };
    },
    async latestJob() {
      return jobs.at(-1) ?? null;
    },
    async createJob() {
      await Promise.resolve();
      if (jobs.some((j) => j.status === "queued" || j.status === "running")) throw new Error(MSG_ALREADY_RUNNING);
      const job: JobView = { kind: "render", id: `job-${jobs.length + 1}`, status: "queued", step: null, progress: 0, error: null };
      jobs.push(job);
      return job.id;
    },
    async exportsOf() {
      return [];
    },
    async cuts() {
      return [];
    },
    async signUrl() {
      return "";
    },
    async download() {
      return new Uint8Array();
    },
  };
}

describe("createRenderJobWith", () => {
  it("projeto gravado cria o pedido", async () => {
    const db = fakeDb("gravado");
    await expect(createRenderJobWith(db, "p1")).resolves.toEqual({ jobId: "job-1" });
    expect(db.jobs).toHaveLength(1);
  });

  it("projeto ainda no script não gera", async () => {
    await expect(createRenderJobWith(fakeDb("script"), "p1")).rejects.toThrow(MSG_NOT_RECORDED);
  });

  it("projeto inexistente", async () => {
    await expect(createRenderJobWith(fakeDb(null), "p1")).rejects.toThrow(MSG_PROJECT_NOT_FOUND);
  });

  it("com pedido ativo avisa que já está gerando", async () => {
    const db = fakeDb("gravado");
    await createRenderJobWith(db, "p1");
    await expect(createRenderJobWith(db, "p1")).rejects.toThrow(MSG_ALREADY_RUNNING);
  });

  it("depois de falhar, dá para tentar de novo", async () => {
    const db = fakeDb("pronto");
    await createRenderJobWith(db, "p1");
    db.jobs[0].status = "failed";
    await expect(createRenderJobWith(db, "p1")).resolves.toEqual({ jobId: "job-2" });
  });

  it("duas chamadas ao mesmo tempo criam um pedido só", async () => {
    const db = fakeDb("gravado");
    const results = await Promise.allSettled([createRenderJobWith(db, "p1"), createRenderJobWith(db, "p1")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(db.jobs).toHaveLength(1);
  });
});

describe("wakeWorker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sem variáveis do Fly não faz nada", async () => {
    vi.stubEnv("FLY_API_TOKEN", "");
    vi.stubEnv("FLY_APP", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await wakeWorker();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("liga as máquinas paradas e não quebra se o Fly falhar", async () => {
    vi.stubEnv("FLY_API_TOKEN", "tok");
    vi.stubEnv("FLY_APP", "gravai-worker");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "m1", state: "stopped" }, { id: "m2", state: "started" }])))
      .mockResolvedValueOnce(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await wakeWorker();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.machines.dev/v1/apps/gravai-worker/machines/m1/start");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fora do ar")));
    await expect(wakeWorker()).resolves.toBeUndefined();
  });
});
