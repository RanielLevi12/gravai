import { ArrowRight, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PLATFORM_LABELS, cutSummary, formatSeconds, type AnswerStep, type Interview } from "@/lib/interview/steps";
import { InterviewFrame } from "./InterviewFrame";
import styles from "./entrevista.module.css";

/** Resumo da entrevista (wireframe entrevista-resumo): cada linha volta ao passo. */
export function Summary({
  projectId,
  backHref,
  interview: i,
  ctaLabel,
  episodeIndex,
}: {
  projectId: string;
  backHref: string;
  interview: Interview;
  ctaLabel: string | null;
  episodeIndex: number | null;
}) {
  const episodes = i.episodes?.length ?? 0;
  const rows: { step: AnswerStep; label: string; value: string }[] = [
    { step: "plataformas", label: "Plataformas", value: (i.platforms ?? []).map((p) => PLATFORM_LABELS[p]).join(", ") },
    {
      step: "formato",
      label: "Formato",
      value: i.format === "series" ? `Série · ${episodes} episódios${episodeIndex ? ` (este é o ${episodeIndex})` : ""}` : "Vídeo único",
    },
    { step: "duracao", label: "Duração", value: i.mainSeconds ? formatSeconds(i.mainSeconds) : "" },
    {
      step: "cortes",
      label: "Cortes",
      value: i.mainSeconds && typeof i.cutSeconds === "number" ? cutSummary(i.mainSeconds, i.cutSeconds) : "Sem cortes",
    },
    { step: "cenario", label: "Cenário", value: i.scenery?.mode === "ai" ? "Fundo criado com IA" : "Cenário natural" },
    { step: "titulos", label: "Título", value: i.titles?.chosen ? `“${i.titles.chosen}”` : "" },
    { step: "capa", label: "Capa", value: i.cover === "ai" ? "Capa criada com IA" : "Quadro do vídeo + título" },
    { step: "cta", label: "Chamada no final", value: ctaLabel ?? "Sem chamada" },
  ];

  return (
    <InterviewFrame
      number={8}
      backHref={backHref}
      footer={
        <Button href={`/projetos/${projectId}/script`} className={styles.full}>
          Gerar script
          <ArrowRight size={20} strokeWidth={2} aria-hidden />
        </Button>
      }
    >
      <h1 className={styles.question}>Tudo certo?</h1>
      <p className={styles.lead}>Toque numa resposta para mudar.</p>
      <ul className={styles.summary} aria-label="Suas respostas">
        {rows.map((r) => (
          <li key={r.step}>
            <Link href={`/projetos/${projectId}/entrevista/${r.step}`} className={styles.summaryRow}>
              <span className={styles.summaryText}>
                <span className={styles.summaryLabel}>{r.label}</span>
                <span className={styles.summaryValue}>{r.value}</span>
              </span>
              <Pencil size={18} strokeWidth={2} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </InterviewFrame>
  );
}
