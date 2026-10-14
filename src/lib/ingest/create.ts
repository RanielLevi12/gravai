import type { SupabaseClient } from "@supabase/supabase-js";
import { AiError, withUserAi, type UserAi } from "@/lib/ai";
import { toSettings } from "@/lib/folders/queries";
import { mainDurationOptions } from "@/lib/rules/duration";
import { quotaFits, quotaMessage } from "@/lib/usage";
import { AI_KINDS, AUDIO_TOO_BIG, MAX_AUDIO_BYTES, SOURCE_KINDS, extractText, inspectAudio, IngestError, validateImages, type SourceKind } from "./index";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_PASTED_CHARS = 500_000;
const NOT_CONNECTED = "Conecte sua conta de IA para continuar.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC = "Não consegui ler este material. Tente de novo.";

export type CreateResult = { status: 201 | 400 | 402 | 412 | 422 | 500; body: Record<string, unknown> };

function titleFrom(kind: SourceKind, text: string, files: File[]): string {
  const first = text.split("\n").find((l) => l.trim())?.trim() ?? "";
  const base = first || files[0]?.name.replace(/\.[^.]+$/, "") || "Novo projeto";
  return base.length > 60 ? `${base.slice(0, 57)}...` : base;
}

/**
 * Cria o projeto a partir do multipart. Ordem: validar → conexão de IA → duração do áudio →
 * conferir cota → extrair → criar. A cota só é consumida dentro de `create_project` (função do banco,
 * na mesma transação do insert): se a extração ou a criação falharem, nada foi consumido.
 * `supabase` = sessão do usuário (único caminho para inserir em `projects`).
 */
export async function createProject(
  deps: { supabase: SupabaseClient; userId: string },
  form: FormData,
): Promise<CreateResult> {
  const { supabase, userId } = deps;
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
  const folderField = form.get("folder_id");
  const folderId = typeof folderField === "string" && UUID.test(folderField) ? folderField : null;
  if (folderField && !folderId) return { status: 400, body: { error: "Projeto inválido." } };
  // Projeto de outra pessoa (ou apagado) não existe para o usuário: RLS devolve nada.
  let folderSettings: ReturnType<typeof toSettings> | null = null;
  if (folderId) {
    const { data } = await supabase.from("folders").select("settings").eq("id", folderId).maybeSingle();
    if (!data) return { status: 422, body: { error: "Não encontrei esse projeto." } };
    folderSettings = toSettings(data.settings);
  }

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

  // Recusa cedo (antes de gastar IA); a conferência definitiva é a do banco, mais abaixo.
  try {
    if (!(await quotaFits(supabase, audioSeconds))) return { status: 402, body: { error: await quotaMessage(supabase, audioSeconds) } };
  } catch {
    return { status: 500, body: { error: "Não foi possível criar o projeto agora. Tente de novo." } };
  }
  try {
    const r = await extractText({ kind, files, text, url, audioSeconds: kind === "audio" ? audioSeconds : undefined }, ai);
    const { data, error } = await supabase.rpc("create_project", {
      p_title: titleFrom(kind, r.text, files),
      p_source_kind: kind,
      p_source_text: r.text,
      p_source_truncated: r.truncated,
      p_seconds: Math.ceil(audioSeconds),
      ...(folderId ? { p_folder_id: folderId } : {}),
    });
    if (error) return { status: 500, body: { error: "Não consegui criar o projeto. Tente de novo." } };
    // null = a cota estourou entre a conferência e a criação (outra aba, por exemplo).
    if (!data) return { status: 402, body: { error: await quotaMessage(supabase, audioSeconds) } };
    if (folderSettings) await dropDurationThatDoesNotFit(supabase, data, folderSettings.mainSeconds, r.text);
    return { status: 201, body: { id: data } };
  } catch (e) {
    const message = e instanceof IngestError ? e.message : e instanceof AiError ? e.userMessage : GENERIC;
    return { status: 422, body: { error: message } };
  }
}

/**
 * O vídeo copiou a duração do projeto, mas o texto pode ser curto demais para ela. Nesse caso a
 * duração (e o corte, que depende dela) saem da cópia e a entrevista volta a perguntar.
 * Falha aqui não derruba a criação: o vídeo já existe e a cota já foi usada.
 */
async function dropDurationThatDoesNotFit(supabase: SupabaseClient, id: string, mainSeconds: number, sourceText: string) {
  if (mainDurationOptions(sourceText).some((o) => o.seconds === mainSeconds && o.enabled)) return;
  try {
    const { data } = await supabase.from("projects").select("interview").eq("id", id).maybeSingle();
    const interview = { ...((data?.interview as Record<string, unknown> | null) ?? {}) };
    delete interview.mainSeconds;
    delete interview.cutSeconds;
    await supabase.from("projects").update({ interview }).eq("id", id);
  } catch (e) {
    console.error("[projetos] não consegui ajustar a duração herdada", e instanceof Error ? e.message : e);
  }
}
