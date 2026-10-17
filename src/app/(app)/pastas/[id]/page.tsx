import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectRow } from "@/components/project/ProjectRow";
import { Button } from "@/components/ui/Button";
import { loadCtas, toSettings } from "@/lib/folders/queries";
import { COLOR_VAR, isFolderColor, summarizeSettings } from "@/lib/folders/schema";
import { createServerClient } from "@/lib/supabase/server";
import styles from "../pastas.module.css";

export const metadata: Metadata = { title: "Projeto · Gravaí" };

export default async function PastaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  const { data: pasta } = await supabase.from("folders").select("id, name, color, about, settings").eq("id", id).eq("user_id", auth.user.id).is("deleted_at", null).maybeSingle();
  if (!pasta) notFound();

  const [{ data: videos }, ctas, { data: todas }] = await Promise.all([
    supabase.from("projects").select("id, title, status, source_kind, interview").eq("user_id", auth.user.id).eq("folder_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    loadCtas(supabase, auth.user.id),
    supabase.from("folders").select("id, name").eq("user_id", auth.user.id).is("deleted_at", null).order("created_at", { ascending: false }),
  ]);
  const settings = toSettings(pasta.settings);
  const ctaLabel = ctas.find((c) => c.id === settings.ctaId)?.label;
  const lista = videos ?? [];

  return (
    <main className={styles.page}>
      <Link href="/projetos" className={styles.back}>
        ← Seus vídeos
      </Link>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.dot} style={{ background: COLOR_VAR[isFolderColor(pasta.color) ? pasta.color : "rosa"] }} aria-hidden />
          <h1 className="display">{pasta.name}</h1>
        </div>
        <p className={styles.meta}>{summarizeSettings(settings, ctaLabel)}</p>
        {pasta.about ? <p className={styles.about}>{pasta.about}</p> : null}
        <div className={styles.headActions}>
          <Button href={`/novo?projeto=${pasta.id}`}>Novo vídeo neste projeto</Button>
          <Button href={`/pastas/${pasta.id}/editar`} variant="soft">
            Editar projeto
          </Button>
        </div>
      </header>

      {lista.length > 0 ? (
        <>
          <h2 className={styles.sectionTitle}>Vídeos deste projeto</h2>
          <div className={styles.list}>
            {lista.map((p) => (
              <ProjectRow key={p.id} project={p} move={{ currentFolderId: id, folders: todas ?? [] }} />
            ))}
          </div>
        </>
      ) : (
        <p className={styles.empty}>Este projeto ainda não tem vídeos.</p>
      )}
    </main>
  );
}
