import type { SupabaseClient } from "@supabase/supabase-js";
import { AiError, withUserAi, type UserAi } from "@/lib/ai";
import { consumeUsage, quotaMessage, refundUsage } from "@/lib/usage";
import { AI_KINDS, AUDIO_TOO_BIG, MAX_AUDIO_BYTES, SOURCE_KINDS, extractText, inspectAudio, IngestError, validateImages, type SourceKind } from "./index";

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

  const uploaded = form.getAll("files").filter((f): f is File => typeof f !== "string" && f.size > 0);
  const paths = form.getAll("paths").filter((p): p is string => typeof p === "string" && p !== "");
  const text = typeof form.get("text") === "string" ? (form.get("text") as string) : undefined;
  const url = typeof form.get("url") === "string" ? (form.get("url") as string) : undefined;

  if (uploaded.length + paths.length > MAX_FILES)
    return { status: 422, body: { error: `Envie no máximo ${MAX_FILES} arquivos.` } };
  if (kind === "audio" && uploaded.length + paths.length > 1)
    return { status: 422, body: { error: "Envie um áudio por vez." } };
  if ((text?.length ?? 0) > MAX_PASTED_CHARS) return { status: 422, body: { error: "Texto grande demais para colar." } };

  // Arquivos já enviados direto ao Storage: caminho estrito na pasta do próprio usuário.
  const files = [...uploaded];
  const pathRe = new RegExp(`^${userId}/[0-9a-f-]{36}/[^/\\\\]{1,200}$`, "i");
  for (const p of paths) {
    if (p.includes("..") || !pathRe.test(p)) return { status: 422, body: { error: "Arquivo enviado inválido. Tente enviar de novo." } };
    const { data: blob, error } = await supabase.storage.from("sources").download(p);
    if (error || !blob) return { status: 422, body: { error: "Não encontrei o arquivo enviado. Tente enviar de novo." } };
    files.push(new File([blob], p.split("/").pop()!, { type: blob.type }));
  }

  // Limites de tamanho antes de qualquer IA ou cota.
  if (kind === "audio") {
    if (files.some((f) => f.size > MAX_AUDIO_BYTES)) return { status: 422, body: { error: AUDIO_TOO_BIG } };
  } else if (kind === "images") {
    try {
      validateImages(files);
    } catch (e) {
      return { status: 422, body: { error: e instanceof IngestError ? e.message : GENERIC } };
    }
  } else if (files.some((f) => f.size > MAX_FILE_BYTES)) {
    return { status: 422, body: { error: "Arquivo acima de 25 MB. Envie um arquivo menor." } };
  }

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

  let ok: boolean;
  try {
    ok = await consumeUsage(supabase, 1, audioSeconds);
  } catch {
    return { status: 500, body: { error: "Não foi possível criar o projeto agora. Tente de novo." } };
  }
  if (!ok) return { status: 402, body: { error: await quotaMessage(supabase, audioSeconds) } };
  const refund = () => refundUsage(admin, userId, 1, audioSeconds).catch(() => undefined);
  try {
    const r = await extractText({ kind, files, text, url, audioSeconds: kind === "audio" ? audioSeconds : undefined }, ai);
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
