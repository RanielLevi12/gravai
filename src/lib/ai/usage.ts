import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AiUsage } from "./usage-types";


/** Guarda o custo de uma chamada de IA. Nunca falha a chamada: erro vira só um aviso no log. */
export async function recordAiUsage(userId: string, u: AiUsage): Promise<void> {
  if (!Number.isFinite(u.costUsd) || u.costUsd < 0) return;
  try {
    const { error } = await createAdminClient().from("ai_usage").insert({
      user_id: userId,
      kind: u.kind,
      model: u.model.slice(0, 100),
      cost_usd: u.costUsd,
      prompt_tokens: u.promptTokens ?? null,
      completion_tokens: u.completionTokens ?? null,
      ...(u.billedTo === "app" ? { billed_to: "app" } : {}),
    });
    if (error) console.warn("[ai] não consegui guardar o custo da chamada");
  } catch {
    console.warn("[ai] não consegui guardar o custo da chamada");
  }
}
