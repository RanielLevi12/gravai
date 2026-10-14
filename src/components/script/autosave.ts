export type SaveStatus = "saved" | "saving" | "error";

export const AUTOSAVE_DELAY_MS = 800;

export type Autosaver = {
  schedule(id: string, text: string): void;
  /** Grava o que está pendente do item e espera; false se não foi possível gravar. */
  flush(id: string): Promise<boolean>;
  /** Grava tudo que está pendente; false se algum item falhou. */
  flushAll(): Promise<boolean>;
  /** Descarta pendências e falhas (depois que o script todo foi trocado) e espera o que está em voo. */
  reset(): Promise<void>;
  pendingIds(): string[];
};

/**
 * Autosave por item com debounce: cada `schedule` reinicia o relógio do item; o salvamento de um item
 * nunca roda em paralelo consigo mesmo (o texto mais novo vai depois do anterior).
 */
export function createAutosaver(
  save: (id: string, text: string) => Promise<boolean>,
  onStatus: (status: SaveStatus) => void,
  delay = AUTOSAVE_DELAY_MS,
): Autosaver {
  const pending = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const inflight = new Map<string, Promise<void>>();
  const failed = new Set<string>();

  const refresh = () => onStatus(timers.size > 0 || inflight.size > 0 ? "saving" : failed.size > 0 ? "error" : "saved");

  const run = (id: string): Promise<void> => {
    const current = inflight.get(id);
    if (current) return current.then(() => run(id));
    const text = pending.get(id);
    if (text === undefined) return Promise.resolve();
    pending.delete(id);
    const task = (async () => {
      let ok = false;
      try {
        ok = await save(id, text);
      } catch {
        // conta como falha abaixo
      }
      if (ok) failed.delete(id);
      else {
        failed.add(id);
        if (!pending.has(id)) pending.set(id, text); // a próxima edição ou o fechamento da tela tenta de novo
      }
    })()
      .finally(() => {
        inflight.delete(id);
        refresh();
      })
      .then(() => (pending.has(id) && !failed.has(id) ? run(id) : undefined));
    inflight.set(id, task);
    refresh();
    return task;
  };

  const flush = async (id: string) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    await run(id);
    refresh();
    return !failed.has(id);
  };

  return {
    schedule(id, text) {
      pending.set(id, text);
      clearTimeout(timers.get(id));
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          void run(id);
        }, delay),
      );
      refresh();
    },
    flush,
    async flushAll() {
      const results = await Promise.all([...new Set([...pending.keys(), ...failed])].map(flush));
      return results.every(Boolean);
    },
    async reset() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      pending.clear();
      await Promise.all([...inflight.values()]);
      failed.clear();
      refresh();
    },
    pendingIds: () => [...pending.keys()],
  };
}
