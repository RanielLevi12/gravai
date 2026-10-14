import type { SupabaseClient } from "@supabase/supabase-js";
import type { CtaOption, FolderFormValues } from "@/components/folders/FolderForm";
import { DEFAULT_SETTINGS, isFolderColor, type FolderColor, type FolderSettings } from "./schema";

const KIND_LABEL: Record<string, string> = { link: "Link", bio: "Link da bio", whatsapp: "WhatsApp", phone: "Telefone" };

/** Chamadas (CTAs) do usuário, com um rótulo legível mesmo quando ele não deu nome. */
export async function loadCtas(supabase: SupabaseClient, userId: string): Promise<CtaOption[]> {
  const { data } = await supabase.from("ctas").select("id, kind, label, value").eq("user_id", userId).order("id");
  return (data ?? []).map((c) => ({
    id: c.id as string,
    label: (c.label as string | null)?.trim() || `${KIND_LABEL[c.kind as string] ?? "Chamada"}${c.value ? `: ${c.value}` : ""}`,
  }));
}

export type FolderRow = { id: string; name: string; color: string; about: string | null; settings: unknown };

/** Completa o que faltar com os valores sugeridos (projetos antigos ou editados à mão no banco). */
export function toSettings(raw: unknown): FolderSettings {
  const r = raw && typeof raw === "object" ? (raw as Partial<FolderSettings>) : {};
  return { ...DEFAULT_SETTINGS, ...r, scenery: { ...DEFAULT_SETTINGS.scenery, ...(r.scenery ?? {}) } };
}

export function toFormValues(f: FolderRow): FolderFormValues {
  return {
    name: f.name,
    color: (isFolderColor(f.color) ? f.color : "rosa") as FolderColor,
    about: f.about ?? "",
    settings: toSettings(f.settings),
  };
}
