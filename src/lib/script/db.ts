import { styleFromSettings } from "@/lib/folders/schema";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { InterviewProject } from "@/lib/interview/service";
import type { Interview } from "@/lib/interview/steps";
import type { Cut } from "./cuts";
import type { CutsDb } from "./cuts-generate";
import type { BlockKind, ScriptDb } from "./generate";
import type { BlockDb } from "./rewrite";

const asJson = (v: unknown) => v as unknown as NonNullable<Json>;

/** ScriptDb sobre o Supabase da sessão do usuário (RLS garante que tudo é dele). */
export function supabaseScriptDb(deps: { supabase: SupabaseClient<Database>; userId: string }): ScriptDb {
  const { supabase, userId } = deps;
  return {
    async getProject(id) {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, source_kind, source_text, source_truncated, status, interview, series_id, episode_index, folder_id, folders(about, settings)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error("read project failed");
      if (!data) return null;
      const interview = data.interview && typeof data.interview === "object" && !Array.isArray(data.interview) ? data.interview : {};
      const { folders, ...project } = data;
      return { ...project, folder_about: folders?.about ?? null, folder_style: styleFromSettings(folders?.settings), interview: interview as unknown as Interview } satisfies InterviewProject;
    },
    async profile() {
      const { data } = await supabase.from("profiles").select("niche, audience, tone, phrases").maybeSingle();
      return data;
    },
    async cta(id) {
      const { data } = await supabase.from("ctas").select("kind, label, value").eq("id", id).maybeSingle();
      return data ? { kind: data.kind as "link" | "bio" | "whatsapp" | "phone", label: data.label, value: data.value } : null;
    },
    async saveScript(projectId, { blocks, descriptions, coverPrompt, interview }) {
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
        .update({ descriptions: asJson(descriptions), cover_prompt: coverPrompt, interview: asJson(interview), status: "script", script_stale: false, cuts: [] })
        .eq("id", projectId)
        .select("id");
      return !upError && (data?.length ?? 0) > 0;
    },
  };
}

/** BlockDb sobre o Supabase da sessão do usuário (RLS limita aos blocos dele). */
export function supabaseBlockDb(deps: { supabase: SupabaseClient<Database> }): BlockDb {
  const { supabase } = deps;
  return {
    async blockContext(blockId) {
      const { data: block } = await supabase
        .from("script_blocks")
        .select("project_id, position, kind, text")
        .eq("id", blockId)
        .maybeSingle();
      if (!block) return null;
      const [{ data: around }, { data: project }, { data: profile }] = await Promise.all([
        supabase
          .from("script_blocks")
          .select("position, text")
          .eq("project_id", block.project_id)
          .in("position", [block.position - 1, block.position + 1]),
        supabase.from("projects").select("interview").eq("id", block.project_id).maybeSingle(),
        supabase.from("profiles").select("tone").maybeSingle(),
      ]);
      const interview = project?.interview && typeof project.interview === "object" && !Array.isArray(project.interview) ? (project.interview as Interview) : {};
      const textAt = (position: number) => around?.find((b) => b.position === position)?.text || null;
      return {
        kind: block.kind as BlockKind,
        text: block.text,
        previous: textAt(block.position - 1),
        next: textAt(block.position + 1),
        cutSeconds: interview.cutSeconds ?? null,
        tone: profile?.tone ?? null,
      };
    },
    async saveBlockText(blockId, text) {
      const { data, error } = await supabase.from("script_blocks").update({ text }).eq("id", blockId).select("id");
      return !error && (data?.length ?? 0) > 0;
    },
  };
}

/** CutsDb sobre o Supabase da sessão do usuário (RLS limita aos projetos dele). */
export function supabaseCutsDb(deps: { supabase: SupabaseClient<Database> }): CutsDb {
  const { supabase } = deps;
  return {
    async getProject(id) {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, source_kind, source_text, source_truncated, status, interview, series_id, episode_index, folder_id, folders(about, settings)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error("read project failed");
      if (!data) return null;
      const interview = data.interview && typeof data.interview === "object" && !Array.isArray(data.interview) ? data.interview : {};
      const { folders, ...project } = data;
      return { ...project, folder_about: folders?.about ?? null, folder_style: styleFromSettings(folders?.settings), interview: interview as unknown as Interview } satisfies InterviewProject;
    },
    async blocks(projectId) {
      const { data, error } = await supabase.from("script_blocks").select("position, text").eq("project_id", projectId).order("position");
      if (error) throw new Error("read blocks failed");
      return data ?? [];
    },
    async cta(id) {
      const { data } = await supabase.from("ctas").select("kind, label, value").eq("id", id).maybeSingle();
      return data ? { kind: data.kind as "link" | "bio" | "whatsapp" | "phone", label: data.label, value: data.value } : null;
    },
    async saveCuts(projectId, cuts: Cut[]) {
      const { data, error } = await supabase.from("projects").update({ cuts: asJson(cuts) }).eq("id", projectId).select("id");
      return !error && (data?.length ?? 0) > 0;
    },
  };
}
