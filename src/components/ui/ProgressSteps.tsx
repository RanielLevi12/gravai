import styles from "./ProgressSteps.module.css";

/** Barra de segmentos da entrevista + contagem "4/8" (design/telas.html, tela 2). */
export function ProgressSteps({ current, total, label = "Progresso da entrevista" }: { current: number; total: number; label?: string }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.bar} role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={total} aria-valuenow={current}>
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < current ? styles.done : undefined} />
        ))}
      </div>
      <span className={styles.count}>{`${current}/${total}`}</span>
    </div>
  );
}
