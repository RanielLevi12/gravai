import { createWriteStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import type { Db } from "./claim";

/** Baixa um arquivo do Storage direto para o disco, aos poucos (gravações de até 500 MB não cabem na memória). */
export async function download(db: Db, bucket: string, storagePath: string, dest: string): Promise<void> {
  const fail = (why: string) => new Error(`download ${bucket}/${storagePath}: ${why}`);
  const { data, error } = await db.storage.from(bucket).createSignedUrl(storagePath, 600);
  if (error || !data) throw fail(error?.message ?? "sem link");
  const res = await fetch(data.signedUrl);
  if (!res.ok || !res.body) throw fail(`HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as ReadableStream), createWriteStream(dest));
}

/** Sobe `file` para o bucket `exports` (substitui se já existir). */
export async function upload(db: Db, storagePath: string, file: string, mime: string): Promise<{ sizeBytes: number }> {
  const { size } = await stat(file);
  const { error } = await db.storage.from("exports").upload(storagePath, await readFile(file), { contentType: mime, upsert: true });
  if (error) throw new Error(`upload exports/${storagePath}: ${error.message}`);
  return { sizeBytes: size };
}
