import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getR2, r2Key, type R2 } from "./r2";

/**
 * Apaga um vídeo (projeto): primeiro os arquivos no R2, depois as linhas (a cascata do banco leva
 * gravações e exports; os gatilhos devolvem o espaço à cota). Falha no R2 não apaga as linhas,
 * para nunca sobrar arquivo sem dono que ninguém mais acha.
 */
export async function deleteProjectWith(
  supabase: SupabaseClient<Database>,
  projectId: string,
  r2: Pick<R2, "deleteMany"> = getR2(),
): Promise<boolean> {
  const { data: project, error } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (error) throw new Error("read project failed");
  if (!project) return false;
  const [rec, exp] = await Promise.all([
    supabase.from("recordings").select("storage_path").eq("project_id", projectId),
    supabase.from("exports").select("storage_path").eq("project_id", projectId),
  ]);
  if (rec.error || exp.error) throw new Error("read files failed");
  await r2.deleteMany([
    ...(rec.data ?? []).map((r) => r2Key("recordings", r.storage_path)),
    ...(exp.data ?? []).map((r) => r2Key("exports", r.storage_path)),
  ]);
  const del = await supabase.from("projects").delete().eq("id", projectId);
  if (del.error) throw new Error("delete project failed");
  return true;
}
