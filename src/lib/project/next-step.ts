import { firstMissing, type Interview } from "@/lib/interview/steps";

export type ProjectStep = { id: string; status: string; interview: unknown };

const isObj = (v: unknown): v is object => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Passo salvo pela entrevista (Tarefa 8); só aceita um slug simples. Sem passo salvo, a primeira pergunta
 * sem resposta: vídeo de projeto já nasce com as respostas copiadas e cai direto no título.
 */
function interviewStep(interview: unknown): string {
  const current = interview && typeof interview === "object" ? (interview as { current?: unknown }).current : undefined;
  return typeof current === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(current) ? current : firstMissing(isObj(interview) ? (interview as Interview) : {});
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
    case "gravado":
      return `${base}/gravar`;
    default:
      return base;
  }
}
