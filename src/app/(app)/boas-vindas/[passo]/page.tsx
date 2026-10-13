import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isTone } from "@/lib/profile/schema";
import { CtaStep, NichoStep, TomStep } from "./passos";

export const metadata: Metadata = { title: "Seu perfil · Gravaí" };

const PASSOS = ["nicho", "tom", "cta"] as const;

export default async function PassoPage({ params }: { params: Promise<{ passo: string }> }) {
  const { passo } = await params;
  if (!(PASSOS as readonly string[]).includes(passo)) notFound();

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  const [{ data: profile }, { data: ctas }] = await Promise.all([
    supabase.from("profiles").select("niche, audience, tone, phrases, onboarded").eq("user_id", auth.user.id).maybeSingle(),
    passo === "cta" ? supabase.from("ctas").select("kind, value").eq("user_id", auth.user.id) : Promise.resolve({ data: null }),
  ]);
  const editando = profile?.onboarded === true;

  if (passo === "nicho") {
    return <NichoStep editando={editando} niche={profile?.niche ?? ""} audience={profile?.audience ?? ""} />;
  }
  if (passo === "tom") {
    return (
      <TomStep
        editando={editando}
        tone={isTone(profile?.tone) ? profile.tone : undefined}
        phrases={profile?.phrases ?? ""}
      />
    );
  }
  const valor = (kind: string) => ctas?.find((c) => c.kind === kind)?.value ?? "";
  return (
    <CtaStep
      editando={editando}
      link={valor("link")}
      whatsapp={valor("whatsapp")}
      bio={valor("bio")}
      phone={valor("phone")}
    />
  );
}
