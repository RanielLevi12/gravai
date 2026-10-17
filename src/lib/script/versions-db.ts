import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// A tabela é da migração 0014 e ainda não está nos tipos gerados: usa o cliente sem tipos.
const untyped = (c: SupabaseClient<Database>) => c as unknown as SupabaseClient;
import type { VersionDb } from "./versions";

/** VersionDb sobre o Supabase da sessão (RLS limita aos trechos do usuário). */
export function supabaseVersionDb(deps: { supabase: SupabaseClient<Database> }): VersionDb {
  const supabase = untyped(deps.supabase);
  return {
    async list(blockId) {
      const { data, error } = await supabase
        .from("script_block_versions")
        .select("text")
        .eq("block_id", blockId)
        .order("created_at", { ascending: false });
      if (error) throw new Error("read versions failed");
      return (data ?? []).map((v: { text: string }) => v.text);
    },
    async push(blockId, text) {
      const { error } = await supabase.from("script_block_versions").insert({ block_id: blockId, text });
      return !error;
    },
    async popLatest(blockId) {
      const { data, error } = await supabase
        .from("script_block_versions")
        .select("id, text")
        .eq("block_id", blockId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error("read versions failed");
      if (!data) return null;
      await supabase.from("script_block_versions").delete().eq("id", data.id);
      return data.text;
    },
    async trim(blockId, keep) {
      const { data } = await supabase
        .from("script_block_versions")
        .select("id")
        .eq("block_id", blockId)
        .order("created_at", { ascending: false })
        .range(keep, keep + 100);
      const old = (data ?? []).map((v: { id: string }) => v.id);
      if (old.length > 0) await supabase.from("script_block_versions").delete().in("id", old);
    },
    async clearProject(projectId) {
      const { data } = await supabase.from("script_blocks").select("id").eq("project_id", projectId);
      const ids = (data ?? []).map((b: { id: string }) => b.id);
      if (ids.length > 0) await supabase.from("script_block_versions").delete().in("block_id", ids);
    },
  };
}

/** Versões de vários trechos de uma vez, para a tela abrir já com o histórico. Sem a tabela (migração 0014 ainda não aplicada), devolve vazio. */
export async function loadVersions(typed: SupabaseClient<Database>, blockIds: string[]): Promise<Record<string, string[]>> {
  if (blockIds.length === 0) return {};
  const supabase = untyped(typed);
  const { data, error } = await supabase
    .from("script_block_versions")
    .select("block_id, text")
    .in("block_id", blockIds)
    .order("created_at", { ascending: false });
  if (error || !data) return {};
  const out: Record<string, string[]> = {};
  for (const v of data as { block_id: string; text: string }[]) (out[v.block_id] ??= []).push(v.text);
  return out;
}
