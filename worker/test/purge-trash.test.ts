import { describe, expect, it, vi } from "vitest";
import { purgeTrash } from "../src/purge";

type Row = Record<string, unknown>;

/** Banco de mentira: tabelas em memória com os filtros que purgeTrash usa. */
function fakeDb(tables: Record<string, Row[]>) {
  const from = (t: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let del = false;
    let head = false;
    const q: Record<string, unknown> = {
      select: (_c?: string, o?: { head?: boolean }) => ((head = Boolean(o?.head)), q),
      delete: () => ((del = true), q),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      not: (k: string, _op: string, v: unknown) => (filters.push((r) => (r[k] ?? null) !== v), q),
      lt: (k: string, v: string) => (filters.push((r) => typeof r[k] === "string" && (r[k] as string) < v), q),
      limit: () => q,
      then: (ok: (v: unknown) => unknown) => {
        const hit = (tables[t] ?? []).filter((r) => filters.every((f) => f(r)));
        if (del) tables[t] = tables[t].filter((r) => !hit.includes(r));
        return Promise.resolve({ data: head ? null : hit, count: hit.length, error: null }).then(ok);
      },
    };
    return q;
  };
  return { from } as never;
}

const now = new Date("2026-10-17T12:00:00Z");

describe("purgeTrash", () => {
  it("apaga só o que passou de 7 dias, com os arquivos", async () => {
    const t = {
      projects: [
        { id: "velho", folder_id: null, deleted_at: "2026-10-09T12:00:00.000Z" },
        { id: "novo", folder_id: null, deleted_at: "2026-10-12T12:00:00.000Z" },
        { id: "normal", folder_id: null, deleted_at: null },
      ],
      recordings: [{ project_id: "velho", storage_path: "u/velho/r.webm" }],
      exports: [{ project_id: "velho", storage_path: "u/velho/e.mp4" }],
      folders: [],
    };
    const del = vi.fn(async () => {});
    expect(await purgeTrash(fakeDb(t), now, del)).toEqual({ videos: 1, folders: 0 });
    expect(del).toHaveBeenCalledWith(["recordings/u/velho/r.webm", "exports/u/velho/e.mp4"]);
    expect(t.projects.map((p) => p.id)).toEqual(["novo", "normal"]);
  });

  it("projeto vencido: apaga os vídeos e depois a pasta", async () => {
    const t = {
      folders: [{ id: "f", deleted_at: "2026-10-01T00:00:00.000Z" }],
      projects: [{ id: "a", folder_id: "f", deleted_at: "2026-10-01T00:00:00.000Z" }],
      recordings: [],
      exports: [],
    };
    expect(await purgeTrash(fakeDb(t), now, async () => {})).toEqual({ videos: 1, folders: 1 });
    expect(t.folders).toHaveLength(0);
  });

  it("falha no R2 mantém vídeo e pasta para a próxima hora", async () => {
    const t = {
      folders: [{ id: "f", deleted_at: "2026-10-01T00:00:00.000Z" }],
      projects: [{ id: "a", folder_id: "f", deleted_at: "2026-10-01T00:00:00.000Z" }],
      recordings: [],
      exports: [],
    };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await purgeTrash(fakeDb(t), now, async () => Promise.reject(new Error("r2")))).toEqual({ videos: 0, folders: 0 });
    expect(t.folders).toHaveLength(1);
    expect(t.projects).toHaveLength(1);
    err.mockRestore();
  });
});
