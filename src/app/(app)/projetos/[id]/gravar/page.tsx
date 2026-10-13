import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import styles from "@/components/script/script.module.css";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gravar · Gravaí" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Provisória: a gravação com teleprompter chega no Plano 2. */
export default async function GravarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createServerClient();
  const { data: project } = await supabase.from("projects").select("id").eq("id", id).maybeSingle();
  if (!project) notFound();

  return (
    <main className={styles.notice}>
      <h1>Gravação chega na próxima versão</h1>
      <p>Seu script está salvo. Quando a gravação estiver pronta, você continua daqui.</p>
      <div className={styles.noticeActions}>
        <Button href={`/projetos/${id}/script`} icon={ArrowLeft}>
          Voltar ao script
        </Button>
      </div>
    </main>
  );
}
