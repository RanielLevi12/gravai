import type { Db } from "./claim";

const BATCH = 100;

/** Apaga os exports vencidos (linhas e arquivos do bucket). Devolve quantos. */
export async function purgeExpired(db: Db): Promise<number> {
  const { data, error } = await db.rpc("purge_expired_exports");
  if (error) throw new Error(`purge_expired_exports: ${error.message}`);
  const paths = (data ?? []) as string[];
  for (let i = 0; i < paths.length; i += BATCH) {
    const gone = await db.storage.from("exports").remove(paths.slice(i, i + BATCH));
    if (gone.error) console.error("[worker] não consegui apagar arquivos vencidos:", gone.error.message);
  }
  return paths.length;
}
