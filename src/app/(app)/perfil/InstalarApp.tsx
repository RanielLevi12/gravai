"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./perfil.module.css";

type EventoInstalar = Event & { prompt: () => Promise<void> };

/** "Instalar app na tela inicial": usa o aviso do navegador quando existe; senão, orienta o caminho manual. */
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    const aoPoder = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    window.addEventListener("beforeinstallprompt", aoPoder);
    return () => window.removeEventListener("beforeinstallprompt", aoPoder);
  }, []);

  if (evento) {
    return (
      <button type="button" className={`${styles.row} ${styles.rowButton}`} onClick={() => void evento.prompt()}>
        <span className={styles.rowText}>Instalar app na tela inicial</span>
        <Download size={20} strokeWidth={2} aria-hidden />
      </button>
    );
  }
  return (
    <div className={styles.row}>
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>Instalar app na tela inicial</span>
        <span>No menu do navegador, escolha &ldquo;Adicionar à tela inicial&rdquo;.</span>
      </span>
    </div>
  );
}
