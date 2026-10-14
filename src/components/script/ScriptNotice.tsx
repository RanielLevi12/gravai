import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import buttonStyles from "@/components/ui/Button.module.css";
import { Button } from "@/components/ui/Button";
import styles from "./script.module.css";

/** Tela cheia para quando o script não pôde ser gerado: sem IA conectada ou com erro. */
export function ScriptNotice({
  title,
  children,
  backHref,
  connect = false,
}: {
  title: string;
  children: ReactNode;
  backHref: string;
  connect?: boolean;
}) {
  return (
    <main className={styles.notice}>
      <h1>{title}</h1>
      <p>{children}</p>
      <div className={styles.noticeActions}>
        {connect ? (
          // Rota do servidor (OAuth): navegação completa, sem o roteador do cliente.
          <a href="/api/ai/connect" className={`${buttonStyles.button} ${buttonStyles.primary}`}>
            <Sparkles size={20} strokeWidth={2} aria-hidden />
            Conectar sua IA
          </a>
        ) : (
          // Recarrega a página do script: tenta gerar de novo.
          <a href="" className={`${buttonStyles.button} ${buttonStyles.primary}`}>
            Tentar de novo
          </a>
        )}
        <Button href={backHref} variant="soft">
          Voltar
        </Button>
      </div>
    </main>
  );
}
