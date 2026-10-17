import { styleFromSettings } from "@/lib/folders/schema";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { currentMonth, PROJECTS_LIMIT } from "@/lib/usage";
import type { InterviewDb, InterviewProject } from "./service";
import type { Interview } from "./steps";

const PROJECT_FIELDS = "id, title, source_kind, source_text, source_truncated, status, interview, series_id, episode_index, folder_id, folders(about, settings)";

const asJson = (i: unknown) => i as unknown as NonNullable<Json>;

/**
 * InterviewDb sobre o Supabase. `supabase` = sessão do usuário (RLS garante que tudo é dele).
 */
export function supabaseInterviewDb(deps: { supabase: SupabaseClient<Database> }): InterviewDb {
  const { supabase } = deps;
  return {
    async getProject(id) {
      const { data, error } = await supabase.from("projects").select(PROJECT_FIELDS).eq("id", id).maybeSingle();
      if (error) throw new Error("read project failed");
      if (!data) return null;
      const interview = data.interview && typeof data.interview === "object" && !Array.isArray(data.interview) ? data.interview : {};
      const { folders, ...project } = data;
      return { ...project, folder_about: folders?.about ?? null, folder_style: styleFromSettings(folders?.settings), interview: interview as unknown as Interview } satisfies InterviewProject;
    },
    async saveInterview(id, interview, opts) {
      const { data, error } = await supabase
        .from("projects")
        .update({ interview: asJson(interview), ...(opts?.scriptStale ? { script_stale: true } : {}) })
        .eq("id", id)
        .select("id");
      return !error && (data?.length ?? 0) > 0;
    },
    async ctaIds() {
      const { data, error } = await supabase.from("ctas").select("id");
      if (error) throw new Error("read ctas failed");
      return (data ?? []).map((c) => c.id);
    },
    async remainingProjects() {
      const { data } = await supabase.from("usage_months").select("projects").eq("month", currentMonth()).maybeSingle();
      return Math.max(0, PROJECTS_LIMIT - (data?.projects ?? 0));
    },
    async createSeries(title) {
      const { data, error } = await supabase.from("series").insert({ title }).select("id").single();
      return error || !data ? null : data.id;
    },
    async deleteSeries(id) {
      await supabase.from("series").delete().eq("id", id);
    },
    async claimForSeries(projectId, seriesId, patch) {
      const { data, error } = await supabase
        .from("projects")
        .update({ series_id: seriesId, episode_index: 1, title: patch.title, interview: asJson(patch.interview) })
        .eq("id", projectId)
        .is("series_id", null)
        .select("id");
      return !error && (data?.length ?? 0) === 1;
    },
    async releaseSeries(projectId, original) {
      await supabase
        .from("projects")
        .update({ series_id: null, episode_index: null, title: original.title, interview: asJson(original.interview) })
        .eq("id", projectId);
    },
    async insertProjects(rows) {
      // Função do banco: consome a cota e insere na mesma transação (projects não aceita INSERT direto).
      const { data, error } = await supabase.rpc("create_episode_projects", { p_rows: asJson(rows) });
      if (error || !data) return null;
      if (data.length === 0) return "quota";
      // Mesma ordem das linhas pedidas (por episódio).
      return rows.map((r) => data.find((d) => d.ep_index === r.episode_index)?.project_id).filter((id): id is string => Boolean(id));
    },
    async seriesProjectIds(seriesId) {
      const { data } = await supabase.from("projects").select("id").eq("series_id", seriesId).order("episode_index");
      return (data ?? []).map((p) => p.id);
    },
  };
}
