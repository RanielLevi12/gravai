import { describe, expect, it, vi } from "vitest";
import { purgeWith, restoreWith, trashWith } from "@/lib/trash/service";

type Row = Record<string, unknown>;

/** Banco de mentira mínimo: tabelas em memória e só os filtros que o serviço usa. */
function fakeDb(tables: Record<string, Row[]>, log: string[] = []) {
  const from = (t: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let mode: "select" | "update" | "delete" = "select";
    let patch: Row = {};
    const rows = () => (tables[t] ??= []).filter((r) => filters.every((f) => f(r)));
    const run = () => {
      const hit = rows();
      if (mode === "update") hit.forEach((r) => Object.assign(r, patch));
      if (mode === "delete") {
        log.push(`delete ${t}:${hit.map((r) => r.id).join(",")}`);
        tables[t] = tables[t].filter((r) => !hit.includes(r));
      }
      return hit;
    };
    const q: Record<string, unknown> = {
      select: () => q,
      update: (p: Row) => ((mode = "update"), (patch = p), q),
      delete: () => ((mode = "delete"), q),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      not: (k: string, _op: string, v: unknown) => (filters.push((r) => (r[k] ?? null) !== v), q),
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok),
    };
    return q;
  };
  return { from, rpc: vi.fn() } as never;
}

describe("lixeira: mover e restaurar", () => {
  it("vídeo vai para a lixeira uma vez só", async () => {
    const t = { projects: [{ id: "v", deleted_at: null }] };
    const db = fakeDb(t);
    expect(await trashWith(db, "video", "v", new Date("2026-10-17T10:00:00Z"))).toBe(true);
    expect(t.projects[0].deleted_at).toBe("2026-10-17T10:00:00.000Z");
    expect(await trashWith(db, "video", "v")).toBe(false);
  });

  it("projeto usa a função do banco (leva os vídeos junto)", async () => {
    const db = fakeDb({});
    (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mockResolvedValue({ data: true, error: null });
    expect(await trashWith(db, "projeto", "f")).toBe(true);
    expect((db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith("trash_folder", { p_id: "f" });
  });

  it("restaurar vídeo cujo projeto está na lixeira deixa o vídeo solto", async () => {
    const t = {
      folders: [{ id: "f", deleted_at: "2026-10-17" }],
      projects: [{ id: "v", folder_id: "f", deleted_at: "2026-10-16" }],
    };
    expect(await restoreWith(fakeDb(t), "video", "v")).toBe(true);
    expect(t.projects[0]).toMatchObject({ deleted_at: null, folder_id: null });
  });

  it("restaurar vídeo de projeto normal mantém o projeto", async () => {
    const t = { folders: [{ id: "f", deleted_at: null }], projects: [{ id: "v", folder_id: "f", deleted_at: "2026-10-16" }] };
    await restoreWith(fakeDb(t), "video", "v");
    expect(t.projects[0]).toMatchObject({ deleted_at: null, folder_id: "f" });
  });

  it("restaurar o que não está na lixeira não faz nada", async () => {
    const t = { projects: [{ id: "v", folder_id: null, deleted_at: null }] };
    expect(await restoreWith(fakeDb(t), "video", "v")).toBe(false);
  });
});

describe("lixeira: apagar de vez", () => {
  const r2 = () => ({ deleteMany: vi.fn(async () => {}) });

  it("recusa item que não está na lixeira", async () => {
    const t = { projects: [{ id: "v", deleted_at: null }], recordings: [], exports: [] };
    const store = r2();
    expect(await purgeWith(fakeDb(t), "video", "v", store)).toBe(false);
    expect(store.deleteMany).not.toHaveBeenCalled();
    expect(t.projects).toHaveLength(1);
  });

  it("vídeo: apaga arquivos do R2 e a linha", async () => {
    const t = {
      projects: [{ id: "v", deleted_at: "2026-10-01" }],
      recordings: [{ project_id: "v", storage_path: "u/v/r.webm" }],
      exports: [{ project_id: "v", storage_path: "u/v/e.mp4" }],
    };
    const store = r2();
    expect(await purgeWith(fakeDb(t), "video", "v", store)).toBe(true);
    expect(store.deleteMany).toHaveBeenCalledWith(["recordings/u/v/r.webm", "exports/u/v/e.mp4"]);
    expect(t.projects).toHaveLength(0);
  });

  it("projeto: apaga os vídeos da lixeira e depois a pasta; vídeo normal fica solto", async () => {
    const log: string[] = [];
    const t = {
      folders: [{ id: "f", deleted_at: "2026-10-01" }],
      projects: [
        { id: "a", folder_id: "f", deleted_at: "2026-10-01" },
        { id: "b", folder_id: "f", deleted_at: null },
      ],
      recordings: [],
      exports: [],
    };
    expect(await purgeWith(fakeDb(t, log), "projeto", "f", r2())).toBe(true);
    expect(log).toEqual(["delete projects:a", "delete folders:f"]);
    expect(t.projects.map((p) => p.id)).toEqual(["b"]);
  });

  it("falha no R2 de um vídeo mantém a pasta", async () => {
    const t = {
      folders: [{ id: "f", deleted_at: "2026-10-01" }],
      projects: [{ id: "a", folder_id: "f", deleted_at: "2026-10-01" }],
      recordings: [],
      exports: [],
    };
    await expect(purgeWith(fakeDb(t), "projeto", "f", { deleteMany: async () => Promise.reject(new Error("r2")) })).rejects.toThrow("r2");
    expect(t.folders).toHaveLength(1);
    expect(t.projects).toHaveLength(1);
  });
});
