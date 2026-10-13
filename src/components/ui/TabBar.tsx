"use client";

import { LayoutGrid, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TabBar.module.css";

/** Abas do app (design/telas.html): Projetos, botão de novo vídeo e Perfil. Some no onboarding. */
export function TabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/boas-vindas")) return null;

  const ativo = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined);

  return (
    <nav className={styles.tabbar} aria-label="Navegação">
      <Link href="/projetos" className={styles.tab} aria-current={ativo("/projetos")}>
        <LayoutGrid size={22} strokeWidth={2} aria-hidden />
        Projetos
      </Link>
      <Link href="/novo" className={styles.tabNew} aria-label="Novo vídeo">
        <Plus size={28} strokeWidth={2} aria-hidden />
      </Link>
      <Link href="/perfil" className={styles.tab} aria-current={ativo("/perfil")}>
        <UserRound size={22} strokeWidth={2} aria-hidden />
        Perfil
      </Link>
    </nav>
  );
}
