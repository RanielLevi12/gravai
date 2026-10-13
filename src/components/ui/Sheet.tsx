"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./Sheet.module.css";

/**
 * Folha que sobe da base da tela (diálogo modal nativo: foco preso, Esc fecha, fundo inerte).
 * O conteúdo só existe enquanto aberta, então cada abertura começa do zero.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // Toque no fundo escurecido fecha; o painel ocupa o resto do diálogo.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? (
        <div className={styles.panel}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
