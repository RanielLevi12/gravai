import type { SupabaseClient } from "@supabase/supabase-js";

export const PROJECTS_LIMIT = 5;
export const TRANSCRIPTION_LIMIT_SECONDS = 3600;

export const MSG_PROJECTS_QUOTA = "Você usou seus 5 projetos grátis deste mês.";
export const MSG_AUDIO_QUOTA = "Você usou seus 60 minutos de transcrição deste mês.";

/** Consome a cota do usuário logado (RPC security definer). false = acima do limite. */
export async function consumeUsage(supabase: SupabaseClient, projects: number, seconds: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_usage", { p_projects: projects, p_seconds: Math.ceil(seconds) });
  if (error) throw new Error("consume_usage failed");
  return data === true;
}

/** Devolve a cota (só service_role pode chamar refund_usage). */
export async function refundUsage(admin: SupabaseClient, userId: string, projects: number, seconds: number): Promise<void> {
  await admin.rpc("refund_usage", { p_user: userId, p_projects: projects, p_seconds: Math.ceil(seconds) });
}

/** Qual limite estourou: usado só para escolher a mensagem quando consume_usage recusa. */
export async function quotaMessage(supabase: SupabaseClient, audioSeconds: number): Promise<string> {
  if (audioSeconds <= 0) return MSG_PROJECTS_QUOTA;
  const { data } = await supabase.from("usage_months").select("projects").order("month", { ascending: false }).limit(1).maybeSingle();
  return (data?.projects ?? 0) >= PROJECTS_LIMIT ? MSG_PROJECTS_QUOTA : MSG_AUDIO_QUOTA;
}
