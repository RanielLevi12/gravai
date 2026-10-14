"use client";

import { useEffect } from "react";
import styles from "./Toast.module.css";

/** Aviso curto sobre a barra de ação, com uma ação opcional (ex.: "Desfazer"). Some sozinho. */
export function Toast({
  message,
  onClose,
  action,
}: {
  message: string | null;
  onClose: () => void;
  action?: { label: string; onClick: () => void };
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, action ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [message, action, onClose]);

  return (
    <div role="status" className={message ? styles.toast : styles.srOnly}>
      {message ?? ""}
      {message && action ? (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.onClick();
            onClose();
          }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
