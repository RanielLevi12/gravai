import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { SourceReview } from "./SourceReview";

export const metadata: Metadata = { title: "Seu conteúdo · Gravaí" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FontePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  // RLS limita aos projetos do usuário: projeto de outra pessoa cai no 404.
  const { data: project } = await supabase
    .from("projects")
    .select("id, source_text, source_truncated")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  return <SourceReview projectId={project.id} initialText={project.source_text} truncated={project.source_truncated} />;
}
