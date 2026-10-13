import type { SupabaseClient } from "@supabase/supabase-js";
import { isCtaKind, type CtaInput } from "./schema";

export type StoredCta = { id: string } & CtaInput;

export type CtaSyncPlan = {
  /** Linhas que continuam (mesmo id), com os valores novos. */
  updates: { id: string; row: CtaInput }[];
  inserts: CtaInput[];
  /** Só as que o usuário realmente tirou. */
  deletes: string[];
};

/**
 * Compara os CTAs salvos com a lista nova e mantém os ids de quem ficou (a entrevista guarda o id
 * escolhido). Casa primeiro por tipo + rótulo e depois por tipo; o que sobra é novo ou removido.
 */
export function planCtaSync(existing: StoredCta[], next: CtaInput[]): CtaSyncPlan {
  const free = [...existing].sort((a, b) => a.id.localeCompare(b.id));
  const matched: (StoredCta | null)[] = next.map(() => null);
  const take = (n: number, pred: (c: StoredCta) => boolean) => {
    const at = free.findIndex(pred);
    if (at >= 0) matched[n] = free.splice(at, 1)[0];
  };
  next.forEach((row, n) => take(n, (c) => c.kind === row.kind && (c.label ?? "") === row.label));
  next.forEach((row, n) => {
    if (!matched[n]) take(n, (c) => c.kind === row.kind);
  });

  const updates: CtaSyncPlan["updates"] = [];
  const inserts: CtaInput[] = [];
  next.forEach((row, n) => {
    const m = matched[n];
    if (!m) inserts.push(row);
    else if (m.label !== row.label || m.value !== row.value) updates.push({ id: m.id, row });
  });
  return { updates, inserts, deletes: free.map((c) => c.id) };
}

/** Grava a lista nova no banco do usuário pelo plano acima. Lança Error com mensagem em pt-BR se algo falhar. */
export async function syncCtas(supabase: SupabaseClient, userId: string, rows: CtaInput[]): Promise<void> {
  const fail = () => new Error("Não foi possível salvar os links.");
  const { data: antigos, error: lerErro } = await supabase.from("ctas").select("id, kind, label, value").eq("user_id", userId);
  if (lerErro) throw fail();
  const plan = planCtaSync(
    (antigos ?? []).flatMap((c) => (isCtaKind(c.kind) ? [{ id: c.id as string, kind: c.kind, label: (c.label as string | null) ?? "", value: (c.value as string | null) ?? "" }] : [])),
    rows,
  );

  for (const u of plan.updates) {
    const { error } = await supabase.from("ctas").update(u.row).eq("id", u.id);
    if (error) throw fail();
  }
  if (plan.inserts.length > 0) {
    const { error } = await supabase.from("ctas").insert(plan.inserts.map((r) => ({ ...r, user_id: userId })));
    if (error) throw fail();
  }
  if (plan.deletes.length > 0) {
    const { error } = await supabase.from("ctas").delete().in("id", plan.deletes);
    if (error) throw fail();
  }
}
