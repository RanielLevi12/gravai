"use client";

import { Archive } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./entrega.module.css";

/** Baixa tudo num .zip. Se a rota recusar (ex.: arquivos grandes), mostra o motivo. */
export function ZipButton({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/projetos/${projectId}/entrega/zip`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        return setError(body?.error ?? "Não foi possível agora. Tente de novo.");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "gravai-videos.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("Não foi possível agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.row}>
      <Button variant="soft" icon={Archive} onClick={download} disabled={busy}>
        {busy ? "Montando o .zip…" : "Baixar tudo (.zip)"}
      </Button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
