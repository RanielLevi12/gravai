"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { recutCut } from "@/lib/delivery/actions";
import styles from "./entrega.module.css";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Ajusta onde o corte começa e termina, vendo o vídeo final. */
export function AdjustCut({
  projectId,
  cutId,
  title,
  finalUrl,
  duration,
  start: initialStart,
  end: initialEnd,
}: {
  projectId: string;
  cutId: string;
  title: string;
  finalUrl: string;
  duration: number;
  start: number;
  end: number;
}) {
  const router = useRouter();
  const player = useRef<HTMLVideoElement>(null);
  const [start, setStart] = useState(String(round1(initialStart)));
  const [end, setEnd] = useState(String(round1(initialEnd)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useNow = (set: (v: string) => void) => () => set(String(round1(player.current?.currentTime ?? 0)));

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await recutCut(projectId, cutId, Number(start), Number(end)).catch(() => ({ error: "Não foi possível agora. Tente de novo." }));
    if ("error" in res) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.refresh(); // a tela passa a mostrar o andamento
  }

  return (
    <details className={styles.adjust}>
      <summary>Ajustar início e fim</summary>
      <video ref={player} className={styles.video} src={finalUrl} controls playsInline preload="metadata" aria-label={`Vídeo final, para ajustar ${title}`} />
      <div className={styles.fields}>
        <label className={styles.field}>
          Início (segundos)
          <input type="number" inputMode="decimal" min={0} max={duration} step={0.1} value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <Button variant="soft" onClick={useNow(setStart)}>
          Usar o tempo do vídeo
        </Button>
      </div>
      <div className={styles.fields}>
        <label className={styles.field}>
          Fim (segundos)
          <input type="number" inputMode="decimal" min={0} max={duration} step={0.1} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <Button variant="soft" onClick={useNow(setEnd)}>
          Usar o tempo do vídeo
        </Button>
      </div>
      <div className={styles.row}>
        <Button onClick={submit} disabled={busy}>
          Usar estes tempos
        </Button>
      </div>
      {error ? (
        <p role="alert" className={styles.meta}>
          {error}
        </p>
      ) : null}
    </details>
  );
}
