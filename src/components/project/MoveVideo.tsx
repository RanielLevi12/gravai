"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { moveVideo } from "@/lib/folders/actions";
import styles from "./ProjectRow.module.css";

export type FolderChoice = { id: string; name: string };

/** "Mover": escolhe outro projeto (ou nenhum). Só troca a pasta; as configurações do vídeo não mudam. */
export function MoveVideo({ videoId, currentFolderId, folders }: { videoId: string; currentFolderId: string | null; folders: FolderChoice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(folderId: string | null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await moveVideo(videoId, folderId);
      if (!r.ok) {
        setError(r.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Não foi possível mover agora. Tente de novo.");
    }
    setBusy(false);
  }

  const options: FolderChoice[] = [{ id: "", name: "Sem projeto (solto)" }, ...folders];

  return (
    <>
      <button type="button" className={styles.moveBtn} onClick={() => setOpen(true)}>
        Mover
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Mover para qual projeto?" busy={busy}>
        <p className={styles.moveHint}>As escolhas do vídeo continuam as mesmas.</p>
        <div className={styles.moveList}>
          {options.map((o) => {
            const here = (currentFolderId ?? "") === o.id;
            return (
              <Button key={o.id || "solto"} variant="soft" disabled={busy || here} onClick={() => void move(o.id || null)}>
                {o.name}
                {here ? " (atual)" : ""}
              </Button>
            );
          })}
        </div>
        {error ? (
          <p role="alert" className={styles.moveError}>
            {error}
          </p>
        ) : null}
      </Sheet>
    </>
  );
}
