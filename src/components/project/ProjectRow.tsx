import { ArrowRight, FolderOpen, Video, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { nextStepHref } from "@/lib/project/next-step";
import { MoveVideo, type FolderChoice } from "./MoveVideo";
import { origemDoProjeto } from "./origens";
import styles from "./ProjectRow.module.css";

export type ProjectRowData = {
  id: string;
  title: string;
  status: string;
  source_kind: string;
  interview: unknown;
};

type Etapa = { indice: number; meta: string; proxima: string; acao: string; icon: LucideIcon };

const ETAPAS: Record<string, Etapa> = {
  fonte: { indice: 0, meta: "Texto · revisar", proxima: "Confira o texto extraído", acao: "Continuar", icon: ArrowRight },
  entrevista: { indice: 1, meta: "Entrevista", proxima: "Faltam algumas perguntas", acao: "Continuar", icon: ArrowRight },
  script: { indice: 2, meta: "Script", proxima: "Revise o script", acao: "Continuar", icon: ArrowRight },
  gravacao: { indice: 3, meta: "Gravação", proxima: "Script pronto", acao: "Gravar", icon: Video },
  pronto: { indice: 5, meta: "Pronto", proxima: "Vídeos prontos", acao: "Abrir", icon: FolderOpen },
};

const TOTAL_ETAPAS = 5;

/** Linha de "Continue de onde parou": capa (ou origem), etapa atual e a próxima ação. */
export function ProjectRow({ project, move }: { project: ProjectRowData; move?: { currentFolderId: string | null; folders: FolderChoice[] } }) {
  const etapa = ETAPAS[project.status] ?? ETAPAS.fonte;
  const origem = origemDoProjeto(project.source_kind);
  const Origem = origem.icon;
  const Acao = etapa.icon;
  const concluido = etapa.indice >= TOTAL_ETAPAS;

  return (
    <article className={styles.proj} aria-labelledby={`proj-${project.id}`}>
      <div className={styles.thumb} role="img" aria-label={`Sem capa ainda; origem: ${origem.nome}`}>
        <Origem size={24} strokeWidth={2} aria-hidden />
      </div>
      <div className={styles.info}>
        <h3 id={`proj-${project.id}`} className={styles.title}>
          {project.title}
        </h3>
        <p className={styles.meta}>{etapa.meta}</p>
        <div
          className={styles.steps}
          role="img"
          aria-label={concluido ? "Concluído" : `Etapa ${etapa.indice + 1} de ${TOTAL_ETAPAS}`}
        >
          {Array.from({ length: TOTAL_ETAPAS }, (_, i) => (
            <i key={i} className={i < etapa.indice ? styles.done : i === etapa.indice ? styles.now : undefined} />
          ))}
        </div>
      </div>
      <div className={styles.next}>
        <span>{etapa.proxima}</span>
        {move && (move.folders.length > 0 || move.currentFolderId) ? <MoveVideo videoId={project.id} currentFolderId={move.currentFolderId} folders={move.folders} /> : null}
        <Link href={nextStepHref(project)} className={styles.nextBtn}>
          <Acao size={17} strokeWidth={2} aria-hidden />
          {etapa.acao}
        </Link>
      </div>
    </article>
  );
}
