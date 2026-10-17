import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Interview } from "@/lib/interview/steps";
import type { Crop } from "./capture";
import { getR2, r2Key } from "@/lib/storage/r2";
import { extensionFor } from "./mime";

type Kind = "take" | "block" | "external";

export interface RecordDb {
  project(id: string): Promise<{ id: string; status: string; interview: Interview | null } | null>;
  blockIds(projectId: string): Promise<string[]>;
  insertUploading(row: { projectId: string; kind: Kind; blockId: string | null; mime: string; crop: Crop | null }): Promise<{ id: string; path: string }>;
  markReady(id: string, v: { sizeBytes: number; durationSeconds: number | null }): Promise<{ replacedPaths: string[] } | null>;
  /** Só apaga gravação em envio ("uploading"). "ready" = já salva, nada é apagado. */
  deleteRow(id: string): Promise<{ path: string } | "ready" | null>;
  readyRows(projectId: string): Promise<{ id: string; kind: Kind; blockId: string | null; path: string; durationSeconds: number | null }[]>;
  setProjectStatus(projectId: string, status: "gravado"): Promise<boolean>;
  removeFiles(paths: string[]): Promise<void>;
  /** Cabem mais `bytes` na cota de espaço do usuário? */
  storageFits(bytes: number): Promise<boolean>;
  /** Gravação do usuário ainda em envio (o caminho do arquivo vem do banco, nunca do navegador). */
  uploadingRow(id: string): Promise<{ id: string; path: string; mime: string } | null>;
}

/** RecordDb sobre o Supabase da sessão do usuário (RLS limita tudo ao dono). */
export function supabaseRecordDb(deps: { supabase: SupabaseClient<Database>; userId: string }): RecordDb {
  const { supabase, userId } = deps;
  return {
    async project(id) {
      const { data, error } = await supabase.from("projects").select("id, status, interview").eq("id", id).maybeSingle();
      if (error) throw new Error("read project failed");
      if (!data) return null;
      const i = data.interview && typeof data.interview === "object" && !Array.isArray(data.interview) ? data.interview : null;
      return { id: data.id, status: data.status, interview: i as unknown as Interview | null };
    },
    async blockIds(projectId) {
      const { data, error } = await supabase.from("script_blocks").select("id").eq("project_id", projectId).order("position");
      if (error) throw new Error("read blocks failed");
      return (data ?? []).map((b) => b.id);
    },
    async insertUploading({ projectId, kind, blockId, mime, crop }) {
      const id = crypto.randomUUID();
      const path = `${userId}/${projectId}/${id}.${extensionFor(mime)}`;
      const { error } = await supabase.from("recordings").insert({
        id,
        user_id: userId,
        project_id: projectId,
        kind,
        block_id: blockId,
        storage_path: path,
        mime,
        size_bytes: 0,
        // Só manda a coluna quando há corte: gravação em pé segue sem depender da migração 0013.
        ...(crop ? { crop } : {}),
      });
      if (error) throw new Error("insert recording failed");
      return { id, path };
    },
    async markReady(id, v) {
      const { data, error } = await supabase.rpc("finish_recording", {
        p_id: id,
        p_size_bytes: Math.round(v.sizeBytes),
        p_duration: v.durationSeconds as number,
      });
      if (error) {
        if (error.code === "P0002") return null;
        throw new Error("finish recording failed");
      }
      return { replacedPaths: data ?? [] };
    },
    async deleteRow(id) {
      const { data, error } = await supabase.from("recordings").delete().eq("id", id).eq("status", "uploading").select("storage_path");
      if (error) throw new Error("delete recording failed");
      if (data?.[0]) return { path: data[0].storage_path };
      const { data: left } = await supabase.from("recordings").select("status").eq("id", id).maybeSingle();
      return left?.status === "ready" ? "ready" : null;
    },
    async readyRows(projectId) {
      const { data, error } = await supabase
        .from("recordings")
        .select("id, kind, block_id, storage_path, duration_seconds")
        .eq("project_id", projectId)
        .eq("status", "ready");
      if (error) throw new Error("read recordings failed");
      return (data ?? []).map((r) => ({
        id: r.id,
        kind: r.kind as Kind,
        blockId: r.block_id,
        path: r.storage_path,
        durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
      }));
    },
    async setProjectStatus(projectId, status) {
      const { data, error } = await supabase.from("projects").update({ status }).eq("id", projectId).in("status", ["script", "gravacao"]).select("id");
      return !error && (data?.length ?? 0) > 0;
    },
    async removeFiles(paths) {
      const own = paths.filter((p) => p.startsWith(`${userId}/`));
      if (own.length === 0) return;
      await getR2().deleteMany(own.map((p) => r2Key("recordings", p)));
    },
    async storageFits(bytes) {
      const { data, error } = await supabase.rpc("storage_fits", { p_bytes: Math.round(bytes) });
      if (error) throw new Error("storage quota read failed");
      return data === true;
    },
    async uploadingRow(id) {
      const { data, error } = await supabase.from("recordings").select("id, storage_path, mime").eq("id", id).eq("status", "uploading").maybeSingle();
      if (error) throw new Error("read recording failed");
      return data ? { id: data.id, path: data.storage_path, mime: data.mime } : null;
    },
  };
}
