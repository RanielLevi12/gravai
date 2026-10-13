import styles from "@/components/script/script.module.css";

/** Aparece enquanto o script é gerado pela primeira vez (ou a página carrega). */
export default function Loading() {
  return (
    <main className={styles.notice} aria-busy="true">
      <h1>Escrevendo seu script…</h1>
      <p role="status">Isso leva alguns segundos. Pode ficar nesta tela.</p>
      <div className={styles.noticeActions} aria-hidden>
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
    </main>
  );
}
