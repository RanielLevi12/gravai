"use client";

import { useEffect, useRef, useState } from "react";

export type SaveStatus = "saved" | "saving" | "error";

export const AUTOSAVE_DELAY_MS = 800;

/**
 * Autosave por item com debounce: cada `schedule` reinicia o relógio do item; o salvamento de um item
 * nunca roda em paralelo consigo mesmo (o texto mais novo vai depois do anterior). `save` precisa ser estável.
 */
export function useAutosave(save: (id: string, text: string) => Promise<boolean>) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const saveRef = useRef(save);
  const api = useRef<{
    schedule(id: string, text: string): void;
    flush(id: string): Promise<void>;
    settle(): Promise<void>;
    pendingIds(): string[];
  } | null>(null);

  if (api.current === null) {
    const pending = new Map<string, string>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const inflight = new Map<string, Promise<void>>();
    const failed = new Set<string>();

    const refresh = () => setStatus(timers.size > 0 || inflight.size > 0 ? "saving" : failed.size > 0 ? "error" : "saved");

    const run = (id: string): Promise<void> => {
      const current = inflight.get(id);
      if (current) return current.then(() => run(id));
      const text = pending.get(id);
      if (text === undefined) return Promise.resolve();
      pending.delete(id);
      const task = (async () => {
        let ok = false;
        try {
          ok = await saveRef.current(id, text);
        } catch {
          // fica como falha abaixo
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

    api.current = {
      schedule(id, text) {
        pending.set(id, text);
        clearTimeout(timers.get(id));
        timers.set(
          id,
          setTimeout(() => {
            timers.delete(id);
            void run(id);
          }, AUTOSAVE_DELAY_MS),
        );
        refresh();
      },
      async flush(id) {
        clearTimeout(timers.get(id));
        timers.delete(id);
        await run(id);
        refresh();
      },
      /** Descarta o que ainda não saiu e espera o que já está em voo (usado antes de trocar o script todo). */
      async settle() {
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
  const a = api.current;

  useEffect(() => {
    const flushAll = () => {
      for (const id of a.pendingIds()) void a.flush(id);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flushAll(); // saiu da tela com texto pendente
    };
  }, [a]);

  return { status, schedule: a.schedule, flush: a.flush, settle: a.settle };
}
