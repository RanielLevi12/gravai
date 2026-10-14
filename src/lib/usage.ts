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
  const { error } = await admin.rpc("refund_usage", { p_user: userId, p_projects: projects, p_seconds: Math.ceil(seconds) });
  if (error) console.error("[usage] refund_usage falhou", error.code ?? "", error.message);
}

/**
 * Confere (sem consumir) se ainda cabe 1 projeto + `seconds` de transcrição. Serve para recusar cedo,
 * antes de gastar IA; quem consome de verdade é o banco (`create_project`), de forma atômica.
 */
export async function quotaFits(supabase: SupabaseClient, seconds: number): Promise<boolean> {
  const { data } = await supabase
    .from("usage_months")
    .select("projects, transcription_seconds")
    .eq("month", currentMonth())
    .maybeSingle();
  if (!data) return true;
  return data.projects + 1 <= PROJECTS_LIMIT && data.transcription_seconds + Math.ceil(seconds) <= TRANSCRIPTION_LIMIT_SECONDS;
}

/** Primeiro dia do mês corrente em America/Sao_Paulo (mesma regra da migração 0002). */
export function currentMonth(now = new Date()): string {
  return `${now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7)}-01`;
}

/** Qual limite estourou: usado só para escolher a mensagem quando consume_usage recusa. */
export async function quotaMessage(supabase: SupabaseClient, audioSeconds: number): Promise<string> {
  if (audioSeconds <= 0) return MSG_PROJECTS_QUOTA;
  const { data } = await supabase.from("usage_months").select("projects").eq("month", currentMonth()).maybeSingle();
  return (data?.projects ?? 0) >= PROJECTS_LIMIT ? MSG_PROJECTS_QUOTA : MSG_AUDIO_QUOTA;
}
