"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { approveRecording } from "@/lib/record/actions";
import type { RecordMode } from "@/lib/record/rules";
import styles from "./record.module.css";

export function BlockList({
  projectId,
  blocks,
  recorded,
}: {
  projectId: string;
  blocks: { id: string; label: string }[];
  recorded: Record<string, boolean>;
}) {
  return (
    <ol className={styles.blocks}>
      {blocks.map((b) => (
        <li key={b.id} className={styles.blockRow}>
          <span>
            {b.label}
            <small className={styles.hint}>{recorded[b.id] ? " · gravado" : " · falta gravar"}</small>
          </span>
          <Button variant="soft" href={`/projetos/${projectId}/gravar/teleprompter?modo=blocos&bloco=${b.id}`}>
            {recorded[b.id] ? "Refazer" : "Gravar"}
          </Button>
        </li>
      ))}
    </ol>
  );
}

/** Botão coral "Aprovar e guardar"; `blocked` é o motivo (já em português) quando ainda não dá. */
export function ApproveButton({ projectId, mode, blocked }: { projectId: string; mode: RecordMode; blocked: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    const res = await approveRecording(projectId, mode).catch(() => ({ error: "Não consegui guardar agora. Tente de novo." }));
    if ("error" in res) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.actions}>
      {blocked ? <p className={styles.hint}>{blocked}</p> : null}
      {error ? (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      ) : null}
      <Button onClick={approve} disabled={busy || blocked !== null}>
        Aprovar e guardar
      </Button>
    </div>
  );
}
