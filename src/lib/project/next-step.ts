export type ProjectStep = { id: string; status: string; interview: unknown };

/** Passo salvo pela entrevista (Tarefa 8); só aceita um slug simples. */
function interviewStep(interview: unknown): string {
  const current = interview && typeof interview === "object" ? (interview as { current?: unknown }).current : undefined;
  return typeof current === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(current) ? current : "plataformas";
}

/** Rota da etapa em que o projeto parou. */
export function nextStepHref(project: ProjectStep): string {
  const base = `/projetos/${project.id}`;
  switch (project.status) {
    case "fonte":
      return `${base}/fonte`;
    case "entrevista":
      return `${base}/entrevista/${interviewStep(project.interview)}`;
    case "script":
      return `${base}/script`;
    case "gravacao":
      return `${base}/gravar`;
    default:
      return base;
  }
}
