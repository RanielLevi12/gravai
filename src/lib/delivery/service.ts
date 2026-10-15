import { MSG_PROJECT_NOT_FOUND } from "@/lib/record/service";
import type { Descriptions } from "@/lib/script/generate";
import { exportFileName, type ExportKind, type JobStatus } from "./rules";

export { MSG_PROJECT_NOT_FOUND };
export const MSG_ALREADY_RUNNING = "Já estamos gerando seus vídeos.";
export const MSG_FILE_NOT_FOUND = "Arquivo não encontrado.";
export const MSG_BAD_RANGE = "Início e fim do corte não são válidos.";
export const MSG_CUT_NOT_FOUND = "Corte não encontrado.";
export const MSG_NOT_GENERATED = "Gere os vídeos antes de ajustar um corte.";
export const MIN_CUT_SECONDS = 1;
export const MAX_CUT_SECONDS = 180;
export const MSG_NOT_RECORDED = "Aprove a gravação antes de gerar os vídeos.";

export type JobView = { id: string; kind: "render" | "recut"; status: JobStatus; step: string | null; progress: number; error: string | null };

export type ExportRow = {
  id: string;
  kind: ExportKind;
  cutId: string | null;
  storagePath: string;
  mime: string;
  durationSeconds: number | null;
  sizeBytes: number;
  /** ISO 8601. */
  expiresAt: string;
  /** Só nos cortes: onde o corte começa e termina no vídeo final (segundos). */
  startSeconds?: number | null;
  endSeconds?: number | null;
};

export type CutInfo = { id: string; title: string; start: number; end: number; descriptions: Descriptions };

/** Validade dos links de download e de visualização. */
export const SIGNED_URL_SECONDS = 300;

export interface DeliveryDb {
  project(id: string): Promise<{ id: string; status: string; scriptStale: boolean } | null>;
  /** Pedido mais recente do projeto (qualquer estado). */
  latestJob(projectId: string): Promise<JobView | null>;
  /** Cria o pedido; lança MSG_ALREADY_RUNNING se já houver um ativo (índice único no banco). */
  createJob(projectId: string, kind: "render" | "recut", payload: object): Promise<string>;
  /** Arquivos gerados que o usuário pode ver (a RLS limita ao dono). */
  exportsOf(projectId: string): Promise<ExportRow[]>;
  /** Cortes do projeto, por ordem de início. */
  cuts(projectId: string): Promise<CutInfo[]>;
  /** Link temporário; com `downloadName` o navegador baixa o arquivo com esse nome. */
  signUrl(storagePath: string, seconds: number, downloadName: string | null): Promise<string>;
  /** Conteúdo do arquivo (para montar o .zip). */
  download(storagePath: string): Promise<Uint8Array>;
}

export async function createRenderJobWith(db: DeliveryDb, projectId: string): Promise<{ jobId: string }> {
  const project = await db.project(projectId);
  if (!project) throw new Error(MSG_PROJECT_NOT_FOUND);
  if (project.status !== "gravado" && project.status !== "pronto") throw new Error(MSG_NOT_RECORDED);
  return { jobId: await db.createJob(projectId, "render", {}) };
}

/** Link para baixar (ou, com `download: false`, para assistir) um arquivo do projeto. */
export async function signedUrlWith(
  db: DeliveryDb,
  projectId: string,
  exportId: string,
  opts: { download?: boolean } = {},
): Promise<{ url: string }> {
  const [rows, cuts] = await Promise.all([db.exportsOf(projectId), db.cuts(projectId)]);
  const row = rows.find((r) => r.id === exportId);
  if (!row) throw new Error(MSG_FILE_NOT_FOUND);
  const ext = row.mime === "image/jpeg" ? "jpg" : "mp4";
  const index = row.cutId === null ? null : cuts.findIndex((c) => c.id === row.cutId) + 1;
  const name = (opts.download ?? true) ? exportFileName(row.kind, index, ext) : null;
  return { url: await db.signUrl(row.storagePath, SIGNED_URL_SECONDS, name) };
}

const onTenths = (n: number) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6;

/** Refaz um corte com início e fim (em segundos do vídeo final) escolhidos à mão. */
export async function recutWith(db: DeliveryDb, projectId: string, cutId: string, start: number, end: number): Promise<{ jobId: string }> {
  const project = await db.project(projectId);
  if (!project) throw new Error(MSG_PROJECT_NOT_FOUND);
  if (project.status !== "gravado" && project.status !== "pronto") throw new Error(MSG_NOT_RECORDED);
  const [rows, cuts] = await Promise.all([db.exportsOf(projectId), db.cuts(projectId)]);
  if (!cuts.some((c) => c.id === cutId)) throw new Error(MSG_CUT_NOT_FOUND);
  const duration = rows.find((r) => r.kind === "final")?.durationSeconds;
  if (!duration) throw new Error(MSG_NOT_GENERATED);
  const ok =
    Number.isFinite(start) && Number.isFinite(end) && onTenths(start) && onTenths(end) &&
    start >= 0 && start < end && end <= duration + 1e-6 &&
    end - start >= MIN_CUT_SECONDS - 1e-6 && end - start <= MAX_CUT_SECONDS + 1e-6;
  if (!ok) throw new Error(MSG_BAD_RANGE);
  return { jobId: await db.createJob(projectId, "recut", { cutId, start, end }) };
}
