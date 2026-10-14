import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderForm } from "@/components/folders/FolderForm";
import { loadCtas } from "@/lib/folders/queries";
import { createServerClient } from "@/lib/supabase/server";
import styles from "../pastas.module.css";

export const metadata: Metadata = { title: "Novo projeto · Gravaí" };

export default async function NovaPastaPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");
  const ctas = await loadCtas(supabase, auth.user.id);

  return (
    <main className={styles.page}>
      <Link href="/projetos" className={styles.back}>
        ← Voltar
      </Link>
      <header className={styles.head}>
        <h1 className="display">Novo projeto</h1>
        <p className={styles.meta}>Um projeto reúne vídeos que seguem as mesmas escolhas, como um devocional ou uma série de dicas.</p>
      </header>
      <FolderForm ctas={ctas} />
    </main>
  );
}
