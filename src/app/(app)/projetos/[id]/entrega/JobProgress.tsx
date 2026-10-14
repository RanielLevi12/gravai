"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "@/components/record/record.module.css";
import { Button } from "@/components/ui/Button";
import { createRenderJob, getJobStatus } from "@/lib/delivery/actions";
import { STEP_LABELS, type JobStep } from "@/lib/delivery/rules";
import type { JobView } from "@/lib/delivery/service";

const POLL_MS = 3000;
const active = (j: JobView | null) => j !== null && (j.status === "queued" || j.status === "running");

function label(job: JobView): string {
  if (job.status === "queued") return "Na fila";
  return STEP_LABELS[job.step as JobStep] ?? "Preparando";
}

/** Botão de gerar, andamento do pedido (consulta a cada 3 s) e resultado. */
export function JobPanel({ projectId, initial }: { projectId: string; initial: JobView | null }) {
  const router = useRouter();
  const [job, setJob] = useState<JobView | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = active(job);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const res = await getJobStatus(projectId).catch(() => null);
      if (!res || "error" in res) return;
      setJob(res.job);
      if (!active(res.job)) router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, projectId, router]);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await createRenderJob(projectId).catch(() => ({ error: "Não foi possível agora. Tente de novo." }));
    if ("error" in res) {
      setError(res.error);
      setBusy(false);
      return;
    }
    setJob({ id: res.jobId, status: "queued", step: null, progress: 0, error: null });
    setBusy(false);
  }

  if (job && running) {
    return (
      <div className={styles.actions} aria-live="polite">
        <p className={styles.hint}>
          {label(job)}… pode sair desta tela, o app continua gerando.
        </p>
        <div className={styles.bar} role="progressbar" aria-label="Andamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress}>
          <div style={{ width: `${job.progress}%` }} />
        </div>
      </div>
    );
  }

  const failed = job?.status === "failed";
  return (
    <div className={styles.actions}>
      {failed ? (
        <p className={styles.alert} role="alert">
          {job?.error ?? "Não foi possível gerar os vídeos."}
        </p>
      ) : null}
      {error ? (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      ) : null}
      <Button onClick={generate} disabled={busy}>
        {failed ? "Tentar de novo" : "Gerar vídeos"}
      </Button>
    </div>
  );
}
