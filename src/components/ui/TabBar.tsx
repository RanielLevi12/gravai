"use client";

import { LayoutGrid, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./TabBar.module.css";

/** Telas de topo: as únicas com abas. Fluxos de criação ficam em tela cheia com "← Voltar" (UX-FLOWS). */
function telaDeTopo(pathname: string, origem: string | null): boolean {
  if (pathname === "/novo") return origem === null;
  return pathname === "/projetos" || pathname === "/perfil";
}

/** Abas do app (design/telas.html): Projetos, botão de novo vídeo e Perfil. */
export function TabBar() {
  const pathname = usePathname();
  const origem = useSearchParams().get("origem");
  if (!telaDeTopo(pathname, origem)) return null;

  const ativo = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined);

  return (
    <nav className={styles.tabbar} aria-label="Navegação">
      <Link href="/projetos" className={styles.tab} aria-current={ativo("/projetos")}>
        <LayoutGrid size={22} strokeWidth={2} aria-hidden />
        Projetos
      </Link>
      <Link href="/novo" className={styles.tabNew} aria-label="Novo vídeo" aria-current={ativo("/novo")}>
        <Plus size={28} strokeWidth={2} aria-hidden />
      </Link>
      <Link href="/perfil" className={styles.tab} aria-current={ativo("/perfil")}>
        <UserRound size={22} strokeWidth={2} aria-hidden />
        Perfil
      </Link>
    </nav>
  );
}
