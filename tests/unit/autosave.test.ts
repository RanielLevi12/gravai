import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaver, type SaveStatus } from "@/components/script/autosave";

function setup(save: (id: string, text: string) => Promise<boolean>) {
  const statuses: SaveStatus[] = [];
  const saver = createAutosaver(save, (s) => statuses.push(s));
  return { saver, last: () => statuses.at(-1) };
}

describe("createAutosaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("agrupa digitação num único salvamento depois de 800 ms", async () => {
    const save = vi.fn(async () => true);
    const { saver, last } = setup(save);
    saver.schedule("a", "1");
    await vi.advanceTimersByTimeAsync(700);
    saver.schedule("a", "12");
    await vi.advanceTimersByTimeAsync(700);
    expect(save).not.toHaveBeenCalled();
    expect(last()).toBe("saving");
    await vi.advanceTimersByTimeAsync(200);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("a", "12");
    expect(last()).toBe("saved");
  });

  it("flush grava na hora e diz se deu certo; falha deixa o estado em erro", async () => {
    const save = vi.fn(async () => false);
    const { saver, last } = setup(save);
    saver.schedule("a", "texto");
    await expect(saver.flush("a")).resolves.toBe(false);
    expect(last()).toBe("error");
    expect(saver.pendingIds()).toEqual(["a"]); // continua pendente para tentar de novo
    save.mockResolvedValue(true);
    await expect(saver.flush("a")).resolves.toBe(true);
    expect(last()).toBe("saved");
  });

  it("flushAll devolve false se qualquer item falhar, inclusive falha anterior", async () => {
    const save = vi.fn(async (id: string) => id !== "b");
    const { saver } = setup(save);
    saver.schedule("a", "x");
    saver.schedule("b", "y");
    await expect(saver.flushAll()).resolves.toBe(false);
    // b segue pendente/falho: um novo flushAll tenta de novo
    await expect(saver.flushAll()).resolves.toBe(false);
    expect(save.mock.calls.filter(([id]) => id === "b")).toHaveLength(2);
  });

  it("nunca salva o mesmo item em paralelo e manda o texto mais novo depois", async () => {
    let release!: () => void;
    const calls: string[] = [];
    const save = vi.fn(async (_id: string, text: string) => {
      calls.push(text);
      if (calls.length === 1) await new Promise<void>((r) => (release = r));
      return true;
    });
    const { saver } = setup(save);
    saver.schedule("a", "v1");
    await vi.advanceTimersByTimeAsync(800);
    saver.schedule("a", "v2");
    await vi.advanceTimersByTimeAsync(800);
    expect(calls).toEqual(["v1"]);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["v1", "v2"]);
  });

  it("reset só descarta pendências e falhas quando pedido", async () => {
    const save = vi.fn(async () => false);
    const { saver, last } = setup(save);
    saver.schedule("a", "x");
    await saver.flush("a");
    expect(last()).toBe("error");
    await saver.reset();
    expect(last()).toBe("saved");
    expect(saver.pendingIds()).toEqual([]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledOnce();
  });
});
