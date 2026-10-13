"use client";

import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { confirmSeries } from "@/lib/interview/actions";
import { MAX_EPISODES, MIN_EPISODES, type Episode } from "@/lib/interview/steps";
import { InterviewFrame } from "./InterviewFrame";
import styles from "./entrevista.module.css";

/** Subtela da série: confere os episódios e cria um projeto por episódio (1 projeto da cota por episódio novo). */
export function EpisodesStep({
  projectId,
  backHref,
  confirmed,
  initial,
  suggested,
}: {
  projectId: string;
  backHref: string;
  confirmed: boolean;
  initial: Episode[];
  suggested: boolean;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>(() => {
    const list = initial.slice(0, MAX_EPISODES);
    while (list.length < MIN_EPISODES) list.push({ title: "", summary: "" });
    return list;
  });
  const next = `/projetos/${projectId}/entrevista/duracao`;

  const edit = (k: number, patch: Partial<Episode>) => setEpisodes((list) => list.map((e, j) => (j === k ? { ...e, ...patch } : e)));

  async function criar() {
    if (busy.current) return;
    if (episodes.some((e) => !e.title.trim())) {
      setErro("Dê um título a cada episódio.");
      return;
    }
    busy.current = true;
    setPending(true);
    setErro(null);
    try {
      const r = await confirmSeries(projectId, episodes);
      if ("ids" in r) {
        router.push(next);
        return;
      }
      setErro(r.error);
    } catch {
      setErro("Não consegui criar a série. Tente de novo.");
    }
    busy.current = false;
    setPending(false);
  }

  if (confirmed) {
    return (
      <InterviewFrame
        number={2}
        backHref={backHref}
        footer={
          <Button href={next} className={styles.full}>
            Próxima
            <ArrowRight size={20} strokeWidth={2} aria-hidden />
          </Button>
        }
      >
        <h1 className={styles.question}>Sua série</h1>
        <p className={styles.lead}>Cada episódio virou um projeto na sua lista. Este é o primeiro.</p>
        <ol className={styles.episodes}>
          {initial.map((e, k) => (
            <li key={k} className={styles.episode}>
              <span className={styles.episodeNum}>{k + 1}</span>
              <span>
                <b>{e.title}</b>
                {e.summary ? <span className={styles.episodeSummary}>{e.summary}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </InterviewFrame>
    );
  }

  const novos = episodes.length - 1;
  return (
    <InterviewFrame
      number={2}
      backHref={backHref}
      footer={
        <Button className={styles.full} disabled={pending} aria-busy={pending} onClick={() => void criar()}>
          Criar {episodes.length} episódios
        </Button>
      }
    >
      <h1 className={styles.question}>Quais episódios?</h1>
      <p className={styles.lead}>
        {suggested ? "Dividimos o texto assim. Ajuste o que quiser." : "Dê um título a cada episódio."} Cada episódio novo usa 1 dos seus
        projetos do mês ({novos} {novos === 1 ? "novo" : "novos"}).
      </p>
      <ol className={styles.episodes}>
        {episodes.map((e, k) => (
          <li key={k} className={styles.episodeEdit}>
            <div className={styles.episodeHead}>
              <span className={styles.episodeNum}>{k + 1}</span>
              {episodes.length > MIN_EPISODES ? (
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={`Tirar o episódio ${k + 1}`}
                  onClick={() => setEpisodes((list) => list.filter((_, j) => j !== k))}
                >
                  <Trash2 size={20} strokeWidth={2} aria-hidden />
                </button>
              ) : null}
            </div>
            <Field id={`ep-${k}-titulo`} label="Título" maxLength={100} value={e.title} onChange={(ev) => edit(k, { title: ev.target.value })} />
            <Field
              id={`ep-${k}-resumo`}
              label="Do que trata"
              multiline
              rows={2}
              maxLength={500}
              value={e.summary}
              onChange={(ev) => edit(k, { summary: ev.target.value })}
            />
          </li>
        ))}
      </ol>
      {episodes.length < MAX_EPISODES ? (
        <Button variant="soft" icon={Plus} onClick={() => setEpisodes((list) => [...list, { title: "", summary: "" }])}>
          Adicionar episódio
        </Button>
      ) : null}
      <Button variant="soft" href={backHref}>
        Prefiro um vídeo único
      </Button>
      {erro ? (
        <p role="alert" className={styles.alert}>
          {erro}
        </p>
      ) : null}
    </InterviewFrame>
  );
}
