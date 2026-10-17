import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isOrigem } from "@/components/project/origens";
import { SourcePicker } from "@/components/project/SourcePicker";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Novo vídeo · Gravaí" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NovoPage({ searchParams }: { searchParams: Promise<{ origem?: string | string[]; projeto?: string | string[] }> }) {
  const { origem, projeto } = await searchParams;
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  // Vídeo dentro de um projeto: a pasta precisa ser do próprio usuário (RLS), senão segue como vídeo solto.
  let folder: { id: string; name: string } | null = null;
  if (typeof projeto === "string" && UUID.test(projeto)) {
    const { data } = await supabase.from("folders").select("id, name").eq("id", projeto).is("deleted_at", null).maybeSingle();
    folder = data ?? null;
  }

  // userId só monta a pasta do Storage ({user.id}/...); RLS e o servidor conferem de novo.
  return <SourcePicker origem={isOrigem(origem) ? origem : null} userId={auth.user.id} folder={folder} />;
}
