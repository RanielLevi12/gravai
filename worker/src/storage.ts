import { readFile, writeFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import type { Db } from "./claim";

/** Baixa um arquivo do Storage para `dest`. */
export async function download(db: Db, bucket: string, storagePath: string, dest: string): Promise<void> {
  const { data, error } = await db.storage.from(bucket).download(storagePath);
  if (error || !data) throw new Error(`download ${bucket}/${storagePath}: ${error?.message ?? "vazio"}`);
  await writeFile(dest, Buffer.from(await data.arrayBuffer()));
}

/** Sobe `file` para o bucket `exports` (substitui se já existir). */
export async function upload(db: Db, storagePath: string, file: string, mime: string): Promise<{ sizeBytes: number }> {
  const { size } = await stat(file);
  const { error } = await db.storage.from("exports").upload(storagePath, await readFile(file), { contentType: mime, upsert: true });
  if (error) throw new Error(`upload exports/${storagePath}: ${error.message}`);
  return { sizeBytes: size };
}
