import styles from "./record.module.css";

export function UploadStatus({ sent, total, error }: { sent: number; total: number; error?: string | null }) {
  const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
  if (error) {
    return (
      <p className={styles.alert} role="alert">
        {error}
      </p>
    );
  }
  return (
    <div role="status" aria-live="polite">
      <div className={styles.bar} aria-hidden>
        <div style={{ width: `${pct}%` }} />
      </div>
      <p className={styles.hint}>Enviando… {pct}%</p>
    </div>
  );
}
