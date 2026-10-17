import { Button } from "@/components/ui/Button";
import { joinNames, type LabeledBlock } from "@/lib/record/missing";
import styles from "./record.module.css";

const gravarHref = (projectId: string, blockId: string) => `/projetos/${projectId}/gravar/teleprompter?modo=blocos&bloco=${blockId}`;

/** Acabou de usar um bloco e ainda falta algum: leva direto para o próximo. */
export function NextBlockCard({ projectId, next }: { projectId: string; next: LabeledBlock }) {
  return (
    <section className={styles.missing} aria-label="Próxima parte">
      <h2 className={styles.missingTitle}>Gravar a próxima: {next.label}</h2>
      <Button href={gravarHref(projectId, next.id)}>Gravar {next.label}</Button>
      <Button variant="soft" href="#partes">
        Ver todas as partes
      </Button>
    </section>
  );
}

/** Aviso grande no topo da aprovação: quais partes faltam, cada uma com seu botão. */
export function MissingAlert({ projectId, missing }: { projectId: string; missing: LabeledBlock[] }) {
  if (missing.length === 0) return null;
  return (
    <section className={styles.missing} role="alert" aria-label="Partes que faltam">
      <h2 className={styles.missingTitle}>
        {missing.length === 1 ? "Falta gravar 1 parte" : `Faltam gravar ${missing.length} partes`}: {joinNames(missing.map((m) => m.label))}
      </h2>
      <ul className={styles.missingList}>
        {missing.map((m) => (
          <li key={m.id} className={styles.missingItem}>
            <span>{m.label}</span>
            <Button variant="soft" href={gravarHref(projectId, m.id)}>
              Gravar agora
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
