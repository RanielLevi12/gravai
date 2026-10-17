import type { Crop } from "./capture";
import type { RecordDb } from "./db";
import { MAX_FILE_BYTES, MSG_FILE_TOO_BIG, MSG_STORAGE_FULL, fitsBucket } from "./limits";
import { allowedModes, canApprove, type RecordMode } from "./rules";

export const MSG_PROJECT_NOT_FOUND = "Projeto não encontrado.";
export const MSG_BLOCK_NOT_FOUND = "Bloco não encontrado.";
export const MSG_RECORDING_NOT_FOUND = "Gravação não encontrada.";
const MSG_ONLY_BLOCKS = "Para um vídeo de 5 min, grave por blocos.";
const MSG_NO_BLOCKS = "O script não tem blocos para gravar.";
export const MSG_ALREADY_SENT = "Esta gravação já foi enviada.";
export const MSG_EMPTY_VIDEO = "O vídeo ficou vazio. Grave de novo.";
export const MSG_FINISH_SCRIPT = "Termine o script antes de aprovar.";
const MSG_BAD_VIDEO = "Formato de vídeo não aceito.";

export type StartInput = { projectId: string; kind: "take" | "block" | "external"; blockId: string | null; mime: string; crop?: Crop | null };

export async function startRecordingWith(db: RecordDb, input: StartInput): Promise<{ id: string; path: string }> {
  const base = input.mime.split(";")[0].trim().toLowerCase();
  if (base !== "video/mp4" && base !== "video/webm") throw new Error(MSG_BAD_VIDEO);

  const project = await db.project(input.projectId);
  if (!project) throw new Error(MSG_PROJECT_NOT_FOUND);

  if (input.kind === "take" && (project.interview?.mainSeconds ?? 0) > 180) throw new Error(MSG_ONLY_BLOCKS);

  let blockId: string | null = null;
  if (input.kind === "block") {
    if (!input.blockId || !(await db.blockIds(input.projectId)).includes(input.blockId)) throw new Error(MSG_BLOCK_NOT_FOUND);
    blockId = input.blockId;
  }

  return db.insertUploading({ projectId: input.projectId, kind: input.kind, blockId, mime: input.mime, crop: input.crop ?? null });
}

export async function finishRecordingWith(
  db: RecordDb,
  id: string,
  v: { sizeBytes: number; durationSeconds: number | null },
): Promise<void> {
  if (!Number.isFinite(v.sizeBytes) || v.sizeBytes < 0) throw new Error(MSG_RECORDING_NOT_FOUND);
  if (v.sizeBytes <= 0) throw new Error(MSG_EMPTY_VIDEO);
  if (!fitsBucket(v.sizeBytes) || v.sizeBytes > MAX_FILE_BYTES) throw new Error(MSG_FILE_TOO_BIG);
  if (!(await db.storageFits(v.sizeBytes))) throw new Error(MSG_STORAGE_FULL);
  const res = await db.markReady(id, v);
  if (!res) throw new Error(MSG_RECORDING_NOT_FOUND);
  if (res.replacedPaths.length > 0) {
    try {
      await db.removeFiles(res.replacedPaths);
    } catch (e) {
      // A gravação nova já valeu; arquivo velho que sobrar não atrapalha o usuário.
      console.error("[record] não apagou arquivo antigo", e instanceof Error ? e.message : e);
    }
  }
}

export async function discardRecordingWith(db: RecordDb, id: string): Promise<void> {
  const res = await db.deleteRow(id);
  if (res === "ready") throw new Error(MSG_ALREADY_SENT);
  if (!res) return;
  try {
    await db.removeFiles([res.path]);
  } catch (e) {
    console.error("[record] não apagou arquivo descartado", e instanceof Error ? e.message : e);
  }
}

export async function approveWith(db: RecordDb, projectId: string, mode: RecordMode): Promise<{ ok: true } | { ok: false; error: string }> {
  const project = await db.project(projectId);
  if (!project) return { ok: false, error: MSG_PROJECT_NOT_FOUND };
  if (project.status === "gravado" || project.status === "pronto") return { ok: true };
  if (project.status !== "script" && project.status !== "gravacao") return { ok: false, error: MSG_FINISH_SCRIPT };
  if (!allowedModes(project.interview?.mainSeconds ?? 0).includes(mode)) return { ok: false, error: MSG_ONLY_BLOCKS };

  const [ready, blockIds] = await Promise.all([db.readyRows(projectId), db.blockIds(projectId)]);
  if (mode === "blocks" && blockIds.length === 0) return { ok: false, error: MSG_NO_BLOCKS };

  const check = canApprove({ mode, ready: ready.map((r) => ({ kind: r.kind, blockId: r.blockId })), blockIds });
  if (!check.ok) return check;

  if (!(await db.setProjectStatus(projectId, "gravado"))) return { ok: false, error: MSG_PROJECT_NOT_FOUND };
  return { ok: true };
}
