import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ORIGENS } from "@/components/project/origens";
import { ProjectRow } from "@/components/project/ProjectRow";
import { COLOR_VAR, isFolderColor } from "@/lib/folders/schema";
import { createServerClient } from "@/lib/supabase/server";
import { currentMonth, PROJECTS_LIMIT } from "@/lib/usage";
import styles from "./projetos.module.css";

export const metadata: Metadata = { title: "Seus vídeos · Gravaí" };

export default async function ProjetosPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  const [{ data: projetos }, { data: pastas }, { data: uso }] = await Promise.all([
    // Só os vídeos soltos: os de um projeto aparecem dentro da pasta dele.
    supabase
      .from("projects")
      .select("id, title, status, source_kind, interview")
      .eq("user_id", auth.user.id)
      .is("folder_id", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("folders").select("id, name, color, projects(count)").eq("user_id", auth.user.id).order("created_at", { ascending: false }),
    supabase.from("usage_months").select("projects").eq("user_id", auth.user.id).eq("month", currentMonth()).maybeSingle(),
  ]);

  const usados = Math.min(uso?.projects ?? 0, PROJECTS_LIMIT);
  const lista = projetos ?? [];
  const listaPastas = pastas ?? [];

  return (
    <main className={styles.page}>
      <h1 className={`display ${styles.title}`}>Seus vídeos</h1>
      <p className={styles.usage}>
        <span className={styles.meter} aria-hidden>
          <i style={{ width: `${(usados / PROJECTS_LIMIT) * 100}%` }} />
        </span>
        <span className="tnum">
          {usados} de {PROJECTS_LIMIT} vídeos este mês
        </span>
      </p>

      <section className={styles.folders} aria-labelledby="projetos-titulo">
        <h2 id="projetos-titulo" className={styles.sectionTitle}>
          Projetos
        </h2>
        <ul className={styles.folderStrip}>
          {listaPastas.map((f) => {
            const n = (f.projects as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
            return (
              <li key={f.id}>
                <Link href={`/pastas/${f.id}`} className={styles.folder}>
                  <span className={styles.folderDot} style={{ background: COLOR_VAR[isFolderColor(f.color) ? f.color : "rosa"] }} aria-hidden />
                  <span className={styles.folderName}>{f.name}</span>
                  <span className={`tnum ${styles.folderCount}`}>{n === 1 ? "1 vídeo" : `${n} vídeos`}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/pastas/nova" className={`${styles.folder} ${styles.folderNew}`}>
              <span className={styles.folderPlus} aria-hidden>
                +
              </span>
              <span className={styles.folderName}>Novo projeto</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className={styles.newPanel} aria-labelledby="novo-video">
        <h2 id="novo-video" className={styles.newTitle}>
          Novo vídeo
        </h2>
        <p className={styles.newLead}>De onde vem o conteúdo?</p>
        <div className={styles.sources}>
          {ORIGENS.map(({ id, curto, icon: Icon }) => (
            <Link key={id} href={`/novo?origem=${id}`} className={styles.source}>
              <span className={styles.sourceIc}>
                <Icon size={20} strokeWidth={2} aria-hidden />
              </span>
              {curto}
            </Link>
          ))}
        </div>
      </section>

      {lista.length > 0 ? (
        <>
          <h2 className={styles.sectionTitle}>Continue de onde parou</h2>
          <div className={styles.list}>
            {lista.map((p) => (
              <ProjectRow key={p.id} project={p} move={{ currentFolderId: null, folders: listaPastas.map((f) => ({ id: f.id, name: f.name })) }} />
            ))}
          </div>
        </>
      ) : (
        <p className={styles.empty}>Seus vídeos soltos aparecem aqui. Escolha acima de onde vem o conteúdo do primeiro.</p>
      )}
    </main>
  );
}
