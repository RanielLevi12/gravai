import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeView, type RecentVideo } from "@/components/project/HomeView";
import { createServerClient } from "@/lib/supabase/server";
import { currentMonth, PROJECTS_LIMIT } from "@/lib/usage";

export const metadata: Metadata = { title: "Seus vídeos · Gravaí" };

export default async function ProjetosPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  const [{ data: recentes }, { data: soltos }, { data: pastas }, { data: uso }] = await Promise.all([
    // Os 3 últimos vídeos, estejam ou não num projeto.
    supabase
      .from("projects")
      .select("id, title, status, source_kind, interview, folders(name)")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    // Vídeos soltos (sem projeto): ficam agrupados no fim da lista.
    supabase
      .from("projects")
      .select("id, title, status, source_kind, interview")
      .eq("user_id", auth.user.id)
      .is("folder_id", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("folders").select("id, name, color, projects(count)").eq("user_id", auth.user.id).order("created_at", { ascending: false }),
    supabase.from("usage_months").select("projects").eq("user_id", auth.user.id).eq("month", currentMonth()).maybeSingle(),
  ]);

  const usados = Math.min(uso?.projects ?? 0, PROJECTS_LIMIT);
  const listaSoltos = soltos ?? [];
  const listaPastas = (pastas ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    count: (f.projects as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
  const lista = recentes ?? [];

  return (
    <HomeView
      usados={usados}
      limite={PROJECTS_LIMIT}
      recentes={lista as unknown as RecentVideo[]}
      pastas={listaPastas}
      soltos={listaSoltos}
    />
  );
}
