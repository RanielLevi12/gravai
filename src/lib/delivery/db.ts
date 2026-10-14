import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { MSG_ALREADY_RUNNING, MSG_NOT_RECORDED, MSG_PROJECT_NOT_FOUND, type DeliveryDb } from "./service";
import type { JobStatus } from "./rules";

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
        .select("id, status, step, progress, error")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error("read job failed");
      return data ? { ...data, status: data.status as JobStatus } : null;
    },
    async createJob(projectId, kind, payload) {
      const { data, error } = await supabase.rpc("create_render_job", { p_project: projectId, p_kind: kind, p_payload: payload as never });
      if (error) {
        if (error.message.includes("job_already_active")) throw new Error(MSG_ALREADY_RUNNING);
        if (error.message.includes("not_recorded")) throw new Error(MSG_NOT_RECORDED);
        if (error.code === "P0002") throw new Error(MSG_PROJECT_NOT_FOUND);
        throw new Error("create job failed");
      }
      return data as string;
    },
  };
}
