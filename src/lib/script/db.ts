import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { InterviewProject } from "@/lib/interview/service";
import type { Interview } from "@/lib/interview/steps";
import type { ScriptDb } from "./generate";

const asJson = (v: unknown) => v as unknown as NonNullable<Json>;

/** ScriptDb sobre o Supabase da sessão do usuário (RLS garante que tudo é dele). */
export function supabaseScriptDb(deps: { supabase: SupabaseClient<Database>; userId: string }): ScriptDb {
  const { supabase, userId } = deps;
  return {
    async getProject(id) {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, source_kind, source_text, source_truncated, status, interview, series_id, episode_index")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error("read project failed");
      if (!data) return null;
      const interview = data.interview && typeof data.interview === "object" && !Array.isArray(data.interview) ? data.interview : {};
      return { ...data, interview: interview as unknown as Interview } satisfies InterviewProject;
    },
    async profile() {
      const { data } = await supabase.from("profiles").select("niche, audience, tone, phrases").maybeSingle();
      return data;
    },
    async cta(id) {
      const { data } = await supabase.from("ctas").select("kind, label, value").eq("id", id).maybeSingle();
      return data ? { kind: data.kind as "link" | "bio" | "whatsapp" | "phone", label: data.label, value: data.value } : null;
    },
    async saveScript(projectId, { blocks, descriptions, interview }) {
      // Grava por cima (posição única) e só depois apaga as sobras: nunca deixa o projeto sem blocos.
      const { error } = await supabase.from("script_blocks").upsert(
        blocks.map((b) => ({ ...b, project_id: projectId, user_id: userId, descriptions: asJson(b.descriptions) })),
        { onConflict: "project_id,position" },
      );
      if (error) return false;
      const { error: delError } = await supabase.from("script_blocks").delete().eq("project_id", projectId).gt("position", blocks.length);
      if (delError) return false;
      const { data, error: upError } = await supabase
        .from("projects")
        .update({ descriptions: asJson(descriptions), interview: asJson(interview), status: "script" })
        .eq("id", projectId)
        .select("id");
      return !upError && (data?.length ?? 0) > 0;
    },
  };
}
