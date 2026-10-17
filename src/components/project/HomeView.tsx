import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { TrashMenu } from "@/components/trash/TrashMenu";
import { COLOR_VAR, isFolderColor } from "@/lib/folders/schema";
import { nextStepHref } from "@/lib/project/next-step";
import { statusLabel } from "@/lib/project/status-label";
import { CriarVideo } from "./CriarVideo";
import styles from "./Home.module.css";
import { origemDoProjeto } from "./origens";
import { ProjectRow, type ProjectRowData } from "./ProjectRow";

export type HomeFolder = { id: string; name: string; color: string; count: number };
export type RecentVideo = ProjectRowData & { folders: { name: string } | null; missingParts?: number | null };

const plural = (n: number) => (n === 1 ? "1 vídeo" : `${n} vídeos`);

/** Tela inicial: só desenha; a página busca os dados. */
export function HomeView({
  usados,
  limite,
  recentes,
  pastas,
  soltos,
  naLixeira = 0,
}: {
  usados: number;
  limite: number;
  recentes: RecentVideo[];
  pastas: HomeFolder[];
  soltos: ProjectRowData[];
  /** Quantos itens há na lixeira (mostra o link no fim da tela). */
  naLixeira?: number;
}) {
  const lista = recentes;
  const listaPastas = pastas;
  const listaSoltos = soltos;
  const PROJECTS_LIMIT = limite;
  return (
    <main className={styles.page}>
      <h1 className={`display ${styles.title}`}>Seus vídeos</h1>
      <CriarVideo projetos={listaPastas.map(({ id, name, color }) => ({ id, name, color }))} />
      <p className={styles.usage}>
        <span className={styles.meter} aria-hidden>
          <i style={{ width: `${(usados / PROJECTS_LIMIT) * 100}%` }} />
        </span>
        <span className="tnum">
          {usados} de {PROJECTS_LIMIT} vídeos este mês
        </span>
      </p>

      {lista.length > 0 ? (
        <section aria-labelledby="continue-titulo">
          <h2 id="continue-titulo" className={styles.sectionTitle}>
            Continue de onde parou
          </h2>
          <ul className={styles.recent}>
            {lista.map((p) => {
              const st = statusLabel(p.status, p.missingParts ?? null);
              const Origem = origemDoProjeto(p.source_kind).icon;
              const pasta = p.folders?.name;
              return (
                <li key={p.id} className={styles.recentItem}>
                  <Link href={nextStepHref(p)} className={styles.recentCard}>
                    <span className={styles.recentIc}>
                      <Origem size={22} strokeWidth={2} aria-hidden />
                    </span>
                    <span className={styles.recentInfo}>
                      <span className={styles.recentTitle}>{p.title}</span>
                      <span className={styles.recentHint}>{pasta ? `${pasta} · ${st.hint}` : st.hint}</span>
                    </span>
                    <span className={`${styles.badge} ${styles[`badge${st.label}`]}`}>{st.label}</span>
                  </Link>
                  <TrashMenu kind="video" id={p.id} title={p.title} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className={styles.empty}>Seus vídeos aparecem aqui. Toque em “Criar vídeo” para começar o primeiro.</p>
      )}

      <section aria-labelledby="projetos-titulo">
        <h2 id="projetos-titulo" className={styles.sectionTitle}>
          Projetos
        </h2>
        <ul className={styles.projList}>
          {listaPastas.map((f) => {
            const cor = COLOR_VAR[isFolderColor(f.color) ? f.color : "rosa"];
            return (
              <li key={f.id} className={styles.proj}>
                <Link href={`/pastas/${f.id}`} className={styles.projMain}>
                  <span className={styles.projCover} style={{ background: cor }} aria-hidden>
                    {f.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.projInfo}>
                    <span className={styles.projName}>{f.name}</span>
                    <span className={`tnum ${styles.projCount}`}>{plural(f.count)}</span>
                  </span>
                </Link>
                <Link href={`/novo?projeto=${f.id}`} className={styles.projNew} aria-label={`Novo vídeo em ${f.name}`}>
                  <Plus size={16} strokeWidth={2.5} aria-hidden />
                  novo
                </Link>
                <TrashMenu kind="projeto" id={f.id} title={f.name} />
              </li>
            );
          })}
          <li>
            <Link href="/pastas/nova" className={styles.newProject}>
              <Plus size={18} strokeWidth={2.5} aria-hidden />
              Novo projeto
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="solto-titulo" className={styles.loose}>
        <h2 id="solto-titulo" className={styles.sectionTitle}>
          Sem projeto
          <span className={`tnum ${styles.looseCount}`}>{plural(listaSoltos.length)}</span>
        </h2>
        {listaSoltos.length > 0 ? (
          <div className={styles.list}>
            {listaSoltos.map((p) => (
              <ProjectRow key={p.id} project={p} move={{ currentFolderId: null, folders: listaPastas.map((f) => ({ id: f.id, name: f.name })) }} />
            ))}
          </div>
        ) : (
          <p className={styles.emptySmall}>Vídeos criados sem projeto ficam aqui.</p>
        )}
      </section>

      {naLixeira > 0 ? (
        <Link href="/lixeira" className={styles.trashLink}>
          <Trash2 size={16} strokeWidth={2} aria-hidden />
          Lixeira ({naLixeira})
        </Link>
      ) : null}
    </main>
  );
}
