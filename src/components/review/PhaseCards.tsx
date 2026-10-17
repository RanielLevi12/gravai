import { Clapperboard, FolderOpen } from "lucide-react";
import { clock } from "@/components/script/format";
import { COLOR_VAR, isFolderColor } from "@/lib/folders/schema";
import { plural, type ProjectCard, type VideoCard } from "@/lib/project/review-cards";
import styles from "./PhaseCards.module.css";

/** Conferência em duas fases, cada uma com formato e cor próprios: o vídeo (grande, rosa) e o projeto (faixa, cor do projeto). */
export function PhaseCards({ video, project }: { video: VideoCard; project: ProjectCard }) {
  const cor = project.kind === "folder" ? COLOR_VAR[isFolderColor(project.color) ? project.color : "rosa"] : "var(--line-strong)";
  return (
    <div className={styles.cards}>
      <section className={styles.video} aria-labelledby="fase-video">
        <h2 id="fase-video" className={styles.videoTitle}>
          <Clapperboard size={20} strokeWidth={2.25} aria-hidden />
          Este vídeo
        </h2>
        <p className={`tnum ${styles.big}`}>{plural(video.count, "gravação", "gravações")}</p>
        <p className={`tnum ${styles.sub}`}>{video.seconds > 0 ? `${clock(video.seconds)} no total` : "Sem tempo medido"}</p>
        <span className={styles.status}>{video.approved ? "Aprovado e guardado" : "Falta aprovar"}</span>
      </section>
      <section className={styles.project} aria-labelledby="fase-projeto">
        <span className={styles.tile} style={{ background: cor }} aria-hidden>
          <FolderOpen size={22} strokeWidth={2.25} />
        </span>
        <div className={styles.projectText}>
          <h2 id="fase-projeto" className={styles.projectTitle}>
            {project.kind === "folder" ? project.name : "Sem projeto"}
          </h2>
          <p className={`tnum ${styles.projectSub}`}>
            {project.kind === "folder" ? `Projeto · ${plural(project.videos, "vídeo", "vídeos")}` : "Este é um vídeo solto"}
          </p>
        </div>
      </section>
    </div>
  );
}
