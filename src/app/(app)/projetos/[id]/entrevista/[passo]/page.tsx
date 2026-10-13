import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AiError } from "@/lib/ai/schemas";
import { loadInterviewSuggestion, suggestTitles } from "@/lib/interview/actions";
import {
  EPISODES_STEP,
  canOpen,
  firstMissing,
  isRouteStep,
  questionNumber,
  type Interview,
  type InterviewSuggestion,
  type RouteStep,
  type TitleOption,
} from "@/lib/interview/steps";
import { countWords, mainDurationOptions } from "@/lib/rules/duration";
import { DEFAULT_CTA_LABELS, isCtaKind } from "@/lib/profile/schema";
import { createServerClient } from "@/lib/supabase/server";
import { EpisodesStep } from "./EpisodesStep";
import { InterviewStep, type CtaOption } from "./InterviewStep";
import { Summary } from "./Summary";

export const metadata: Metadata = { title: "Entrevista · Gravaí" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Passo anterior (para a seta de voltar); a subtela de episódios só existe na série. */
function previousHref(id: string, step: RouteStep, i: Interview): string {
  const order: RouteStep[] = ["plataformas", "formato", EPISODES_STEP, "duracao", "cortes", "cenario", "titulos", "capa", "cta", "resumo"];
  let k = order.indexOf(step) - 1;
  if (order[k] === EPISODES_STEP && i.format !== "series") k--;
  return k < 0 ? `/projetos/${id}/fonte` : `/projetos/${id}/entrevista/${order[k]}`;
}

function notConnected(e: unknown): boolean {
  return e instanceof AiError && e.code === "not_connected";
}

export default async function EntrevistaPage({ params }: { params: Promise<{ id: string; passo: string }> }) {
  const { id, passo } = await params;
  if (!UUID.test(id) || !isRouteStep(passo)) notFound();

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  // RLS limita aos projetos do usuário: projeto de outra pessoa cai no 404.
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status, source_text, interview, series_id, episode_index")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  if (project.status === "fonte") redirect(`/projetos/${id}/fonte`);

  let interview = (project.interview && typeof project.interview === "object" && !Array.isArray(project.interview)
    ? project.interview
    : {}) as unknown as Interview;
  // O passo vem da URL; só abre se os anteriores estiverem respondidos.
  if (!canOpen(interview, passo)) redirect(`/projetos/${id}/entrevista/${firstMissing(interview)}`);

  const base = `/projetos/${id}/entrevista`;
  const backHref = previousHref(id, passo, interview);

  if (passo === "resumo") {
    const { data: ctas } = await supabase.from("ctas").select("id, kind, label");
    const cta = ctas?.find((c) => c.id === interview.ctaId);
    const ctaLabel = cta ? cta.label || (isCtaKind(cta.kind) ? DEFAULT_CTA_LABELS[cta.kind] : "Chamada") : null;
    return <Summary projectId={id} backHref={backHref} interview={interview} ctaLabel={ctaLabel} episodeIndex={project.episode_index} />;
  }

  // Sugestão da IA: uma vez, logo depois do texto-fonte; falha não é repetida a cada passo.
  // Sem IA conectada (ou após falha) a entrevista segue sem ela.
  const loaded = await loadInterviewSuggestion(id, interview);
  const suggestion: InterviewSuggestion | null = loaded.suggestion;
  let noAi = loaded.noAi;
  if (suggestion) interview = { ...interview, suggestion };

  if (passo === EPISODES_STEP) {
    if (interview.format !== "series") redirect(`${base}/formato`);
    return (
      <EpisodesStep
        projectId={id}
        backHref={backHref}
        confirmed={project.series_id !== null}
        initial={interview.episodes ?? suggestion?.episodes ?? []}
        suggested={!interview.episodes && (suggestion?.episodes.length ?? 0) > 0}
      />
    );
  }

  let titleOptions: TitleOption[] = interview.titleSuggestions ?? [];
  let titlesFailed = false;
  if (passo === "titulos" && titleOptions.length === 0 && !noAi) {
    try {
      titleOptions = await suggestTitles(id);
    } catch (e) {
      if (notConnected(e)) noAi = true;
      else {
        titlesFailed = true;
        console.error("[entrevista] títulos falharam", e instanceof Error ? e.message : e);
      }
    }
  }

  let ctas: CtaOption[] = [];
  if (passo === "cta") {
    const { data } = await supabase.from("ctas").select("id, kind, label, value").order("id");
    ctas = (data ?? []).map((c) => ({
      id: c.id,
      label: c.label || (isCtaKind(c.kind) ? DEFAULT_CTA_LABELS[c.kind] : "Chamada"),
      detail: c.value ?? "",
    }));
  }

  return (
    <InterviewStep
      key={passo}
      projectId={id}
      step={passo}
      number={questionNumber(passo)}
      backHref={backHref}
      interview={interview}
      suggestion={suggestion}
      noAi={noAi}
      words={countWords(project.source_text)}
      durations={mainDurationOptions(project.source_text)}
      ctas={ctas}
      titleOptions={titleOptions}
      titlesFailed={titlesFailed}
      defaultTitle={project.title}
    />
  );
}
