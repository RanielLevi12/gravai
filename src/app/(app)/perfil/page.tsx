import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/lib/auth/actions";
import { isTone, TONE_LABELS } from "@/lib/profile/schema";
import { createServerClient } from "@/lib/supabase/server";
import { InstalarApp } from "./InstalarApp";
import styles from "./perfil.module.css";

export const metadata: Metadata = { title: "Perfil · Gravaí" };

/** Primeiro dia do mês corrente em America/Sao_Paulo, o mesmo critério de consume_usage. */
function mesAtual() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${partes.year}-${partes.month}-01`;
}

export default async function PerfilPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");
  const userId = auth.user.id;

  const [{ data: perfil }, { count }, { data: uso }] = await Promise.all([
    supabase.from("profiles").select("niche, audience, tone").eq("user_id", userId).maybeSingle(),
    supabase.from("ctas").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("usage_months").select("projects, transcription_seconds").eq("user_id", userId).eq("month", mesAtual()).maybeSingle(),
  ]);

  const tom = isTone(perfil?.tone) ? TONE_LABELS[perfil.tone] : "não escolhido";
  const sobre = [perfil?.niche, perfil?.audience].filter(Boolean);
  const minutos = Math.floor((uso?.transcription_seconds ?? 0) / 60);

  return (
    <main className={styles.page}>
      <h1 className="display">Perfil</h1>
      <p className={styles.email}>{auth.user.email}</p>

      <ul className={styles.list}>
        <li>
          <Link href="/boas-vindas/nicho" className={styles.row}>
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>Nicho e público</span>
              <span>{sobre.length > 0 ? sobre.join(" · ") : "Ainda não preenchido"}</span>
            </span>
            <ChevronRight size={20} strokeWidth={2} aria-hidden />
          </Link>
        </li>
        <li>
          <Link href="/boas-vindas/tom" className={styles.row}>
            <span className={styles.rowText}>Tom de voz: {tom}</span>
            <ChevronRight size={20} strokeWidth={2} aria-hidden />
          </Link>
        </li>
        <li>
          <Link href="/boas-vindas/cta" className={styles.row}>
            <span className={styles.rowText}>CTAs salvos ({count ?? 0})</span>
            <ChevronRight size={20} strokeWidth={2} aria-hidden />
          </Link>
        </li>
        <li className={styles.row}>
          <span className={`${styles.rowText} tnum`}>
            Uso do mês: {uso?.projects ?? 0}/5 projetos · {minutos}/60 min
          </span>
        </li>
        <li>
          <InstalarApp />
        </li>
      </ul>

      <form action={signOut} className={styles.sair}>
        <Button type="submit" variant="soft">
          Sair
        </Button>
      </form>
    </main>
  );
}
