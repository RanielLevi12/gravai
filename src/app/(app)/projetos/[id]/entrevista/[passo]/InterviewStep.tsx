"use client";

import { ArrowRight, Copy, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { OptionCard } from "@/components/ui/OptionCard";
import { saveAnswer } from "@/lib/interview/actions";
import {
  MAX_TITLE,
  PLATFORM_LABELS,
  PLATFORMS,
  formatSeconds,
  type AnswerStep,
  type Interview,
  type InterviewSuggestion,
  type Platform,
  type Scenery,
  type StepValues,
  type TitleOption,
} from "@/lib/interview/steps";
import { CUT_DURATIONS, allowedCutDurations, estimateCutCount, suggestCutDuration } from "@/lib/rules/cuts";
import { targetWords, type MainDurationOption } from "@/lib/rules/duration";
import { InterviewFrame } from "./InterviewFrame";
import styles from "./entrevista.module.css";

export type CtaOption = { id: string; label: string; detail: string };

type Props = {
  projectId: string;
  step: AnswerStep;
  number: number;
  backHref: string;
  interview: Interview;
  suggestion: InterviewSuggestion | null;
  noAi: boolean;
  words: number;
  durations: MainDurationOption[];
  ctas: CtaOption[];
  titleOptions: TitleOption[];
  titlesFailed: boolean;
  defaultTitle: string;
};

const QUESTIONS: Record<AnswerStep, string> = {
  plataformas: "Onde você vai publicar?",
  formato: "Um vídeo ou uma série?",
  duracao: "Quanto tempo de vídeo?",
  cortes: "Qual o tamanho de cada corte?",
  cenario: "Onde você vai gravar?",
  titulos: "Qual vai ser o título?",
  capa: "Como vai ser a capa?",
  cta: "Qual chamada no final?",
};

const NATURAL_FALLBACK = "Um canto arrumado da casa, com a luz de uma janela de frente para você.";
const VERTICAL: Platform[] = ["reels", "tiktok", "feed_instagram"];

function longDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} segundos`;
  const min = Math.round(seconds / 60);
  return `${min} ${min === 1 ? "minuto" : "minutos"}`;
}

function potential(score: number): string {
  if (score >= 0.7) return "Potencial alto";
  if (score >= 0.4) return "Potencial médio";
  return "Potencial baixo";
}

type TitleDraft = { pick: number | "custom"; custom: string };

/** Uma pergunta da entrevista: resposta salva > sugestão > primeira opção válida. */
export function InterviewStep(props: Props) {
  const { projectId, step, number, backHref, interview: i, suggestion: s, noAi } = props;
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // --- estado inicial de cada passo ---
  const enabledDurations = props.durations.filter((d) => d.enabled).map((d) => d.seconds);
  const mainSeconds = i.mainSeconds ?? 0;
  const allowedCuts = allowedCutDurations(mainSeconds);
  const suggestedCut = i.mainSeconds ? suggestCutDuration(i.mainSeconds, i.platforms ?? []) : null;
  const suggestedDuration = s && enabledDurations.includes(s.mainSeconds) ? s.mainSeconds : null;

  const [platforms, setPlatforms] = useState<Platform[]>(() => i.platforms ?? s?.platforms ?? [PLATFORMS[0]]);
  const [format, setFormat] = useState<"single" | "series">(() => i.format ?? s?.format ?? "single");
  const [duration, setDuration] = useState<number>(() => i.mainSeconds ?? suggestedDuration ?? enabledDurations[0]);
  const [cut, setCut] = useState<number | null>(() =>
    i.cutSeconds !== undefined ? i.cutSeconds : (suggestedCut ?? allowedCuts[0] ?? null),
  );
  const [scenery, setScenery] = useState<Scenery>(
    () => i.scenery ?? { mode: "natural", natural: s?.scenery.natural || NATURAL_FALLBACK, aiPrompt: s?.scenery.aiPrompt ?? "" },
  );
  const [title, setTitle] = useState<TitleDraft>(() => {
    const chosen = i.titles?.chosen;
    if (chosen) {
      const k = props.titleOptions.findIndex((o) => o.text === chosen);
      return k >= 0 ? { pick: k, custom: "" } : { pick: "custom", custom: chosen };
    }
    return props.titleOptions.length > 0 ? { pick: 0, custom: "" } : { pick: "custom", custom: props.defaultTitle };
  });
  const [cover, setCover] = useState<"frame" | "ai">(() => i.cover ?? s?.cover ?? "frame");
  const [cta, setCta] = useState<string | null>(() => (i.ctaId !== undefined ? i.ctaId : (props.ctas[0]?.id ?? null)));

  function value(): StepValues[AnswerStep] | undefined {
    switch (step) {
      case "plataformas":
        return platforms;
      case "formato":
        return format;
      case "duracao":
        return duration;
      case "cortes":
        return cut;
      case "cenario":
        return scenery;
      case "titulos": {
        const chosen = title.pick === "custom" ? title.custom.trim() : props.titleOptions[title.pick]?.text;
        return chosen ? { options: props.titleOptions, chosen } : undefined;
      }
      case "capa":
        return cover;
      case "cta":
        return cta;
    }
  }

  async function submit(v: StepValues[AnswerStep] | undefined = value()) {
    if (busy.current) return;
    if (v === undefined || (Array.isArray(v) && v.length === 0)) {
      setErro(step === "titulos" ? "Escolha ou escreva um título." : "Escolha uma opção para continuar.");
      return;
    }
    busy.current = true;
    setPending(true);
    setErro(null);
    try {
      const r = await saveAnswer(projectId, step, v);
      if ("next" in r) {
        router.push(`/projetos/${projectId}/entrevista/${r.next}`);
        return;
      }
      setErro(r.error);
    } catch {
      setErro("Não foi possível salvar agora. Tente de novo.");
    }
    busy.current = false;
    setPending(false);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(scenery.aiPrompt);
      setToast("Prompt copiado");
    } catch {
      setToast("Não consegui copiar. Selecione o texto e copie.");
    }
  }

  // --- conteúdo de cada passo ---
  let lead: ReactNode = null;
  let why: string | null = null;
  let body: ReactNode = null;
  let extra: ReactNode = null;

  switch (step) {
    case "plataformas":
      lead = "Marque todas que quiser. As descrições saem prontas para cada uma.";
      why = s?.reasons.plataformas ?? null;
      body = (
        <div className={styles.grid} role="group" aria-label="Plataformas">
          {PLATFORMS.map((p) => (
            <OptionCard
              key={p}
              type="checkbox"
              size="text"
              name="plataformas"
              value={p}
              label={PLATFORM_LABELS[p]}
              suggested={Boolean(s?.platforms.includes(p))}
              checked={platforms.includes(p)}
              onChange={(on) => setPlatforms((cur) => PLATFORMS.filter((x) => (x === p ? on : cur.includes(x))))}
            />
          ))}
        </div>
      );
      break;

    case "formato":
      lead = "Uma série divide o texto em episódios, cada um com o seu vídeo.";
      why = s?.reasons.formato ?? null;
      body = (
        <div className={styles.list} role="radiogroup" aria-label="Formato">
          <OptionCard
            name="formato"
            value="single"
            size="text"
            label="Vídeo único"
            sub="Um vídeo principal e os cortes dele"
            suggested={s?.format === "single"}
            checked={format === "single"}
            onChange={() => setFormat("single")}
          />
          <OptionCard
            name="formato"
            value="series"
            size="text"
            label="Série"
            sub="Vários episódios a partir do mesmo texto"
            suggested={s?.format === "series"}
            checked={format === "series"}
            onChange={() => setFormat("series")}
          />
        </div>
      );
      break;

    case "duracao":
      lead = (
        <>
          Calculamos pelo tamanho do seu texto: <b className={styles.num}>{props.words} palavras</b>.
        </>
      );
      why = s?.reasons.duracao ?? null;
      body = (
        <div className={styles.grid} role="radiogroup" aria-label="Duração do vídeo">
          {props.durations.map((d) => (
            <OptionCard
              key={d.seconds}
              name="duracao"
              value={String(d.seconds)}
              label={formatSeconds(d.seconds)}
              sub={`≈ ${targetWords(d.seconds)} palavras`}
              reason={d.reason}
              disabled={!d.enabled}
              suggested={suggestedDuration === d.seconds}
              checked={duration === d.seconds}
              onChange={() => setDuration(d.seconds)}
            />
          ))}
        </div>
      );
      break;

    case "cortes": {
      lead = (
        <>
          Seu vídeo terá <b>{longDuration(mainSeconds)}</b>. O script já vai nascer dividido nesses trechos.
        </>
      );
      if (suggestedCut !== null) {
        const vertical = (i.platforms ?? []).filter((p) => VERTICAL.includes(p));
        why =
          suggestedCut === 30 && vertical.length > 0
            ? `${vertical.map((p) => PLATFORM_LABELS[p]).join(" e ")} entregam melhor vídeos de até 30 s. Por isso marcamos essa opção.`
            : `Cortes de ${suggestedCut} s são os maiores que cabem no seu vídeo sem passar da metade dele.`;
      }
      body = (
        <div className={styles.grid} role="radiogroup" aria-label="Duração do corte">
          {CUT_DURATIONS.map((c) => {
            const ok = allowedCuts.includes(c);
            const n = estimateCutCount(mainSeconds, c);
            return (
              <OptionCard
                key={c}
                name="cortes"
                value={String(c)}
                label={`${c} s`}
                sub={ok ? `≈ ${n} ${n === 1 ? "corte" : "cortes"}` : undefined}
                reason="Maior que a metade do vídeo"
                disabled={!ok}
                cuts={ok ? n : undefined}
                suggested={suggestedCut === c}
                checked={cut === c}
                onChange={() => setCut(c)}
              />
            );
          })}
        </div>
      );
      extra = (
        <button type="button" className={styles.skip} disabled={pending} onClick={() => void submit(null)}>
          Não quero cortes
        </button>
      );
      break;
    }

    case "cenario":
      lead = "Um cenário simples em casa ou um fundo feito com IA de imagem.";
      why = s?.reasons.cenario ?? null;
      body = (
        <>
          <div className={styles.list} role="radiogroup" aria-label="Cenário">
            <OptionCard
              name="cenario"
              value="natural"
              size="text"
              label="Cenário natural"
              sub="Você grava num canto da casa"
              suggested={Boolean(s)}
              checked={scenery.mode === "natural"}
              onChange={() => setScenery((c) => ({ ...c, mode: "natural" }))}
            />
            <OptionCard
              name="cenario"
              value="ai"
              size="text"
              label="Fundo criado com IA"
              sub="Gere a imagem numa IA e use como fundo"
              checked={scenery.mode === "ai"}
              onChange={() => setScenery((c) => ({ ...c, mode: "ai" }))}
            />
          </div>
          {scenery.mode === "natural" ? (
            <Field
              id="cenario-natural"
              label="Como montar o cenário"
              multiline
              rows={3}
              maxLength={500}
              value={scenery.natural}
              onChange={(e) => setScenery((c) => ({ ...c, natural: e.target.value }))}
            />
          ) : (
            <div className={styles.promptBox}>
              <Field
                id="cenario-prompt"
                label="Prompt para a IA de imagem"
                multiline
                rows={5}
                maxLength={2000}
                placeholder="Descreva o fundo: lugar, cores, luz. Sem pessoas e sem texto."
                value={scenery.aiPrompt}
                onChange={(e) => setScenery((c) => ({ ...c, aiPrompt: e.target.value }))}
              />
              <Button variant="soft" icon={Copy} disabled={!scenery.aiPrompt.trim()} onClick={() => void copyPrompt()}>
                Copiar prompt
              </Button>
            </div>
          )}
        </>
      );
      break;

    case "titulos": {
      const hasOptions = props.titleOptions.length > 0;
      lead = hasOptions ? "Ordenamos do que tem mais chance de chamar atenção para o que tem menos." : "Escreva o título do vídeo.";
      body = (
        <>
          {props.titlesFailed ? (
            <p className={styles.notice} role="note">
              Não consegui sugerir títulos agora. Escreva o seu ou volte daqui a pouco.
            </p>
          ) : null}
          {hasOptions ? (
            <div className={styles.list} role="radiogroup" aria-label="Título">
              {props.titleOptions.map((o, k) => (
                <OptionCard
                  key={o.text}
                  name="titulos"
                  value={String(k)}
                  size="text"
                  label={o.text}
                  sub={potential(o.score)}
                  suggested={k === 0}
                  checked={title.pick === k}
                  onChange={() => setTitle((t) => ({ ...t, pick: k }))}
                />
              ))}
              <OptionCard
                name="titulos"
                value="custom"
                size="text"
                label="Escrever outro título"
                checked={title.pick === "custom"}
                onChange={() => setTitle((t) => ({ ...t, pick: "custom" }))}
              />
            </div>
          ) : null}
          {title.pick === "custom" ? (
            <Field
              id="titulo-proprio"
              label="Seu título"
              maxLength={MAX_TITLE}
              value={title.custom}
              onChange={(e) => setTitle({ pick: "custom", custom: e.target.value })}
            />
          ) : null}
        </>
      );
      break;
    }

    case "capa":
      lead = "A capa aparece no feed antes de a pessoa dar o play.";
      why = s?.reasons.capa ?? null;
      body = (
        <div className={styles.list} role="radiogroup" aria-label="Capa">
          <OptionCard
            name="capa"
            value="frame"
            size="text"
            label="Quadro do vídeo"
            sub="Um momento seu falando, com o título por cima"
            suggested={s?.cover === "frame"}
            checked={cover === "frame"}
            onChange={() => setCover("frame")}
          />
          <OptionCard
            name="capa"
            value="ai"
            size="text"
            label="Capa criada com IA"
            sub="Você recebe o prompt pronto para gerar a imagem"
            suggested={s?.cover === "ai"}
            checked={cover === "ai"}
            onChange={() => setCover("ai")}
          />
        </div>
      );
      break;

    case "cta":
      lead = "Ela entra no fim do script e das descrições.";
      body = (
        <>
          <div className={styles.list} role="radiogroup" aria-label="Chamada no final">
            {props.ctas.map((c) => (
              <OptionCard
                key={c.id}
                name="cta"
                value={c.id}
                size="text"
                label={c.label}
                sub={c.detail || undefined}
                checked={cta === c.id}
                onChange={() => setCta(c.id)}
              />
            ))}
            <OptionCard
              name="cta"
              value=""
              size="text"
              label="Sem chamada"
              sub="O vídeo termina sem pedir nada"
              checked={cta === null}
              onChange={() => setCta(null)}
            />
          </div>
          {props.ctas.length === 0 ? (
            <Link href="/perfil" className={styles.skip}>
              Cadastrar uma chamada no Perfil
            </Link>
          ) : null}
        </>
      );
      break;
  }

  return (
    <InterviewFrame
      number={number}
      backHref={backHref}
      noAi={noAi}
      footer={
        <Button className={styles.full} disabled={pending} aria-busy={pending} onClick={() => void submit()}>
          Próxima
          <ArrowRight size={20} strokeWidth={2} aria-hidden />
        </Button>
      }
    >
      <h1 className={styles.question}>{QUESTIONS[step]}</h1>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
      {body}
      {why ? (
        <p className={styles.why}>
          <Lightbulb size={20} strokeWidth={2} aria-hidden />
          <span>{why}</span>
        </p>
      ) : null}
      {extra}
      {erro ? (
        <p role="alert" className={styles.alert}>
          {erro}
        </p>
      ) : null}
      <p role="status" className={toast ? styles.toast : styles.srOnly}>
        {toast ?? ""}
      </p>
    </InterviewFrame>
  );
}
