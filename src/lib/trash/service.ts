import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteProjectWith } from "@/lib/storage/cleanup";
import type { R2 } from "@/lib/storage/r2";
import type { Database } from "@/lib/supabase/types";
import type { TrashKind } from "./rules";

type Db = SupabaseClient<Database>;

/** Manda para a lixeira. Devolve false se o item não existe, não é da pessoa ou já está lá. */
export async function trashWith(db: Db, kind: TrashKind, id: string, now = new Date()): Promise<boolean> {
  if (kind === "projeto") {
    const { data, error } = await db.rpc("trash_folder", { p_id: id });
    if (error) throw new Error("trash folder failed");
    return data === true;
  }
  const { data, error } = await db.from("projects").update({ deleted_at: now.toISOString() }).eq("id", id).is("deleted_at", null).select("id");
  if (error) throw new Error("trash video failed");
  return (data?.length ?? 0) === 1;
}

/** Tira da lixeira. Vídeo cujo projeto continua na lixeira volta como vídeo solto. */
export async function restoreWith(db: Db, kind: TrashKind, id: string): Promise<boolean> {
  if (kind === "projeto") {
    const { data, error } = await db.rpc("restore_folder", { p_id: id });
    if (error) throw new Error("restore folder failed");
    return data === true;
  }
  const { data: video, error: e1 } = await db.from("projects").select("folder_id").eq("id", id).not("deleted_at", "is", null).maybeSingle();
  if (e1) throw new Error("read video failed");
  if (!video) return false;
  let folderId = video.folder_id;
  if (folderId) {
    const { data: folder, error } = await db.from("folders").select("deleted_at").eq("id", folderId).maybeSingle();
    if (error) throw new Error("read folder failed");
    if (!folder || folder.deleted_at) folderId = null;
  }
  const { data, error } = await db.from("projects").update({ deleted_at: null, folder_id: folderId }).eq("id", id).select("id");
  if (error) throw new Error("restore video failed");
  return (data?.length ?? 0) === 1;
}

/**
 * Apaga de vez um item que está na lixeira (arquivos no R2 + linhas; os gatilhos devolvem o espaço à cota).
 * Projeto: apaga os vídeos que estão na lixeira dele e depois a pasta. Item fora da lixeira nunca é apagado aqui.
 */
export async function purgeWith(db: Db, kind: TrashKind, id: string, r2?: Pick<R2, "deleteMany">): Promise<boolean> {
  if (kind === "video") {
    const { data, error } = await db.from("projects").select("id").eq("id", id).not("deleted_at", "is", null).maybeSingle();
    if (error) throw new Error("read video failed");
    if (!data) return false;
    return deleteProjectWith(db, id, r2);
  }
  const { data: folder, error } = await db.from("folders").select("id").eq("id", id).not("deleted_at", "is", null).maybeSingle();
  if (error) throw new Error("read folder failed");
  if (!folder) return false;
  const { data: videos, error: e2 } = await db.from("projects").select("id").eq("folder_id", id).not("deleted_at", "is", null);
  if (e2) throw new Error("read videos failed");
  // Um vídeo de cada vez: se um falhar, a pasta e os outros ficam na lixeira para tentar de novo.
  for (const v of videos ?? []) await deleteProjectWith(db, v.id, r2);
  const del = await db.from("folders").delete().eq("id", id);
  if (del.error) throw new Error("delete folder failed");
  return true;
}
