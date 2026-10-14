"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { COST_EVENT } from "@/lib/ai/cost-events";
import styles from "./CostBar.module.css";

type Summary = { connected: boolean; monthUsd: number; lastUsd: number | null; balanceUsd: number | null };

/** Dólares com casas suficientes para custos pequenos (US$ 0,0123), sem exagerar nos grandes. */
export function usd(n: number): string {
  const digits = n === 0 ? 2 : n < 0.1 ? 4 : 2;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: digits }).format(n);
}

/** Faixa no alto do app: custo da última ação, gasto do mês e saldo na conta OpenRouter. Some se a IA não está conectada. */
export function CostBar() {
  const pathname = usePathname();
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/ai/custos", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<Summary>) : null))
        .then((v) => alive && v && setS(v))
        .catch(() => undefined);
    void load();
    window.addEventListener(COST_EVENT, load);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.removeEventListener(COST_EVENT, load);
      window.removeEventListener("focus", load);
    };
  }, [pathname]);

  if (!s?.connected) return null;
  return (
    <aside className={styles.bar} aria-label="Custos da sua IA">
      <span className={styles.label}>Sua IA</span>
      {s.lastUsd !== null ? (
        <span>
          Última ação <b>{usd(s.lastUsd)}</b>
        </span>
      ) : null}
      <span>
        Neste mês <b>{usd(s.monthUsd)}</b>
      </span>
      {s.balanceUsd !== null ? (
        <span>
          Saldo <b>{usd(s.balanceUsd)}</b>
        </span>
      ) : null}
    </aside>
  );
}
