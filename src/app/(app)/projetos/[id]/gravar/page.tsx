import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModeCards } from "@/components/record/ModeCards";
import styles from "@/components/record/record.module.css";
import scriptStyles from "@/components/script/script.module.css";
import { Button } from "@/components/ui/Button";
import { allowedModes } from "@/lib/record/rules";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gravar · Gravaí" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GravarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, interview, script_stale")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const mainSeconds = (project.interview as { mainSeconds?: number } | null)?.mainSeconds ?? 60;
  const { data: ready } = await supabase
    .from("recordings")
    .select("id")
    .eq("project_id", id)
    .eq("status", "ready")
    .limit(1);
  const hasRecordings = (ready?.length ?? 0) > 0;

  return (
    <main className={styles.page}>
      <nav className={scriptStyles.nav}>
        <Button href={`/projetos/${id}/script`} variant="soft" icon={ArrowLeft}>
          Voltar
        </Button>
      </nav>
      {project.script_stale ? (
        <p className={styles.alert} role="status">
          O script mudou depois da última gravação. Grave de novo os blocos que mudaram.
        </p>
      ) : null}
      {hasRecordings ? (
        <Button href={`/projetos/${id}/gravar/aprovar`} variant="soft">
          Continuar de onde parei
        </Button>
      ) : null}
      <ModeCards projectId={id} modes={allowedModes(mainSeconds)} />
    </main>
  );
}
