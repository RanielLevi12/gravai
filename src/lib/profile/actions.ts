"use server";

import { createServerClient } from "@/lib/supabase/server";
import { normalizeCtas, normalizeProfile } from "./schema";
import type { CtaKind, Tone } from "./schema";

export type { CtaKind, Tone };

async function requireUser() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sessão expirada. Entre de novo.");
  return { supabase, userId: data.user.id };
}

/**
 * Cria o perfil no primeiro salvamento (upsert por user_id) e depois só atualiza
 * os campos enviados. Não há trigger em auth.users.
 */
export async function saveProfile(input: {
  niche?: string;
  audience?: string;
  tone?: Tone;
  phrases?: string;
  onboarded?: boolean;
}): Promise<void> {
  const row = normalizeProfile(input);
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("profiles").upsert({ user_id: userId, ...row }, { onConflict: "user_id" });
  if (error) throw new Error("Não foi possível salvar o perfil.");
}

/** Substitui os CTAs do usuário: insere os novos e só então remove os antigos. */
export async function saveCtas(ctas: { kind: CtaKind; label: string; value: string }[]): Promise<void> {
  const rows = normalizeCtas(ctas);
  const { supabase, userId } = await requireUser();

  const { data: antigos, error: lerErro } = await supabase.from("ctas").select("id").eq("user_id", userId);
  if (lerErro) throw new Error("Não foi possível salvar os links.");

  if (rows.length > 0) {
    const { error } = await supabase.from("ctas").insert(rows.map((r) => ({ ...r, user_id: userId })));
    if (error) throw new Error("Não foi possível salvar os links.");
  }

  const ids = (antigos ?? []).map((c) => c.id);
  if (ids.length > 0) {
    const { error } = await supabase.from("ctas").delete().in("id", ids);
    if (error) throw new Error("Não foi possível salvar os links.");
  }
}
