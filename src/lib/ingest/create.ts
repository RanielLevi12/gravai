import type { SupabaseClient } from "@supabase/supabase-js";
import { AiError, withUserAi, type UserAi } from "@/lib/ai";
import { consumeUsage, quotaMessage, refundUsage } from "@/lib/usage";
import { AI_KINDS, SOURCE_KINDS, extractText, inspectAudio, IngestError, type SourceKind } from "./index";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_PASTED_CHARS = 500_000;
const NOT_CONNECTED = "Conecte sua conta de IA para continuar.";
const GENERIC = "Não consegui ler este material. Tente de novo.";

export type CreateResult = { status: 201 | 400 | 402 | 412 | 422 | 500; body: Record<string, unknown> };

function titleFrom(kind: SourceKind, text: string, files: File[]): string {
  const first = text.split("\n").find((l) => l.trim())?.trim() ?? "";
  const base = first || files[0]?.name.replace(/\.[^.]+$/, "") || "Novo projeto";
  return base.length > 60 ? `${base.slice(0, 57)}...` : base;
}

/**
 * Cria o projeto a partir do multipart. Ordem: validar → conexão de IA → duração do áudio →
 * consumir cota → extrair → inserir. Falha depois do consumo devolve a cota.
 * `supabase` = sessão do usuário; `admin` = service role (só para o estorno).
 */
export async function createProject(
  deps: { supabase: SupabaseClient; admin: SupabaseClient; userId: string },
  form: FormData,
): Promise<CreateResult> {
  const { supabase, admin, userId } = deps;
  const kind = String(form.get("kind") ?? "") as SourceKind;
  if (!SOURCE_KINDS.includes(kind)) return { status: 400, body: { error: "Tipo de material inválido." } };

  const files = form.getAll("files").filter((f): f is File => typeof f !== "string" && f.size > 0);
  const text = typeof form.get("text") === "string" ? (form.get("text") as string) : undefined;
  const url = typeof form.get("url") === "string" ? (form.get("url") as string) : undefined;

  if (files.length > MAX_FILES) return { status: 422, body: { error: `Envie no máximo ${MAX_FILES} arquivos.` } };
  if (kind !== "audio" && files.some((f) => f.size > MAX_FILE_BYTES))
    return { status: 422, body: { error: "Arquivo acima de 25 MB. Envie um arquivo menor." } };
  if ((text?.length ?? 0) > MAX_PASTED_CHARS) return { status: 422, body: { error: "Texto grande demais para colar." } };

  // PDF exige conexão de IA de antemão (simples; só o escaneado usaria OCR).
  let ai: UserAi | undefined;
  if (AI_KINDS.includes(kind)) {
    try {
      ai = await withUserAi(userId);
    } catch (e) {
      if (e instanceof AiError && e.code === "not_connected")
        return { status: 412, body: { error: NOT_CONNECTED, code: "not_connected" } };
      return { status: 500, body: { error: "A IA está indisponível no momento. Tente mais tarde." } };
    }
  }

  let audioSeconds = 0;
  if (kind === "audio") {
    const f = files[0];
    if (!f) return { status: 422, body: { error: "Envie um arquivo de áudio." } };
    try {
      audioSeconds = (await inspectAudio(f)).seconds;
    } catch (e) {
      return { status: 422, body: { error: e instanceof IngestError ? e.message : GENERIC } };
    }
  }

  const ok = await consumeUsage(supabase, 1, audioSeconds);
  if (!ok) return { status: 402, body: { error: await quotaMessage(supabase, audioSeconds) } };

  const refund = () => refundUsage(admin, userId, 1, audioSeconds).catch(() => undefined);
  try {
    const r = await extractText({ kind, files, text, url }, ai);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        title: titleFrom(kind, r.text, files),
        source_kind: kind,
        source_text: r.text,
        source_truncated: r.truncated,
        status: "fonte",
      })
      .select("id")
      .single();
    if (error || !data) {
      await refund();
      return { status: 500, body: { error: "Não consegui criar o projeto. Tente de novo." } };
    }
    return { status: 201, body: { id: data.id } };
  } catch (e) {
    await refund();
    const message = e instanceof IngestError ? e.message : e instanceof AiError ? e.userMessage : GENERIC;
    return { status: 422, body: { error: message } };
  }
}
