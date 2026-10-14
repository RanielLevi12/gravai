import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import styles from "@/components/record/record.module.css";
import scriptStyles from "@/components/script/script.module.css";
import { Button } from "@/components/ui/Button";
import { supabaseDeliveryDb } from "@/lib/delivery/db";
import { createServerClient } from "@/lib/supabase/server";
import { JobPanel } from "./JobProgress";

export const metadata: Metadata = { title: "Entrega · Gravaí" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EntregaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createServerClient();
  const db = supabaseDeliveryDb({ supabase });
  const project = await db.project(id);
  if (!project) notFound();
  if (project.status !== "gravado" && project.status !== "pronto") redirect(`/projetos/${id}/gravar`);

  const job = await db.latestJob(id);
  const done = job?.status === "done";

  return (
    <main className={styles.page}>
      <nav className={scriptStyles.nav}>
        <Button href={`/projetos/${id}/gravar/aprovar`} variant="soft" icon={ArrowLeft}>
          Voltar
        </Button>
      </nav>
      <h1 className={styles.title}>{done ? "Seus vídeos estão prontos." : "Gerar vídeos"}</h1>
      <p className={styles.hint}>
        {done
          ? "Em breve você poderá baixar o vídeo final e os cortes aqui."
          : "Montamos o vídeo final e um vídeo para cada corte. Leva alguns minutos."}
      </p>
      {done ? null : <JobPanel projectId={id} initial={job} />}
    </main>
  );
}
