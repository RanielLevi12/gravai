"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { apagarDeVez, restaurar } from "@/lib/trash/actions";
import { daysLeftText } from "@/lib/trash/rules";
import type { TrashItem } from "@/lib/trash/queries";
import styles from "./trash.module.css";

/** Itens da lixeira com "Restaurar" e "Apagar agora" (este pede uma confirmação forte). */
export function TrashList({ items }: { items: TrashItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<TrashItem | null>(null);

  async function run(fn: () => ReturnType<typeof restaurar>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else {
        setTarget(null);
        router.refresh();
      }
    } catch {
      setError("Não foi possível agora. Tente de novo.");
    }
    setBusy(false);
  }

  if (items.length === 0) return <p className={styles.empty}>A lixeira está vazia.</p>;

  return (
    <>
      {error && !target ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <ul className={styles.list}>
        {items.map((it) => (
          <li key={`${it.kind}-${it.id}`} className={styles.item}>
            <span className={styles.itemTitle}>{it.title}</span>
            <span className={styles.itemMeta}>
              {it.kind === "projeto" ? `Projeto · ${it.videos === 1 ? "1 vídeo" : `${it.videos} vídeos`} · ` : "Vídeo · "}
              {daysLeftText(it.deletedAt)}
            </span>
            <div className={styles.itemActions}>
              <Button variant="soft" disabled={busy} onClick={() => void run(() => restaurar(it.kind, it.id))}>
                Restaurar
              </Button>
              <Button variant="soft" disabled={busy} onClick={() => setTarget(it)}>
                Apagar agora
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Sheet open={target !== null} onClose={() => setTarget(null)} title="Apagar de vez?" busy={busy}>
        <p className={styles.text}>
          “{target?.title}” {target?.kind === "projeto" ? "e os vídeos dele " : ""}vão ser apagados para sempre, com todos os arquivos. Não dá para desfazer.
        </p>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button disabled={busy} onClick={() => target && void run(() => apagarDeVez(target.kind, target.id))}>
            {busy ? "Apagando…" : "Apagar para sempre"}
          </Button>
          <Button variant="soft" onClick={() => setTarget(null)} disabled={busy}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
