import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { InheritedStep } from "@/lib/folders/inherit";
import { summaryRows } from "@/lib/interview/rows";
import type { Interview } from "@/lib/interview/steps";
import { InterviewFrame } from "./InterviewFrame";
import { SummaryList } from "./SummaryList";
import styles from "./entrevista.module.css";

/** Resumo da entrevista (wireframe entrevista-resumo): cada linha volta ao passo. */
export function Summary({
  projectId,
  backHref,
  interview: i,
  ctaLabel,
  ctaRemoved,
  episodeIndex,
  custom = [],
  inSeries = false,
}: {
  projectId: string;
  backHref: string;
  interview: Interview;
  ctaLabel: string | null;
  /** A chamada escolhida não existe mais no perfil (foi apagada). */
  ctaRemoved: boolean;
  episodeIndex: number | null;
  /** Respostas que diferem do projeto do vídeo (vazio em vídeo solto). */
  custom?: InheritedStep[];
  inSeries?: boolean;
}) {
  const rows = summaryRows(i, ctaLabel, ctaRemoved, episodeIndex);

  return (
    <InterviewFrame
      number={8}
      backHref={backHref}
      footer={
        <Button href={`/projetos/${projectId}/script`} prefetch={false} className={styles.full}>
          Gerar script
          <ArrowRight size={20} strokeWidth={2} aria-hidden />
        </Button>
      }
    >
      <h1 className={styles.question}>Tudo certo?</h1>
      <p className={styles.lead}>Toque numa resposta para mudar.</p>
      {ctaRemoved ? (
        <p className={styles.notice} role="note">
          A chamada que você escolheu foi removida do seu perfil. Toque em “Chamada no final” e escolha de novo, ou o script sai sem ela.
        </p>
      ) : null}
      <SummaryList projectId={projectId} rows={rows} custom={custom} inSeries={inSeries} />
    </InterviewFrame>
  );
}
