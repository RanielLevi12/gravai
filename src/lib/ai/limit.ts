import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentMonth } from "@/lib/usage";
import { AiError } from "./schemas";

/** Limite mensal (US$) por usuário na IA do Gravaí. Muda com AI_MONTHLY_LIMIT_USD. */
export const DEFAULT_MONTHLY_LIMIT_USD = 3;
export const MSG_LIMIT = "Você usou toda a IA do Gravaí deste mês. Conecte sua conta de IA no perfil para continuar, ou volte no mês que vem.";
const MAX_ROWS = 5000;

export function monthlyLimitUsd(env: string | undefined = process.env.AI_MONTHLY_LIMIT_USD): number {
  const n = Number(env);
  return env && Number.isFinite(n) && n > 0 ? n : DEFAULT_MONTHLY_LIMIT_USD;
}

/** Quanto este usuário já gastou na chave do servidor neste mês (fuso de São Paulo). */
export async function appSpendThisMonth(userId: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("ai_usage")
    .select("cost_usd")
    .eq("user_id", userId)
    .eq("billed_to", "app")
    .gte("created_at", `${currentMonth()}T00:00:00-03:00`)
    .limit(MAX_ROWS);
  if (error) throw new Error("ai_usage read failed");
  return (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd), 0);
}

/** Recusa antes de gastar quando o usuário já chegou no limite. Se não der para medir, recusa também (protege o gasto). */
export async function assertUnderLimit(userId: string, spend: (id: string) => Promise<number> = appSpendThisMonth, limit = monthlyLimitUsd()): Promise<void> {
  let used: number;
  try {
    used = await spend(userId);
  } catch {
    throw new AiError("A IA está indisponível no momento. Tente mais tarde.", { code: "provider" });
  }
  if (used >= limit) throw new AiError(MSG_LIMIT, { code: "limit_reached" });
}
