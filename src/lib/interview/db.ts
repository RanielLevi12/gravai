import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { consumeUsage, currentMonth, PROJECTS_LIMIT, refundUsage } from "@/lib/usage";
import type { InterviewDb, InterviewProject } from "./service";
import type { Interview } from "./steps";

const PROJECT_FIELDS = "id, title, source_kind, source_text, source_truncated, status, interview, series_id, episode_index";

const asJson = (i: Interview) => i as unknown as NonNullable<Json>;

/**
 * InterviewDb sobre o Supabase. `supabase` = sessão do usuário (RLS garante que tudo é dele);
 * `admin` = service role, usado só para devolver cota (refund_usage).
 */
export function supabaseInterviewDb(deps: { supabase: SupabaseClient<Database>; admin: () => SupabaseClient<Database>; userId: string }): InterviewDb {
  const { supabase, admin, userId } = deps;
  return {
    async getProject(id) {
      const { data, error } = await supabase.from("projects").select(PROJECT_FIELDS).eq("id", id).maybeSingle();
      if (error) throw new Error("read project failed");
      if (!data) return null;
      const interview = data.interview && typeof data.interview === "object" && !Array.isArray(data.interview) ? data.interview : {};
      return { ...data, interview: interview as unknown as Interview } satisfies InterviewProject;
    },
    async saveInterview(id, interview) {
      const { data, error } = await supabase.from("projects").update({ interview: asJson(interview) }).eq("id", id).select("id");
      return !error && (data?.length ?? 0) > 0;
    },
    async ctaIds() {
      const { data, error } = await supabase.from("ctas").select("id");
      if (error) throw new Error("read ctas failed");
      return (data ?? []).map((c) => c.id);
    },
    consumeProjects: (n) => consumeUsage(supabase, n, 0),
    async remainingProjects() {
      const { data } = await supabase.from("usage_months").select("projects").eq("month", currentMonth()).maybeSingle();
      return Math.max(0, PROJECTS_LIMIT - (data?.projects ?? 0));
    },
    refundProjects: (n) => refundUsage(admin(), userId, n, 0),
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
      const { data, error } = await supabase
        .from("projects")
        .insert(rows.map((r) => ({ ...r, interview: asJson(r.interview) })))
        .select("id, episode_index");
      if (error || !data) return null;
      // Mesma ordem das linhas pedidas (por episódio).
      return rows.map((r) => data.find((d) => d.episode_index === r.episode_index)?.id).filter((id): id is string => Boolean(id));
    },
    async seriesProjectIds(seriesId) {
      const { data } = await supabase.from("projects").select("id").eq("series_id", seriesId).order("episode_index");
      return (data ?? []).map((p) => p.id);
    },
  };
}
