"use client";

import { MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { moverParaLixeira } from "@/lib/trash/actions";
import type { TrashKind } from "@/lib/trash/rules";
import { useTrashToast } from "./TrashToast";
import styles from "./trash.module.css";

/**
 * Botão ⋮ com "Mover para a lixeira". Pede uma confirmação curta; depois mostra o aviso com "Desfazer".
 * `then`: para onde ir depois de mover (padrão: só atualizar a tela).
 */
export function TrashMenu({ kind, id, title, then }: { kind: TrashKind; id: string; title: string; then?: string }) {
  const router = useRouter();
  const showToast = useTrashToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFolder = kind === "projeto";

  function close() {
    setOpen(false);
    setConfirm(false);
    setError(null);
  }

  async function move() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await moverParaLixeira(kind, id);
      if (!r.ok) {
        setError(r.error);
        setBusy(false);
        return;
      }
      showToast(kind, id, title);
      close();
      if (then) router.push(then);
      router.refresh();
    } catch {
      setError("Não foi possível agora. Tente de novo.");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className={styles.dots} aria-label={`Mais ações: ${title}`} onClick={() => setOpen(true)}>
        <MoreVertical size={20} strokeWidth={2} aria-hidden />
      </button>
      <Sheet open={open} onClose={close} title={confirm ? (isFolder ? "Mover o projeto para a lixeira?" : "Mover o vídeo para a lixeira?") : title} busy={busy}>
        {confirm ? (
          <>
            <p className={styles.text}>
              {isFolder ? "Os vídeos dele vão junto. " : ""}Fica 7 dias na lixeira e dá para restaurar. Depois disso é apagado de vez.
            </p>
            {error ? (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            ) : null}
            <div className={styles.actions}>
              <Button onClick={move} disabled={busy}>
                {busy ? "Movendo…" : "Mover para a lixeira"}
              </Button>
              <Button variant="soft" onClick={close} disabled={busy}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <div className={styles.actions}>
            <Button variant="soft" onClick={() => setConfirm(true)}>
              Mover para a lixeira
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
