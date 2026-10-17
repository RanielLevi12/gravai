import { stat } from "node:fs/promises";
import path from "node:path";
import { progress } from "./claim";
import { makeCover } from "./covers";
import { UserError } from "./errors";
import { probe } from "./ffmpeg";
import type { JobContext } from "./jobs";
import { encodeFrom } from "./encode";
import { must, sizeOk } from "./render";
import { download, upload } from "./storage";

const MSG_BAD_RANGE = "Início e fim do corte não são válidos.";
const MIN_CUT_SECONDS = 1;
const MAX_CUT_SECONDS = 180;

/** Refaz o vídeo e a capa de um corte a partir do final.mp4 já gerado, com início e fim escolhidos à mão. */
export async function recutCut(ctx: JobContext): Promise<void> {
  const { db, job, workdir } = ctx;
  const { cutId, start, end } = job.payload as { cutId?: unknown; start?: unknown; end?: unknown };
  if (typeof cutId !== "string" || typeof start !== "number" || typeof end !== "number") throw new UserError(MSG_BAD_RANGE);
  const seconds = end - start;
  if (!(start >= 0) || !(seconds >= MIN_CUT_SECONDS - 1e-6) || seconds > MAX_CUT_SECONDS + 1e-6) throw new UserError(MSG_BAD_RANGE);

  await progress(ctx.db, job.id, "preparando", 5);
  const projectId = job.project_id;
  const project = must(await db.from("projects").select("cuts").eq("id", projectId).single(), "ler projeto");
  const cut = (Array.isArray(project.cuts) ? project.cuts : []).find((c) => (c as { id?: unknown })?.id === cutId) as { title?: string } | undefined;
  if (!cut) throw new UserError("Corte não encontrado.");

  const rows = must(await db.from("exports").select("id, kind, cut_id, storage_path, duration_seconds, expires_at").eq("project_id", projectId), "ler arquivos");
  const final = rows.find((r) => r.kind === "final");
  if (!final) throw new UserError("Gere os vídeos antes de ajustar um corte.");
  if (end > Number(final.duration_seconds ?? 0) + 0.05) throw new UserError(MSG_BAD_RANGE);

  const finalFile = path.join(workdir, "final.mp4");
  await download(db, "exports", final.storage_path, finalFile);
  const real = (await probe(finalFile)).duration;
  if (end > real + 0.05) throw new UserError(MSG_BAD_RANGE);

  await progress(db, job.id, "cortando", 30);
  const cutFile = path.join(workdir, "corte.mp4");
  await encodeFrom(finalFile, cutFile, { start, seconds });
  const cutSize = await sizeOk(cutFile);

  await progress(db, job.id, "capas", 60);
  const coverFile = path.join(workdir, "capa.jpg");
  await makeCover(finalFile, start + Math.min(1, seconds / 2), cut.title ?? "", coverFile);

  await progress(db, job.id, "enviando", 80);
  const dir = `${job.user_id}/${projectId}`;
  const cutPath = `${dir}/${crypto.randomUUID()}.mp4`;
  const coverPath = `${dir}/${crypto.randomUUID()}.jpg`;
  const old = rows.filter((r) => r.cut_id === cutId);
  try {
    await upload(db, cutPath, cutFile, "video/mp4");
    await upload(db, coverPath, coverFile, "image/jpeg");
    if (old.length > 0) {
      const del = await db.from("exports").delete().eq("project_id", projectId).eq("cut_id", cutId);
      if (del.error) throw new Error(`apagar linhas antigas: ${del.error.message}`);
    }
    const base = { user_id: job.user_id, project_id: projectId, cut_id: cutId, expires_at: final.expires_at };
    const ins = await db.from("exports").insert([
      { ...base, kind: "cut", storage_path: cutPath, mime: "video/mp4", duration_seconds: seconds, size_bytes: cutSize, start_seconds: start, end_seconds: end },
      { ...base, kind: "cover", storage_path: coverPath, mime: "image/jpeg", duration_seconds: null, size_bytes: (await stat(coverFile)).size, start_seconds: null, end_seconds: null },
    ]);
    if (ins.error) throw new Error(`gravar arquivos: ${ins.error.message}`);
  } catch (e) {
    await db.storage.from("exports").remove([cutPath, coverPath]).catch(() => {});
    throw e;
  }
  if (old.length > 0) {
    const gone = await db.storage.from("exports").remove(old.map((o) => o.storage_path));
    if (gone.error) console.error("[worker] não consegui apagar arquivos antigos:", gone.error.message);
  }
}
