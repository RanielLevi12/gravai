import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getR2, r2Key } from "@/lib/storage/r2";
import type { Descriptions } from "@/lib/script/generate";
import { MSG_ALREADY_RUNNING, MSG_NOT_RECORDED, MSG_PROJECT_NOT_FOUND, type CutInfo, type DeliveryDb } from "./service";
import type { ExportKind, JobStatus } from "./rules";

/** DeliveryDb sobre o Supabase da sessão do usuário (RLS limita tudo ao dono). */
export function supabaseDeliveryDb(deps: { supabase: SupabaseClient<Database> }): DeliveryDb {
  const { supabase } = deps;
  return {
    async project(id) {
      const { data, error } = await supabase.from("projects").select("id, status, script_stale").eq("id", id).maybeSingle();
      if (error) throw new Error("read project failed");
      return data ? { id: data.id, status: data.status, scriptStale: data.script_stale } : null;
    },
    async latestJob(projectId) {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, kind, status, step, progress, error")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error("read job failed");
      return data ? { ...data, kind: data.kind as "render" | "recut", status: data.status as JobStatus } : null;
    },
    async createJob(projectId, kind, payload) {
      const { data, error } = await supabase.rpc("create_render_job", { p_project: projectId, p_kind: kind, p_payload: payload as never });
      if (error) {
        if (error.message.includes("job_already_active")) throw new Error(MSG_ALREADY_RUNNING);
        if (error.message.includes("not_recorded")) throw new Error(MSG_NOT_RECORDED);
        if (error.code === "P0002") throw new Error(MSG_PROJECT_NOT_FOUND);
        throw new Error("create job failed");
      }
      // Gerar vídeos "vê" o script atual: o aviso de script desatualizado só volta se algo mudar depois.
      if (kind === "render") await supabase.from("projects").update({ script_stale: false }).eq("id", projectId);
      return data as string;
    },
    async exportsOf(projectId) {
      const { data, error } = await supabase
        .from("exports")
        .select("id, kind, cut_id, storage_path, mime, duration_seconds, size_bytes, start_seconds, end_seconds, expires_at, created_at")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw new Error("read exports failed");
      return (data ?? []).map((r) => ({
        id: r.id,
        kind: r.kind as ExportKind,
        cutId: r.cut_id,
        storagePath: r.storage_path,
        mime: r.mime,
        durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
        sizeBytes: Number(r.size_bytes),
        startSeconds: r.start_seconds === null ? null : Number(r.start_seconds),
        endSeconds: r.end_seconds === null ? null : Number(r.end_seconds),
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      }));
    },
    async cuts(projectId) {
      const { data, error } = await supabase.from("projects").select("cuts").eq("id", projectId).maybeSingle();
      if (error) throw new Error("read cuts failed");
      const list = Array.isArray(data?.cuts) ? (data.cuts as unknown[]) : [];
      const cuts: CutInfo[] = [];
      for (const c of list) {
        const o = c as Record<string, unknown> | null;
        if (!o || typeof o.id !== "string" || !Number.isInteger(o.start) || !Number.isInteger(o.end)) continue;
        const descriptions = o.descriptions && typeof o.descriptions === "object" ? (o.descriptions as Descriptions) : {};
        cuts.push({ id: o.id, title: typeof o.title === "string" ? o.title : "", start: o.start as number, end: o.end as number, descriptions });
      }
      return cuts.sort((a, b) => a.start - b.start);
    },
    async signUrl(storagePath, seconds, downloadName) {
      return getR2().presignGet(r2Key("exports", storagePath), seconds, downloadName);
    },
    async latestRecordingAt(projectId) {
      const { data, error } = await supabase
        .from("recordings")
        .select("created_at")
        .eq("project_id", projectId)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error("read recordings failed");
      return data ? new Date(data.created_at) : null;
    },
    async download(storagePath) {
      return getR2().getBytes(r2Key("exports", storagePath));
    },
  };
}
