import { ArrowLeft, Sparkles, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import buttonStyles from "@/components/ui/Button.module.css";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { QUESTION_COUNT } from "@/lib/interview/steps";
import styles from "./entrevista.module.css";

/** Moldura de cada tela da entrevista: voltar, progresso 8 segmentos, sair; conteúdo; ação fixa embaixo. */
export function InterviewFrame({
  number,
  backHref,
  noAi = false,
  footer,
  children,
}: {
  number: number;
  backHref: string;
  noAi?: boolean;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Entrevista">
        <Link href={backHref} className={styles.iconBtn} aria-label="Voltar">
          <ArrowLeft size={22} strokeWidth={2} aria-hidden />
        </Link>
        <ProgressSteps current={number} total={QUESTION_COUNT} />
        <Link href="/projetos" className={styles.iconBtn} aria-label="Sair e salvar">
          <X size={22} strokeWidth={2} aria-hidden />
        </Link>
      </nav>
      <div className={styles.body}>
        {noAi ? (
          <div className={styles.noAi} role="note">
            <p>
              <Sparkles size={18} strokeWidth={2} aria-hidden />
              Conecte sua IA para receber sugestões prontas em cada pergunta.
            </p>
            {/* Rota do servidor (OAuth): navegação completa, sem o roteador do cliente. */}
            <a href="/api/ai/connect" className={`${buttonStyles.button} ${buttonStyles.soft} ${styles.connect}`}>
              Conectar sua IA
            </a>
          </div>
        ) : null}
        {children}
      </div>
      <div className={styles.bottom}>{footer}</div>
    </main>
  );
}
