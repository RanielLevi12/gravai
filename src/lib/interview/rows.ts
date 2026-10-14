import { PLATFORM_LABELS, cutSummary, formatSeconds, type AnswerStep, type Interview } from "./steps";

export type SummaryRow = { step: AnswerStep; label: string; value: string };

/** Linhas do resumo da entrevista: uma por pergunta, com a resposta em palavras. */
export function summaryRows(i: Interview, ctaLabel: string | null, ctaRemoved: boolean, episodeIndex: number | null): SummaryRow[] {
  const episodes = i.episodes?.length ?? 0;
  return [
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
    { step: "cta", label: "Chamada no final", value: ctaRemoved ? "Chamada removida do perfil" : (ctaLabel ?? "Sem chamada") },
  ];
}
