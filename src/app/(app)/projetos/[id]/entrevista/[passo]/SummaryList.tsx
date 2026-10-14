import { Pencil } from "lucide-react";
import Link from "next/link";
import { isInheritedStep, type InheritedStep } from "@/lib/folders/inherit";
import type { SummaryRow } from "@/lib/interview/rows";
import { ResetButton } from "./ResetButton";
import styles from "./entrevista.module.css";

/** Linhas de resposta: cada uma volta ao passo. Em vídeo de projeto, a mudada ganha "personalizado" e o botão de voltar ao padrão. */
export function SummaryList({
  projectId,
  rows,
  custom = [],
  inSeries = false,
}: {
  projectId: string;
  rows: SummaryRow[];
  custom?: InheritedStep[];
  /** Vídeo de série não volta para "vídeo único" (o banco recusa), então o formato não tem o botão. */
  inSeries?: boolean;
}) {
  return (
    <ul className={styles.summary} aria-label="Suas respostas">
      {rows.map((r) => {
        const isCustom = isInheritedStep(r.step) && custom.includes(r.step);
        return (
          <li key={r.step}>
            <Link href={`/projetos/${projectId}/entrevista/${r.step}`} className={styles.summaryRow}>
              <span className={styles.summaryText}>
                <span className={styles.summaryLabel}>
                  {r.label}
                  {isCustom ? <span className={styles.badge}>personalizado</span> : null}
                </span>
                <span className={styles.summaryValue}>{r.value}</span>
              </span>
              <Pencil size={18} strokeWidth={2} aria-hidden />
            </Link>
            {isCustom && isInheritedStep(r.step) && !(r.step === "formato" && inSeries) ? (
              <div className={styles.resetLine}>
                <ResetButton projectId={projectId} step={r.step} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
