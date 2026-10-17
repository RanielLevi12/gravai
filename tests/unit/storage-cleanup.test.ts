import { describe, expect, it, vi } from "vitest";
import { deleteProjectWith } from "@/lib/storage/cleanup";
import { formatBytes, quotaText } from "@/lib/storage/format";

function fakeSupabase(o: { project?: boolean; deleteError?: boolean } = {}) {
  const order: string[] = [];
  const supabase = {
    from: (t: string) => ({
      select: () => ({
        eq: () => {
          const rows = t === "recordings" ? [{ storage_path: "u/p/r.webm" }] : t === "exports" ? [{ storage_path: "u/p/e.mp4" }] : [];
          return Object.assign(Promise.resolve({ data: rows, error: null }), {
            maybeSingle: async () => ({ data: o.project === false ? null : { id: "p" }, error: null }),
          });
        },
      }),
      delete: () => ({
        eq: async () => (order.push("rows"), { error: o.deleteError ? { message: "x" } : null }),
      }),
    }),
  };
  return { supabase: supabase as never, order };
}

describe("deleteProjectWith", () => {
  it("apaga os arquivos no R2 antes das linhas", async () => {
    const { supabase, order } = fakeSupabase();
    const r2 = { deleteMany: vi.fn(async () => void order.push("r2")) };
    expect(await deleteProjectWith(supabase, "p", r2)).toBe(true);
    expect(r2.deleteMany).toHaveBeenCalledWith(["recordings/u/p/r.webm", "exports/u/p/e.mp4"]);
    expect(order).toEqual(["r2", "rows"]);
  });

  it("projeto que não é do usuário: não apaga nada", async () => {
    const { supabase } = fakeSupabase({ project: false });
    const r2 = { deleteMany: vi.fn() };
    expect(await deleteProjectWith(supabase, "p", r2)).toBe(false);
    expect(r2.deleteMany).not.toHaveBeenCalled();
  });

  it("falha no R2 mantém as linhas", async () => {
    const { supabase, order } = fakeSupabase();
    await expect(deleteProjectWith(supabase, "p", { deleteMany: async () => Promise.reject(new Error("r2")) })).rejects.toThrow("r2");
    expect(order).toEqual([]);
  });
});

describe("formatBytes / quotaText", () => {
  it("mostra MB para pouco e GB com uma casa", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(50 * 1024 ** 2)).toBe("50 MB");
    expect(quotaText(1.25 * 1024 ** 3, 5 * 1024 ** 3)).toMatch(/^1,[23] de 5 GB$/);
    expect(quotaText(50 * 1024 ** 2, 5 * 1024 ** 3)).toBe("50 MB de 5 GB");
  });
});
