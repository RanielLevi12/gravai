import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import buttonStyles from "@/components/ui/Button.module.css";
import { signOut } from "@/lib/auth/actions";
import { isTone, TONE_LABELS } from "@/lib/profile/schema";
import { STORAGE_LIMIT_BYTES } from "@/lib/record/limits";
import { quotaText } from "@/lib/storage/format";
import { createServerClient } from "@/lib/supabase/server";
import { InstalarApp } from "./InstalarApp";
import { ColarChave } from "./ColarChave";
import styles from "./perfil.module.css";

export const metadata: Metadata = { title: "Perfil · Gravaí" };

/** Primeiro dia do mês corrente em America/Sao_Paulo, o mesmo critério de consume_usage. */
function mesAtual() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${partes.year}-${partes.month}-01`;
}

const AVISO_IA: Record<string, { texto: string; erro: boolean }> = {
  conectada: { texto: "Pronto, sua IA está conectada.", erro: false },
  erro: { texto: "Não deu para conectar sua IA. Tente de novo.", erro: true },
  // "Gravai" é o key_label enviado em /api/ai/connect: é o nome da chave no OpenRouter.
  desconectada: {
    texto: "IA desconectada. Para apagar a chave de vez, abra OpenRouter › Keys e remova a chave Gravai.",
    erro: false,
  },
};

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ ia?: string }> }) {
  const { ia } = await searchParams;
  const aviso = ia ? AVISO_IA[ia] : undefined;
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");
  const userId = auth.user.id;

  const [{ data: perfil }, { count }, { data: uso }, { data: conexao }, { data: espaco }] = await Promise.all([
    supabase.from("profiles").select("niche, audience, tone").eq("user_id", userId).maybeSingle(),
    supabase.from("ctas").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("usage_months").select("projects, transcription_seconds").eq("user_id", userId).eq("month", mesAtual()).maybeSingle(),
    // key_ciphertext nunca é lido aqui (a coluna nem é visível para o usuário)
    supabase.from("ai_connections").select("key_hint").eq("user_id", userId).maybeSingle(),
    supabase.from("storage_quota").select("used_bytes, limit_bytes").eq("user_id", userId).maybeSingle(),
  ]);

  const tom = isTone(perfil?.tone) ? TONE_LABELS[perfil.tone] : "não escolhido";
  const sobre = [perfil?.niche, perfil?.audience].filter(Boolean);
  const minutos = Math.floor((uso?.transcription_seconds ?? 0) / 60);

  return (
    <main className={styles.page}>
      <h1 className="display">Perfil</h1>
      <p className={styles.email}>{auth.user.email}</p>

      <section className={styles.secao} aria-labelledby="sua-ia">
        <h2 id="sua-ia" className={styles.secaoTitulo}>
          Sua IA
        </h2>
        {aviso ? (
          <p className={aviso.erro ? styles.avisoErro : styles.aviso} role={aviso.erro ? "alert" : "status"}>
            {aviso.texto}
          </p>
        ) : null}
        {conexao ? (
          <>
            <p className={styles.row}>
              <span className={`${styles.rowText} tnum`}>OpenRouter conectado · termina em ••••{conexao.key_hint}</span>
            </p>
            <form method="post" action="/api/ai/disconnect">
              <Button type="submit" variant="soft" className={styles.acaoIa}>
                Desconectar
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className={styles.textoIa}>O Gravaí usa a sua conta de IA. Você paga só o que usar, direto no OpenRouter.</p>
            {/* <a> simples: a rota redireciona para o OpenRouter, não é navegação do app */}
            <a href="/api/ai/connect" className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.acaoIa}`}>
              Conectar sua IA
            </a>
            <ColarChave />
          </>
        )}
      </section>

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
        <li className={styles.row}>
          <span className={`${styles.rowText} tnum`}>Espaço dos vídeos: {quotaText(espaco?.used_bytes ?? 0, espaco?.limit_bytes ?? STORAGE_LIMIT_BYTES)}</span>
        </li>
        <li>
          <Link href="/lixeira" className={styles.row}>
            <span className={styles.rowText}>Lixeira</span>
            <ChevronRight size={20} strokeWidth={2} aria-hidden />
          </Link>
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
