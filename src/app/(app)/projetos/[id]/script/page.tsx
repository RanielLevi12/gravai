import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ScriptEditor, type EditorBlock } from "@/components/script/ScriptEditor";
import { ScriptNotice } from "@/components/script/ScriptNotice";
import { AiError } from "@/lib/ai/schemas";
import { validateCuts } from "@/lib/script/cuts";
import { isPlatform, type Platform } from "@/lib/interview/steps";
import type { BlockKind } from "@/lib/script/generate";
import { generateScript } from "@/lib/script/actions";
import { loadVersions } from "@/lib/script/versions-db";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Script · Gravaí" };
// Chamadas de IA nesta rota/página (e nas ações que ela usa): os timeouts de src/lib/ai/openrouter.ts cabem aqui.
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  const loadBlocks = async () => {
    // O Next reaproveita GETs idênticos dentro da mesma renderização; sem um AbortSignal, a leitura
    // depois de gerar devolveria a lista vazia de antes.
    const { data } = await supabase
      .from("script_blocks")
      .select("id, kind, text, cut_index, cut_title")
      .eq("project_id", id)
      .order("position")
      .abortSignal(new AbortController().signal);
    return data ?? [];
  };

  // RLS limita aos projetos do usuário: projeto de outra pessoa cai no 404.
  const loadProject = () =>
    supabase
      .from("projects")
      .select("id, title, interview, script_stale, cuts, descriptions, cover_prompt")
      .eq("id", id)
      .abortSignal(new AbortController().signal)
      .maybeSingle();
  let { data: project } = await loadProject();
  if (!project) notFound();

  let rows = await loadBlocks();
  // Primeira visita depois da entrevista: o script é gerado aqui (a página mostra loading.tsx enquanto isso).
  if (rows.length === 0) {
    try {
      await generateScript(id);
    } catch (e) {
      const back = `/projetos/${id}/entrevista/resumo`;
      if (e instanceof AiError && e.code === "not_connected") {
        return (
          <ScriptNotice title="Conecte sua IA para gerar o script" backHref={back} connect>
            O Gravaí usa a sua conta de IA para escrever o roteiro. Você paga só o que usar, direto no OpenRouter.
          </ScriptNotice>
        );
      }
      console.error("[script] geração falhou", e instanceof Error ? e.message : e);
      return (
        <ScriptNotice title="Não consegui gerar o script" backHref={back}>
          {e instanceof AiError ? e.userMessage : "Não foi possível gerar o script agora. Tente de novo."}
        </ScriptNotice>
      );
    }
    rows = await loadBlocks();
    // A geração mudou título, entrevista, descrições e capa.
    project = (await loadProject()).data ?? project;
  }

  const interview = project.interview && typeof project.interview === "object" && !Array.isArray(project.interview) ? project.interview : {};
  const warning = "scriptWarning" in interview && typeof interview.scriptWarning === "string" ? [interview.scriptWarning] : [];
  const checks = "scriptChecks" in interview && Array.isArray(interview.scriptChecks) ? interview.scriptChecks.filter((c) => typeof c === "string") : [];
  const chosen = "titles" in interview && interview.titles && typeof interview.titles === "object" && "chosen" in interview.titles ? interview.titles.chosen : null;

  const cutSeconds = "cutSeconds" in interview && typeof interview.cutSeconds === "number" ? interview.cutSeconds : null;
  const cutsRaw = validateCuts(project.cuts, rows.length);

  const rawDescriptions = project.descriptions && typeof project.descriptions === "object" && !Array.isArray(project.descriptions) ? project.descriptions : {};
  const descriptions: Partial<Record<Platform, string>> = {};
  for (const [k, v] of Object.entries(rawDescriptions)) if (isPlatform(k) && typeof v === "string" && v) descriptions[k] = v;

  const blocks: EditorBlock[] = rows.map((b) => ({
    id: b.id,
    kind: b.kind as BlockKind,
    cutIndex: b.cut_index,
    cutTitle: b.cut_title,
    text: b.text,
  }));

  const initialVersions = await loadVersions(supabase, blocks.map((b) => b.id));

  return (
    <ScriptEditor
      projectId={project.id}
      title={typeof chosen === "string" && chosen ? chosen : project.title}
      blocks={blocks}
      warnings={[...warning, ...(checks as string[])]}
      stale={project.script_stale}
      cutSeconds={cutSeconds}
      initialCuts={cutsRaw.ok ? cutsRaw.cuts : []}
      initialVersions={initialVersions}
      info={{ coverPrompt: project.cover_prompt, descriptions }}
    />
  );
}
