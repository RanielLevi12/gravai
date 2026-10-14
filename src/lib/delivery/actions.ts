"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseDeliveryDb } from "./db";
import { MSG_ALREADY_RUNNING, MSG_NOT_RECORDED, MSG_PROJECT_NOT_FOUND, createRenderJobWith, type JobView } from "./service";
import { wakeWorker } from "./trigger";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MSG_EXPIRED = "Sua sessão expirou. Entre de novo.";
const MSG_UNAVAILABLE = "Não foi possível agora. Tente de novo.";
const SAFE = new Set([MSG_ALREADY_RUNNING, MSG_NOT_RECORDED, MSG_PROJECT_NOT_FOUND]);

export type ActionError = { error: string };

function failure(e: unknown): ActionError {
  console.error("[delivery] ação falhou", e instanceof Error ? e.message : e);
  return { error: e instanceof Error && SAFE.has(e.message) ? e.message : MSG_UNAVAILABLE };
}

async function sessionDb() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabaseDeliveryDb({ supabase }) : null;
}

export async function createRenderJob(projectId: string): Promise<{ jobId: string } | ActionError> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { error: MSG_PROJECT_NOT_FOUND };
  const db = await sessionDb();
  if (!db) return { error: MSG_EXPIRED };
  try {
    const res = await createRenderJobWith(db, projectId);
    await wakeWorker();
    revalidatePath("/(app)/projetos/[id]/entrega", "page");
    return res;
  } catch (e) {
    return failure(e);
  }
}

export async function getJobStatus(projectId: string): Promise<{ job: JobView | null } | ActionError> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { error: MSG_PROJECT_NOT_FOUND };
  const db = await sessionDb();
  if (!db) return { error: MSG_EXPIRED };
  try {
    return { job: await db.latestJob(projectId) };
  } catch (e) {
    return failure(e);
  }
}
