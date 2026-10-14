"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { resetToProjectDefault } from "@/lib/interview/actions";
import type { InheritedStep } from "@/lib/folders/inherit";
import styles from "./entrevista.module.css";

/** "Voltar ao padrão do projeto" para uma resposta personalizada. */
export function ResetButton({ projectId, step }: { projectId: string; step: InheritedStep }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await resetToProjectDefault(projectId, step);
      if ("error" in r) setError(r.error);
      else router.refresh();
    } catch {
      setError("Não foi possível voltar ao padrão agora. Tente de novo.");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className={styles.resetBtn} onClick={() => void reset()} disabled={busy} aria-busy={busy}>
        Voltar ao padrão do projeto
      </button>
      {error ? (
        <span role="alert" className={styles.resetError}>
          {error}
        </span>
      ) : null}
    </>
  );
}
