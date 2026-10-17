"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { discardRecording, finishRecording, startRecording } from "@/lib/record/actions";
import { validateExternalFile } from "@/lib/record/rules";
import { MSG_UPLOAD_FAILED, UploadRejected, uploadRecording } from "@/lib/record/upload";
import styles from "./record.module.css";

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

export function ExternalUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(file: File) {
    if (busy.current) return;
    const check = validateExternalFile(file);
    if (!check.ok) return void setError(check.error);
    busy.current = true;
    setError(null);
    setProgress("Preparando…");
    let recordingId: string | null = null;
    let navigated = false;
    try {
      const mime = file.type;
      const started = await startRecording({ projectId, kind: "external", blockId: null, mime });
      if ("error" in started) return void setError(started.error);
      recordingId = started.id;
      const duration = await readDuration(file);
      const sent = await uploadRecording({
        blob: file,
        recordingId: started.id,
        onProgress: (sent, total) => setProgress(`Enviando… ${Math.round((sent / total) * 100)}%`),
      });
      const done = await finishRecording(started.id, { sizeBytes: sent.sizeBytes, durationSeconds: duration });
      if ("error" in done) return void setError(done.error);
      recordingId = null;
      navigated = true;
      setProgress("Abrindo…");
      router.push(`/projetos/${projectId}/gravar/aprovar`);
    } catch (e) {
      setError(e instanceof UploadRejected || (e instanceof Error && e.message === MSG_UPLOAD_FAILED) ? e.message : MSG_UPLOAD_FAILED);
    } finally {
      if (recordingId) await discardRecording(recordingId).catch(() => {});
      if (!navigated) {
        busy.current = false;
        setProgress(null);
      }
    }
  }

  return (
    <div className={styles.actions}>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        hidden
        aria-label="Escolher vídeo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void send(f);
        }}
      />
      <Button icon={Upload} onClick={() => input.current?.click()} disabled={progress !== null}>
        Escolher vídeo
      </Button>
      {progress ? (
        <p className={styles.hint} role="status">
          {progress}
        </p>
      ) : null}
      {error ? (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
