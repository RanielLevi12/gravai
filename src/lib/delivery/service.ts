import { MSG_PROJECT_NOT_FOUND } from "@/lib/record/service";
import type { JobStatus } from "./rules";

export { MSG_PROJECT_NOT_FOUND };
export const MSG_ALREADY_RUNNING = "Já estamos gerando seus vídeos.";
export const MSG_NOT_RECORDED = "Aprove a gravação antes de gerar os vídeos.";

export type JobView = { id: string; status: JobStatus; step: string | null; progress: number; error: string | null };

export interface DeliveryDb {
  project(id: string): Promise<{ id: string; status: string; scriptStale: boolean } | null>;
  /** Pedido mais recente do projeto (qualquer estado). */
  latestJob(projectId: string): Promise<JobView | null>;
  /** Cria o pedido; lança MSG_ALREADY_RUNNING se já houver um ativo (índice único no banco). */
  createJob(projectId: string, kind: "render" | "recut", payload: object): Promise<string>;
}

export async function createRenderJobWith(db: DeliveryDb, projectId: string): Promise<{ jobId: string }> {
  const project = await db.project(projectId);
  if (!project) throw new Error(MSG_PROJECT_NOT_FOUND);
  if (project.status !== "gravado" && project.status !== "pronto") throw new Error(MSG_NOT_RECORDED);
  return { jobId: await db.createJob(projectId, "render", {}) };
}
