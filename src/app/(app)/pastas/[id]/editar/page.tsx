import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FolderForm } from "@/components/folders/FolderForm";
import { loadCtas, toFormValues } from "@/lib/folders/queries";
import { createServerClient } from "@/lib/supabase/server";
import styles from "../../pastas.module.css";

export const metadata: Metadata = { title: "Editar projeto · Gravaí" };

export default async function EditarPastaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  const { data: pasta } = await supabase.from("folders").select("id, name, color, about, settings").eq("id", id).eq("user_id", auth.user.id).is("deleted_at", null).maybeSingle();
  if (!pasta) notFound();
  const ctas = await loadCtas(supabase, auth.user.id);

  return (
    <main className={styles.page}>
      <Link href={`/pastas/${pasta.id}`} className={styles.back}>
        ← Voltar
      </Link>
      <header className={styles.head}>
        <h1 className="display">Editar projeto</h1>
      </header>
      <FolderForm folderId={pasta.id} initial={toFormValues(pasta)} ctas={ctas} />
    </main>
  );
}
