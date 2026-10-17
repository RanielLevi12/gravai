"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { parseCrop } from "./capture";
import { supabaseRecordDb } from "./db";
import type { RecordMode } from "./rules";
import {
  MSG_ALREADY_SENT,
  MSG_EMPTY_VIDEO,
  MSG_BLOCK_NOT_FOUND,
  MSG_PROJECT_NOT_FOUND,
  MSG_RECORDING_NOT_FOUND,
  approveWith,
  discardRecordingWith,
  finishRecordingWith,
  startRecordingWith,
} from "./service";
import { MSG_FILE_TOO_BIG, MSG_STORAGE_FULL } from "./limits";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MSG_EXPIRED = "Sua sessão expirou. Entre de novo.";
const MSG_UNAVAILABLE = "Não foi possível agora. Tente de novo.";
const SAFE = new Set([
  MSG_ALREADY_SENT,
  MSG_EMPTY_VIDEO,
  MSG_BLOCK_NOT_FOUND,
  MSG_PROJECT_NOT_FOUND,
  MSG_RECORDING_NOT_FOUND,
  MSG_FILE_TOO_BIG,
  MSG_STORAGE_FULL,
  "Para um vídeo de 5 min, grave por blocos.",
  "Formato de vídeo não aceito.",
]);

export type ActionError = { error: string };

function failure(e: unknown): ActionError {
  console.error("[record] ação falhou", e instanceof Error ? e.message : e);
  return { error: e instanceof Error && SAFE.has(e.message) ? e.message : MSG_UNAVAILABLE };
}

async function sessionUser() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, userId: data.user.id } : null;
}

const KINDS = ["take", "block", "external"] as const;
const MODES = ["take", "blocks", "external"] as const;

export async function startRecording(input: {
  projectId: string;
  kind: "take" | "block" | "external";
  blockId: string | null;
  mime: string;
  crop?: unknown;
}): Promise<{ id: string; path: string } | ActionError> {
  if (!input || typeof input.projectId !== "string" || !UUID.test(input.projectId)) return { error: MSG_PROJECT_NOT_FOUND };
  if (!KINDS.includes(input.kind) || typeof input.mime !== "string") return { error: MSG_UNAVAILABLE };
  if (input.blockId !== null && (typeof input.blockId !== "string" || !UUID.test(input.blockId))) return { error: MSG_BLOCK_NOT_FOUND };
  const s = await sessionUser();
  if (!s) return { error: MSG_EXPIRED };
  try {
    return await startRecordingWith(supabaseRecordDb(s), {
      projectId: input.projectId,
      kind: input.kind,
      blockId: input.blockId ?? null,
      mime: input.mime,
      crop: parseCrop(input.crop),
    });
  } catch (e) {
    return failure(e);
  }
}

export async function finishRecording(
  id: string,
  v: { sizeBytes: number; durationSeconds: number | null },
): Promise<{ ok: true } | ActionError> {
  if (typeof id !== "string" || !UUID.test(id)) return { error: MSG_RECORDING_NOT_FOUND };
  if (!v || typeof v.sizeBytes !== "number" || (v.durationSeconds !== null && typeof v.durationSeconds !== "number")) return { error: MSG_UNAVAILABLE };
  const s = await sessionUser();
  if (!s) return { error: MSG_EXPIRED };
  try {
    await finishRecordingWith(supabaseRecordDb(s), id, v);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function discardRecording(id: string): Promise<{ ok: true } | ActionError> {
  if (typeof id !== "string" || !UUID.test(id)) return { error: MSG_RECORDING_NOT_FOUND };
  const s = await sessionUser();
  if (!s) return { error: MSG_EXPIRED };
  try {
    await discardRecordingWith(supabaseRecordDb(s), id);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function approveRecording(projectId: string, mode: RecordMode): Promise<{ ok: true } | ActionError> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { error: MSG_PROJECT_NOT_FOUND };
  if (!MODES.includes(mode)) return { error: MSG_UNAVAILABLE };
  const s = await sessionUser();
  if (!s) return { error: MSG_EXPIRED };
  try {
    const res = await approveWith(supabaseRecordDb(s), projectId, mode);
    if (!res.ok) return { error: res.error };
    revalidatePath("/(app)/projetos", "page");
    revalidatePath("/(app)/projetos/[id]/gravar", "page");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
