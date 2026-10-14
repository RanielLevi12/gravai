import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentMonth } from "@/lib/usage";
import { getUserAiKey } from "./keys";

export type CostSummary = {
  connected: boolean;
  /** Gasto neste mês (dólares), pelas chamadas que o Gravaí fez. */
  monthUsd: number;
  /** Custo da última chamada de IA (dólares). */
  lastUsd: number | null;
  /** Saldo na conta OpenRouter (dólares); null se o OpenRouter não informou. */
  balanceUsd: number | null;
};

const OPENROUTER = "https://openrouter.ai/api/v1";

async function getJson(path: string, key: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${OPENROUTER}${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5_000), cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: Record<string, unknown> };
    return body.data ?? null;
  } catch {
    return null;
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Saldo: o que sobra do limite da chave; sem limite, o que sobra dos créditos da conta (se o OpenRouter deixar ler). */
export async function fetchBalanceUsd(key: string, get: typeof getJson = getJson): Promise<number | null> {
  const info = await get("/key", key);
  const remaining = num(info?.limit_remaining);
  if (remaining !== null) return Math.max(0, remaining);
  const credits = await get("/credits", key);
  const total = num(credits?.total_credits);
  const used = num(credits?.total_usage);
  return total !== null && used !== null ? Math.max(0, total - used) : null;
}

/** Resumo para a barra de custos. `supabase` = sessão do usuário (RLS: só as linhas dele). */
export async function loadCostSummary(supabase: SupabaseClient, userId: string): Promise<CostSummary> {
  const mock = process.env.AI_MOCK === "1" && process.env.NODE_ENV !== "production";
  const { data: conn } = await supabase.from("ai_connections").select("key_hint").eq("user_id", userId).maybeSingle();
  const connected = Boolean(conn) || mock;
  if (!connected) return { connected: false, monthUsd: 0, lastUsd: null, balanceUsd: null };

  const monthStart = new Date(`${currentMonth()}T00:00:00-03:00`).toISOString();
  const [{ data: rows }, { data: last }] = await Promise.all([
    supabase.from("ai_usage").select("cost_usd").eq("user_id", userId).gte("created_at", monthStart).limit(10_000),
    supabase.from("ai_usage").select("cost_usd").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const monthUsd = (rows ?? []).reduce((sum, r) => sum + Number(r.cost_usd), 0);

  let balanceUsd: number | null = null;
  if (!mock) {
    const key = await getUserAiKey(userId).catch(() => null);
    if (key) balanceUsd = await fetchBalanceUsd(key);
  }
  return { connected, monthUsd, lastUsd: last ? Number(last.cost_usd) : null, balanceUsd };
}
