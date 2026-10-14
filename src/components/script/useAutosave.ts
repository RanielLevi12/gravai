"use client";

import { useEffect, useRef, useState } from "react";
import { createAutosaver, type Autosaver, type SaveStatus } from "./autosave";

export type { SaveStatus };

/** Liga o autosave ao React; `save` precisa ser estável. Ao sair da tela ou ocultá-la, grava o que sobrou. */
export function useAutosave(save: (id: string, text: string) => Promise<boolean>): Autosaver & { status: SaveStatus } {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const ref = useRef<Autosaver | null>(null);
  if (ref.current === null) ref.current = createAutosaver(save, setStatus);
  const saver = ref.current;

  useEffect(() => {
    const flushPending = () => {
      for (const id of saver.pendingIds()) void saver.flush(id);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushPending();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flushPending();
    };
  }, [saver]);

  return { status, ...saver };
}
