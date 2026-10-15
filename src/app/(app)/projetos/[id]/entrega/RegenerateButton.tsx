"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "@/components/record/record.module.css";
import { Button } from "@/components/ui/Button";
import { createRenderJob } from "@/lib/delivery/actions";

/** Aviso de que os vídeos ficaram para trás + "Gerar de novo", com confirmação (perde ajustes manuais). */
export function RegenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setError(null);
    const res = await createRenderJob(projectId).catch(() => ({ error: "Não foi possível agora. Tente de novo." }));
    if ("error" in res) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.refresh(); // a tela passa a mostrar o andamento
  }

  return (
    <div className={styles.actions}>
      <p className={styles.alert} role="status">
        Suas gravações mudaram. Os vídeos abaixo são da versão antiga.
      </p>
      {confirming ? (
        <>
          <p className={styles.hint}>
            Vamos refazer tudo. Os ajustes de início e fim que você fez nos cortes serão perdidos. Os arquivos atuais só saem quando os novos ficarem prontos.
          </p>
          <div className={styles.actions}>
            <Button onClick={regenerate} disabled={busy}>
              Sim, gerar de novo
            </Button>
            <Button variant="soft" onClick={() => setConfirming(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <Button icon={RefreshCw} onClick={() => setConfirming(true)}>
          Gerar de novo
        </Button>
      )}
      {error ? (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
