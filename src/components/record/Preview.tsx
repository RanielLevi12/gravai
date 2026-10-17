"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { discardRecording, finishRecording } from "@/lib/record/actions";
import { fitsBucket, MSG_FILE_TOO_BIG } from "@/lib/record/limits";
import { clearRecording, readRecording } from "@/lib/record/store";
import { MSG_UPLOAD_FAILED, uploadRecording } from "@/lib/record/upload";
import styles from "./record.module.css";
import { UploadStatus } from "./UploadStatus";

type Props = {
  projectId: string;
  recordingId: string;
  path: string;
  mime: string;
  /** Gravação de bloco: refazer volta para o mesmo bloco. */
  blockId: string | null;
  durationSeconds: number | null;
};

/** Prévia da gravação que está no aparelho: refazer ou usar (envia e guarda). */
export function Preview({ projectId, recordingId, path, mime, blockId, durationSeconds }: Props) {
  const router = useRouter();
  const busy = useRef(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    void readRecording(recordingId, mime).then((b) => {
      if (!alive) return;
      if (!b || b.size === 0) return setMissing(true);
      objectUrl = URL.createObjectURL(b);
      setBlob(b);
      setUrl(objectUrl);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recordingId, mime]);

  const base = `/projetos/${projectId}/gravar`;
  const again = blockId ? `${base}/teleprompter?modo=blocos&bloco=${blockId}` : `${base}/teleprompter?modo=take`;

  async function redo() {
    if (busy.current) return;
    busy.current = true;
    await discardRecording(recordingId).catch(() => {});
    await clearRecording(recordingId).catch(() => {});
    router.push(again);
  }

  async function use() {
    if (busy.current || !blob) return;
    if (!fitsBucket(blob.size)) return void setError(MSG_FILE_TOO_BIG);
    busy.current = true;
    setError(null);
    setProgress({ sent: 0, total: blob.size });
    try {
      const sent = await uploadRecording({ blob, recordingId, onProgress: (sent, total) => setProgress({ sent, total }) });
      const done = await finishRecording(recordingId, { sizeBytes: sent.sizeBytes, durationSeconds });
      if ("error" in done) throw new Error(done.error);
      await clearRecording(recordingId).catch(() => {});
      router.push(`${base}/aprovar`);
    } catch (e) {
      // O vídeo continua no aparelho: dá para tentar de novo sem gravar outra vez.
      setError(e instanceof Error && e.message ? e.message : MSG_UPLOAD_FAILED);
      setProgress(null);
      busy.current = false;
    }
  }

  if (missing) {
    return (
      <div className={styles.actions}>
        <p className={styles.alert} role="alert">
          Não achei essa gravação neste aparelho. Grave de novo.
        </p>
        <Button href={again}>Gravar de novo</Button>
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      {url ? <video className={styles.preview} src={url} controls playsInline /> : <p className={styles.hint}>Abrindo a gravação…</p>}
      {progress && !error ? <UploadStatus sent={progress.sent} total={progress.total} /> : null}
      {error ? <UploadStatus sent={0} total={0} error={error} /> : null}
      <div className={styles.actions}>
        <Button onClick={use} disabled={!blob || (progress !== null && !error)}>
          Usar este
        </Button>
        <Button variant="soft" onClick={redo} disabled={progress !== null && !error}>
          Refazer
        </Button>
      </div>
    </div>
  );
}
