import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeView, type RecentVideo } from "@/components/project/HomeView";
import { missingPartsCount } from "@/lib/record/missing";
import { contarLixeira } from "@/lib/trash/queries";
import { createServerClient } from "@/lib/supabase/server";
import { currentMonth, PROJECTS_LIMIT } from "@/lib/usage";

export const metadata: Metadata = { title: "Seus vídeos · Gravaí" };

export default async function ProjetosPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  const [{ data: recentes }, { data: soltos }, { data: pastas }, { data: uso }, naLixeira] = await Promise.all([
    // Os 3 últimos vídeos, estejam ou não num projeto.
    supabase
      .from("projects")
      .select("id, title, status, source_kind, interview, folders(name)")
      .eq("user_id", auth.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(3),
    // Vídeos soltos (sem projeto): ficam agrupados no fim da lista.
    supabase
      .from("projects")
      .select("id, title, status, source_kind, interview")
      .eq("user_id", auth.user.id)
      .is("folder_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("folders")
      .select("id, name, color, projects(count)")
      .eq("user_id", auth.user.id)
      .is("deleted_at", null)
      .is("projects.deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("usage_months").select("projects").eq("user_id", auth.user.id).eq("month", currentMonth()).maybeSingle(),
    // Só o que foi para a lixeira por conta própria importa para o link; vídeos de projeto vão junto com ele.
    contarLixeira(supabase, auth.user.id),
  ]);

  const usados = Math.min(uso?.projects ?? 0, PROJECTS_LIMIT);
  const listaSoltos = soltos ?? [];
  const listaPastas = (pastas ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    count: (f.projects as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
  const base = recentes ?? [];

  // "Faltam N partes": só para vídeos que estão sendo gravados por blocos (o status pode seguir "script" até aprovar).
  const gravando = base.filter((p) => p.status === "gravacao" || p.status === "script").map((p) => p.id);
  const parts = new Map<string, number | null>();
  if (gravando.length > 0) {
    const [{ data: blocos }, { data: prontas }] = await Promise.all([
      supabase.from("script_blocks").select("id, project_id").in("project_id", gravando),
      supabase.from("recordings").select("project_id, block_id").in("project_id", gravando).eq("status", "ready").eq("kind", "block"),
    ]);
    for (const id of gravando) {
      parts.set(
        id,
        missingPartsCount(
          (blocos ?? []).filter((b) => b.project_id === id).map((b) => b.id),
          (prontas ?? []).filter((r) => r.project_id === id).map((r) => r.block_id),
        ),
      );
    }
  }
  const lista = base.map((p) => ({ ...p, missingParts: parts.get(p.id) ?? null }));

  return (
    <HomeView
      usados={usados}
      limite={PROJECTS_LIMIT}
      recentes={lista as unknown as RecentVideo[]}
      pastas={listaPastas}
      soltos={listaSoltos}
      naLixeira={naLixeira}
    />
  );
}
