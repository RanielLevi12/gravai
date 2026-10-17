"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Toast } from "@/components/ui/Toast";
import { restaurar } from "@/lib/trash/actions";
import type { TrashKind } from "@/lib/trash/rules";

type Show = (kind: TrashKind, id: string, title: string) => void;

const Ctx = createContext<Show>(() => {});

/** Guarda o aviso "Movido para a lixeira · Desfazer" fora da tela do item, que some depois de movido. */
export function TrashToastProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; kind: TrashKind; id: string } | null>(null);
  const close = useCallback(() => setMsg(null), []);
  const show = useCallback<Show>((kind, id, title) => setMsg({ text: `“${title}” foi para a lixeira.`, kind, id }), []);
  const action = useMemo(
    () =>
      msg
        ? {
            label: "Desfazer",
            onClick: () => {
              void restaurar(msg.kind, msg.id).then((r) => {
                if (r.ok) router.refresh();
              });
            },
          }
        : undefined,
    [msg, router],
  );
  return (
    <Ctx.Provider value={show}>
      {children}
      <Toast message={msg?.text ?? null} onClose={close} action={action} />
    </Ctx.Provider>
  );
}

export const useTrashToast = () => useContext(Ctx);
