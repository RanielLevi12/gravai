import type { RecordDb } from "@/lib/record/db";
import { MAX_FILE_BYTES, MSG_FILE_TOO_BIG, MSG_STORAGE_FULL } from "@/lib/record/limits";
import { MSG_RECORDING_NOT_FOUND } from "@/lib/record/service";
import { r2Key, type R2, type R2Part } from "./r2";

/** Tamanho de cada parte do envio (o R2 pede mínimo de 5 MiB, menos na última). */
export const PART_SIZE = 8 * 1024 * 1024;
const MAX_PARTS = Math.ceil(MAX_FILE_BYTES / PART_SIZE) + 1;
const PART_URL_SECONDS = 3600;
const MAX_URLS_PER_CALL = 24;

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 413,
  ) {
    super(message);
  }
}

type Deps = { db: Pick<RecordDb, "uploadingRow" | "storageFits">; r2: R2 };

async function target(deps: Deps, recordingId: string) {
  const row = await deps.db.uploadingRow(recordingId);
  if (!row) throw new UploadError(MSG_RECORDING_NOT_FOUND, 404);
  return { key: r2Key("recordings", row.path), mime: row.mime };
}

/** Abre (ou retoma) o envio. Devolve as partes que o R2 já tem, para o navegador mandar só as que faltam. */
export async function startUploadWith(
  deps: Deps,
  input: { recordingId: string; size: number; uploadId?: string | null },
): Promise<{ uploadId: string; partSize: number; done: { PartNumber: number; ETag: string }[] }> {
  if (!Number.isInteger(input.size) || input.size <= 0) throw new UploadError("O vídeo ficou vazio. Grave de novo.", 400);
  if (input.size > MAX_FILE_BYTES) throw new UploadError(MSG_FILE_TOO_BIG, 413);
  const { key, mime } = await target(deps, input.recordingId);
  if (!(await deps.db.storageFits(input.size))) throw new UploadError(MSG_STORAGE_FULL, 413);

  if (input.uploadId) {
    const parts = await deps.r2.listParts(key, input.uploadId);
    if (parts) {
      const done = parts.filter((p) => p.Size === PART_SIZE || p.PartNumber === Math.ceil(input.size / PART_SIZE));
      return { uploadId: input.uploadId, partSize: PART_SIZE, done: done.map(({ PartNumber, ETag }) => ({ PartNumber, ETag })) };
    }
  }
  return { uploadId: await deps.r2.createMultipart(key, mime), partSize: PART_SIZE, done: [] };
}

/** Links para o navegador mandar cada parte direto ao R2. */
export async function partUrlsWith(
  deps: Deps,
  input: { recordingId: string; uploadId: string; partNumbers: number[] },
): Promise<{ PartNumber: number; url: string }[]> {
  const nums = input.partNumbers;
  if (!input.uploadId || nums.length === 0 || nums.length > MAX_URLS_PER_CALL) throw new UploadError("Pedido de envio inválido.", 400);
  if (!nums.every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_PARTS)) throw new UploadError("Pedido de envio inválido.", 400);
  const { key } = await target(deps, input.recordingId);
  return Promise.all(nums.map(async (n) => ({ PartNumber: n, url: await deps.r2.presignPart(key, input.uploadId, n, PART_URL_SECONDS) })));
}

/** Junta as partes no R2 e confere o tamanho real do arquivo. */
export async function completeUploadWith(
  deps: Deps,
  input: { recordingId: string; uploadId: string; parts: R2Part[] },
): Promise<{ sizeBytes: number }> {
  if (!input.uploadId || input.parts.length === 0 || input.parts.length > MAX_PARTS) throw new UploadError("Pedido de envio inválido.", 400);
  if (!input.parts.every((p) => Number.isInteger(p.PartNumber) && p.PartNumber >= 1 && typeof p.ETag === "string" && p.ETag)) {
    throw new UploadError("Pedido de envio inválido.", 400);
  }
  const { key } = await target(deps, input.recordingId);
  await deps.r2.completeMultipart(key, input.uploadId, input.parts);
  const size = await deps.r2.size(key);
  if (!size) throw new UploadError("O envio não chegou inteiro. Tente de novo.", 409);
  // O navegador não decide o tamanho: quem vale é o que o R2 recebeu.
  if (size > MAX_FILE_BYTES || !(await deps.db.storageFits(size))) {
    await deps.r2.deleteMany([key]).catch(() => {});
    throw new UploadError(size > MAX_FILE_BYTES ? MSG_FILE_TOO_BIG : MSG_STORAGE_FULL, 413);
  }
  return { sizeBytes: size };
}
