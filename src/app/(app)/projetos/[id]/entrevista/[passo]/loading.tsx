import styles from "./entrevista.module.css";

/** Enquanto a IA prepara as sugestões (só na primeira pergunta e nos títulos). */
export default function Loading() {
  return (
    <main className={styles.page}>
      <div className={styles.loading} role="status">
        <span className={styles.spinner} aria-hidden />
        Preparando as sugestões…
      </div>
    </main>
  );
}
