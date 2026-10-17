import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { Db } from "./claim";
import { r2 } from "./storage";

const PREFIX = "exports/";
/** Arquivo novo pode estar sendo registrado agora: só mexe no que tem mais de um dia. */
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Os vídeos NÃO vencem mais: ficam até o usuário apagar. Esta limpeza só apaga arquivos órfãos em
 * "exports/" (sobras de um envio que falhou ou de um vídeo refeito), isto é, sem nenhuma linha em `exports`.
 * Devolve quantos apagou.
 */
export async function sweepOrphans(db: Db, now = new Date()): Promise<number> {
  const { client, bucket } = r2();
  const old: string[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX, ContinuationToken: token }));
    for (const o of res.Contents ?? []) if (o.Key && o.LastModified && now.getTime() - o.LastModified.getTime() > MIN_AGE_MS) old.push(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  if (old.length === 0) return 0;

  const { data, error } = await db.from("exports").select("storage_path");
  if (error) throw new Error(`ler exports: ${error.message}`);
  const known = new Set((data ?? []).map((r: { storage_path: string }) => `${PREFIX}${r.storage_path}`));
  const orphans = old.filter((k) => !known.has(k));
  for (let i = 0; i < orphans.length; i += 1000) {
    const res = await client.send(
      new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: orphans.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }),
    );
    if (res.Errors?.length) console.error(`[worker] não consegui apagar ${res.Errors.length} arquivo(s) órfão(s)`);
  }
  return orphans.length;
}
