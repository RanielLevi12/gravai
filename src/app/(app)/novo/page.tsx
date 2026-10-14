import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isOrigem } from "@/components/project/origens";
import { SourcePicker } from "@/components/project/SourcePicker";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Novo vídeo · Gravaí" };

export default async function NovoPage({ searchParams }: { searchParams: Promise<{ origem?: string | string[] }> }) {
  const { origem } = await searchParams;
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  // userId só monta a pasta do Storage ({user.id}/...); RLS e o servidor conferem de novo.
  return <SourcePicker origem={isOrigem(origem) ? origem : null} userId={auth.user.id} />;
}
