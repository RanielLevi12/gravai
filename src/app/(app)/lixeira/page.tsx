import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrashList } from "@/components/trash/TrashList";
import styles from "@/components/trash/trash.module.css";
import { createServerClient } from "@/lib/supabase/server";
import { loadTrash } from "@/lib/trash/queries";
import { TRASH_DAYS } from "@/lib/trash/rules";

export const metadata: Metadata = { title: "Lixeira · Gravaí" };

export default async function LixeiraPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");
  const items = await loadTrash(supabase, auth.user.id);

  return (
    <main className={styles.page}>
      <Link href="/projetos" className={styles.back}>
        ← Seus vídeos
      </Link>
      <h1 className="display">Lixeira</h1>
      <p className={styles.lead}>O que você apaga fica aqui por {TRASH_DAYS} dias. Depois é apagado de vez, com os arquivos.</p>
      <TrashList items={items} />
    </main>
  );
}
