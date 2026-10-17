import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { standaloneVideos } from "./rules";

type Db = SupabaseClient<Database>;

export type TrashItem = { kind: "video" | "projeto"; id: string; title: string; deletedAt: string; videos: number };

/** Itens da lixeira (projetos e vídeos soltos), os mais novos primeiro. */
export async function loadTrash(db: Db, userId: string): Promise<TrashItem[]> {
  const [{ data: folders }, { data: videos }] = await Promise.all([
    db.from("folders").select("id, name, deleted_at").eq("user_id", userId).not("deleted_at", "is", null),
    db.from("projects").select("id, title, folder_id, deleted_at").eq("user_id", userId).not("deleted_at", "is", null),
  ]);
  const fs = (folders ?? []).map((f) => ({ id: f.id, name: f.name, deleted_at: f.deleted_at as string }));
  const vs = (videos ?? []).map((v) => ({ id: v.id, title: v.title, folder_id: v.folder_id, deleted_at: v.deleted_at as string }));
  const items: TrashItem[] = [
    ...fs.map((f) => ({
      kind: "projeto" as const,
      id: f.id,
      title: f.name,
      deletedAt: f.deleted_at,
      videos: vs.filter((v) => v.folder_id === f.id && v.deleted_at === f.deleted_at).length,
    })),
    ...standaloneVideos(vs, fs).map((v) => ({ kind: "video" as const, id: v.id, title: v.title, deletedAt: v.deleted_at, videos: 0 })),
  ];
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** Quantos itens aparecem na lixeira (para o link na tela inicial). */
export async function contarLixeira(db: Db, userId: string): Promise<number> {
  return (await loadTrash(db, userId)).length;
}
