import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { Db } from "./claim";
import { r2, r2Key } from "./storage";

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

/** Dias na lixeira antes de apagar de vez (igual a TRASH_DAYS em src/lib/trash/rules.ts). */
export const TRASH_DAYS = 7;
/** Quantos itens por rodada: a limpeza roda de hora em hora, o resto fica para a próxima. */
const TRASH_BATCH = 50;

type Del = (keys: string[]) => Promise<void>;

async function deleteFromR2(keys: string[]): Promise<void> {
  const { client, bucket } = r2();
  for (let i = 0; i < keys.length; i += 1000) {
    const res = await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
    if (res.Errors?.length) throw new Error(`r2: não apagou ${res.Errors.length} arquivo(s)`);
  }
}

/** Apaga um vídeo: primeiro os arquivos no R2, depois a linha (os gatilhos do banco devolvem o espaço à cota). */
async function purgeVideo(db: Db, id: string, del: Del): Promise<void> {
  const [rec, exp] = await Promise.all([
    db.from("recordings").select("storage_path").eq("project_id", id),
    db.from("exports").select("storage_path").eq("project_id", id),
  ]);
  if (rec.error || exp.error) throw new Error("ler arquivos do vídeo");
  await del([
    ...(rec.data ?? []).map((r: { storage_path: string }) => r2Key("recordings", r.storage_path)),
    ...(exp.data ?? []).map((r: { storage_path: string }) => r2Key("exports", r.storage_path)),
  ]);
  const { error } = await db.from("projects").delete().eq("id", id);
  if (error) throw new Error(`apagar vídeo: ${error.message}`);
}

/**
 * Lixeira: apaga de vez o que está lá há mais de 7 dias (vídeos primeiro, depois os projetos).
 * Falha num item não para os outros: ele fica na lixeira e é tentado de novo na próxima hora.
 * Devolve quantos vídeos e projetos apagou.
 */
export async function purgeTrash(db: Db, now = new Date(), del: Del = deleteFromR2): Promise<{ videos: number; folders: number }> {
  const cutoff = new Date(now.getTime() - TRASH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const out = { videos: 0, folders: 0 };

  const vids = await db.from("projects").select("id").not("deleted_at", "is", null).lt("deleted_at", cutoff).limit(TRASH_BATCH);
  if (vids.error) throw new Error(`ler lixeira: ${vids.error.message}`);
  for (const v of vids.data ?? []) {
    try {
      await purgeVideo(db, v.id, del);
      out.videos++;
    } catch (e) {
      console.error(`[worker] lixeira: vídeo ${v.id} não apagou:`, e instanceof Error ? e.message : e);
    }
  }

  const folders = await db.from("folders").select("id").not("deleted_at", "is", null).lt("deleted_at", cutoff).limit(TRASH_BATCH);
  if (folders.error) throw new Error(`ler lixeira: ${folders.error.message}`);
  for (const f of folders.data ?? []) {
    // Só apaga a pasta se não sobrou vídeo na lixeira dela (um que falhou acima ficaria solto por engano).
    const left = await db.from("projects").select("id", { count: "exact", head: true }).eq("folder_id", f.id).not("deleted_at", "is", null);
    if (left.error || (left.count ?? 0) > 0) continue;
    const { error } = await db.from("folders").delete().eq("id", f.id);
    if (error) console.error(`[worker] lixeira: projeto ${f.id} não apagou: ${error.message}`);
    else out.folders++;
  }
  return out;
}
