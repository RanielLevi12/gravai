import { describe, expect, it } from "vitest";
import { MAX_VERSIONS, pushLocal, restoreVersionWith, saveVersionWith, type VersionDb } from "@/lib/script/versions";

class MemoryVersions implements VersionDb {
  rows: Record<string, string[]> = {}; // mais novo primeiro
  async list(id: string) {
    return [...(this.rows[id] ?? [])];
  }
  async push(id: string, text: string) {
    this.rows[id] = [text, ...(this.rows[id] ?? [])];
    return true;
  }
  async popLatest(id: string) {
    return this.rows[id]?.shift() ?? null;
  }
  async trim(id: string, keep: number) {
    this.rows[id] = (this.rows[id] ?? []).slice(0, keep);
  }
  async clearProject() {
    this.rows = {};
  }
}

describe("histórico de versões do trecho", () => {
  it("guarda o texto de antes e devolve o mais novo primeiro", async () => {
    const db = new MemoryVersions();
    await saveVersionWith(db, "b1", "primeiro");
    await saveVersionWith(db, "b1", "segundo");
    expect(await restoreVersionWith(db, "b1")).toBe("segundo");
    expect(await restoreVersionWith(db, "b1")).toBe("primeiro");
    expect(await restoreVersionWith(db, "b1")).toBeNull();
  });

  it("não guarda texto vazio nem repetido, e cada trecho tem o seu histórico", async () => {
    const db = new MemoryVersions();
    expect(await saveVersionWith(db, "b1", "   ")).toBe(false);
    expect(await saveVersionWith(db, "b1", 42)).toBe(false);
    await saveVersionWith(db, "b1", "a");
    await saveVersionWith(db, "b1", "a");
    await saveVersionWith(db, "b2", "outro");
    expect(db.rows.b1).toEqual(["a"]);
    expect(db.rows.b2).toEqual(["outro"]);
  });

  it("mantém só as últimas versões", async () => {
    const db = new MemoryVersions();
    for (let i = 0; i < MAX_VERSIONS + 5; i++) await saveVersionWith(db, "b1", `v${i}`);
    expect(db.rows.b1).toHaveLength(MAX_VERSIONS);
    expect(db.rows.b1[0]).toBe(`v${MAX_VERSIONS + 4}`);
  });

  it("pushLocal empilha na tela com o mesmo limite", () => {
    expect(pushLocal([], "a")).toEqual(["a"]);
    expect(pushLocal(["a"], "a")).toEqual(["a"]);
    expect(pushLocal(["a"], " ")).toEqual(["a"]);
    expect(pushLocal(Array.from({ length: MAX_VERSIONS }, (_, i) => `x${i}`), "novo")).toHaveLength(MAX_VERSIONS);
  });
});
