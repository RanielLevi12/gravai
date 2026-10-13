import type { Metadata } from "next";
import { EntrarForm } from "./EntrarForm";
import styles from "./entrar.module.css";

export const metadata: Metadata = { title: "Entrar · Gravaí" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marca/gravai-horizontal.svg" alt="Gravaí" className={styles.logo} width={153} height={42} />
        <h1 className="display">Entre no Gravaí</h1>
        <p className={styles.lead}>Do livro, PDF ou ideia ao vídeo gravado, com script, teleprompter e cortes prontos.</p>
      </header>
      {erro === "link" ? (
        <p role="alert" className={styles.alert}>
          Esse link não funcionou. Peça um novo e abra no mesmo navegador em que pediu.
        </p>
      ) : null}
      <EntrarForm />
    </main>
  );
}
