import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { progress } from "./claim";
import { alignBlocks } from "./align";
import { makeCover } from "./covers";
import { UserError } from "./errors";
import { probe, run } from "./ffmpeg";
import type { JobContext } from "./jobs";
import { encodeFrom, masterArgs } from "./encode";
import { MAX_FILE_BYTES, blockRanges, cutRange, expiresAt, missingBlocks, type Range } from "./plan";
import { download, upload } from "./storage";
import { transcribeViaApp } from "./transcribe";

/** Corte 9:16 central quando a gravação não traz o retângulo: o mesmo que o preview (object-fit: cover) mostra. */
const CENTER_CROP = "crop=trunc(min(iw\\,ih*9/16)/2)*2:trunc(min(ih\\,iw*16/9)/2)*2";
const TO_FULL_HD = "scale=1080:1920:flags=lanczos,setsar=1";

export type Crop = { x: number; y: number; w: number; h: number };

/** Lê o corte salvo na gravação; qualquer coisa fora do formato vira nulo (corte central). */
export function parseCrop(raw: unknown): Crop | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const { x, y, w, h } = o;
  if (![x, y, w, h].every((n) => Number.isInteger(n))) return null;
  const c = { x, y, w, h } as Crop;
  return c.x >= 0 && c.y >= 0 && c.w > 0 && c.h > 0 ? c : null;
}

/** Recorta (nunca enche de barras) e só então ajusta para 1080×1920, para o vídeo final sair igual ao preview. */
export function framingFilter(crop: Crop | null, width: number, height: number): string {
  const fits = crop && width > 0 && height > 0 && crop.x + crop.w <= width && crop.y + crop.h <= height;
  const cut = fits ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}` : CENTER_CROP;
  return `${cut},${TO_FULL_HD}`;
}
const MIN_ALIGN_CONFIDENCE = 0.7;
const MSG_CHECK_CUTS = "Confira o início e o fim dos cortes.";
export const MSG_TOO_BIG = "O vídeo ficou grande demais (mais de 500 MB). Grave por blocos mais curtos.";

type Cut = { id: string; start: number; end: number; title: string };
type NewExport = {
  kind: "final" | "cut" | "cover";
  cut_id: string | null;
  storage_path: string;
  mime: string;
  duration_seconds: number | null;
  size_bytes: number;
  start_seconds: number | null;
  end_seconds: number | null;
};

export function must<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error || res.data === null || res.data === undefined) throw new Error(`${what}: ${res.error?.message ?? "vazio"}`);
  return res.data as NonNullable<T>;
}

const isCut = (c: unknown): c is Cut => {
  const o = c as Record<string, unknown> | null;
  return !!o && typeof o.id === "string" && Number.isInteger(o.start) && Number.isInteger(o.end) && typeof o.title === "string";
};

/** Vídeo do bloco → intermediário 1080×1920, 30 fps, H.264 (CRF 16) + AAC, volume uniforme (sem áudio ganha silêncio). */
export async function normalize(input: string, output: string, crop: Crop | null): Promise<void> {
  const { hasAudio, width, height } = await probe(input);
  const args = ["-y", "-i", input];
  if (!hasAudio) args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  args.push("-vf", framingFilter(crop, width, height), "-map", "0:v:0", "-map", hasAudio ? "0:a:0" : "1:a:0");
  if (hasAudio) args.push("-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000");
  args.push("-shortest", ...masterArgs(), output);
  await run(args);
}

export async function sizeOk(file: string): Promise<number> {
  const { size } = await stat(file);
  if (size > MAX_FILE_BYTES) throw new UserError(MSG_TOO_BIG);
  return size;
}

/** Gravações (por blocos ou take único) → vídeo final, um vídeo e uma capa por corte, tudo no bucket `exports`. */
export async function renderProject(ctx: JobContext): Promise<{ warning?: string }> {
  const { db, job, workdir } = ctx;
  const projectId = job.project_id;
  await progress(db, job.id, "preparando", 5);

  const project = must(await db.from("projects").select("cuts").eq("id", projectId).single(), "ler projeto");
  const blocks = must(await db.from("script_blocks").select("id, position, text").eq("project_id", projectId).order("position"), "ler blocos");
  const recs = must(
    await db.from("recordings").select("id, kind, block_id, storage_path, duration_seconds, crop").eq("project_id", projectId).eq("status", "ready"),
    "ler gravações",
  );

  if (blocks.length === 0) throw new UserError("O script não tem blocos para gerar.");
  if (recs.some((r) => r.kind === "external")) {
    throw new UserError("Por enquanto só dá para gerar vídeos de gravações feitas no app (por blocos ou take único).");
  }
  const takes = recs.filter((r) => r.kind === "take");
  if (takes.length > 0 && takes.length < recs.length) {
    throw new UserError("Há gravação por blocos e take único ao mesmo tempo. Grave de novo usando só um dos modos.");
  }

  const cuts = (Array.isArray(project.cuts) ? project.cuts : []).filter(isCut).sort((a, b) => a.start - b.start);

  // O intermediário (CRF 16) é a fonte do final e dos cortes: cada um é codificado uma única vez a partir dele.
  const { masterFile, ranges, warning } = takes.length > 0 ? await prepareTake(ctx, blocks, takes[0]) : await prepareBlocks(ctx, blocks, recs);
  await progress(db, job.id, "juntando", 48);
  const finalFile = path.join(workdir, "final.mp4");
  await encodeFrom(masterFile, finalFile);
  const finalSize = await sizeOk(finalFile);

  // 3. Um vídeo e uma capa por corte.
  const outputs: { row: NewExport; file: string }[] = [
    {
      file: finalFile,
      row: { kind: "final", cut_id: null, storage_path: "", mime: "video/mp4", duration_seconds: (await probe(finalFile)).duration, size_bytes: finalSize, start_seconds: null, end_seconds: null },
    },
  ];
  for (const [k, cut] of cuts.entries()) {
    await progress(db, job.id, "cortando", 50 + (30 * k) / cuts.length);
    let range;
    try {
      range = cutRange(ranges, cut);
    } catch (e) {
      throw new UserError((e as Error).message);
    }
    const seconds = range.endSeconds - range.startSeconds;
    const cutFile = path.join(workdir, `corte-${k}.mp4`);
    await encodeFrom(masterFile, cutFile, { start: range.startSeconds, seconds });
    outputs.push({
      file: cutFile,
      row: { kind: "cut", cut_id: cut.id, storage_path: "", mime: "video/mp4", duration_seconds: seconds, size_bytes: await sizeOk(cutFile), start_seconds: range.startSeconds, end_seconds: range.endSeconds },
    });

    await progress(db, job.id, "capas", 80 + (10 * k) / cuts.length);
    const coverFile = path.join(workdir, `capa-${k}.jpg`);
    await makeCover(masterFile, range.startSeconds + Math.min(1, seconds / 2), cut.title, coverFile);
    outputs.push({
      file: coverFile,
      row: { kind: "cover", cut_id: cut.id, storage_path: "", mime: "image/jpeg", duration_seconds: null, size_bytes: (await stat(coverFile)).size, start_seconds: null, end_seconds: null },
    });
  }

  // 4. Subir os novos e só então trocar as linhas e apagar os arquivos antigos.
  await progress(db, job.id, "enviando", 92);
  const old = must(await db.from("exports").select("id, storage_path").eq("project_id", projectId), "ler arquivos antigos");
  const uploaded: string[] = [];
  const expires = expiresAt(new Date()).toISOString();
  try {
    for (const o of outputs) {
      o.row.storage_path = `${job.user_id}/${projectId}/${crypto.randomUUID()}.${o.row.mime === "image/jpeg" ? "jpg" : "mp4"}`;
      await upload(db, o.row.storage_path, o.file, o.row.mime);
      uploaded.push(o.row.storage_path);
    }
    if (old.length > 0) {
      const del = await db.from("exports").delete().eq("project_id", projectId);
      if (del.error) throw new Error(`apagar linhas antigas: ${del.error.message}`);
    }
    const ins = await db.from("exports").insert(outputs.map((o) => ({ ...o.row, user_id: job.user_id, project_id: projectId, expires_at: expires })));
    if (ins.error) throw new Error(`gravar arquivos: ${ins.error.message}`);
  } catch (e) {
    await db.storage.from("exports").remove(uploaded).catch(() => {});
    throw e;
  }
  if (old.length > 0) {
    const gone = await db.storage.from("exports").remove(old.map((o) => o.storage_path));
    if (gone.error) console.error("[worker] não consegui apagar arquivos antigos:", gone.error.message);
  }

  const done = await db.from("projects").update({ status: "pronto" }).eq("id", projectId);
  if (done.error) throw new Error(`marcar projeto pronto: ${done.error.message}`);
  return warning ? { warning } : {};
}

type Block = { id: string; position: number; text: string };
type Rec = { id: string; kind: string; block_id: string | null; storage_path: string; duration_seconds: unknown; crop?: unknown };
type Prepared = { masterFile: string; ranges: Range[]; warning?: string };

/** Por blocos: padroniza cada gravação e junta na ordem do script; o tempo de cada bloco é o da sua gravação. */
async function prepareBlocks({ db, job, workdir }: JobContext, blocks: Block[], recs: Rec[]): Promise<Prepared> {
  const byBlock = new Map(recs.map((r) => [r.block_id as string, r]));
  const missing = missingBlocks(blocks.map((b) => b.id), new Set(byBlock.keys()));
  if (missing.length > 0) throw new UserError(`Faltam gravações nos blocos: ${missing.join(", ")}.`);

  const normalized: string[] = [];
  for (const [i, block] of blocks.entries()) {
    await progress(db, job.id, "juntando", 10 + (35 * i) / blocks.length);
    const rec = byBlock.get(block.id)!;
    const raw = path.join(workdir, `raw-${i}${path.extname(rec.storage_path)}`);
    const norm = path.join(workdir, `bloco-${i}.mp4`);
    await download(db, "recordings", rec.storage_path, raw);
    await normalize(raw, norm, parseCrop(rec.crop));
    normalized.push(norm);
  }

  const durations = await Promise.all(normalized.map(async (f) => (await probe(f)).duration));
  const list = path.join(workdir, "lista.txt");
  await writeFile(list, normalized.map((f) => `file '${f}'`).join("\n"));
  const masterFile = path.join(workdir, "master.mp4");
  await run(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", masterFile]);
  return { masterFile, ranges: blockRanges(durations) };
}

/** Take único: padroniza o vídeo e descobre onde cada bloco foi falado, pela transcrição com tempos. */
async function prepareTake({ db, job, workdir, deps }: JobContext, blocks: Block[], rec: Rec): Promise<Prepared> {
  await progress(db, job.id, "juntando", 15);
  const raw = path.join(workdir, `take${path.extname(rec.storage_path)}`);
  const masterFile = path.join(workdir, "master.mp4");
  await download(db, "recordings", rec.storage_path, raw);
  await normalize(raw, masterFile, parseCrop(rec.crop));
  const duration = (await probe(masterFile)).duration;

  await progress(db, job.id, "transcrevendo", 35);
  const audio = path.join(workdir, "audio.mp3");
  await run(["-y", "-i", masterFile, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", audio]);
  const words = await (deps?.transcribe ?? transcribeViaApp)({ audioFile: audio, jobId: job.id, recordingId: rec.id });

  const { ranges, confidence } = alignBlocks(blocks.map((b) => b.text), words);
  const clamped = ranges.map((r) => ({ startSeconds: Math.min(duration, Math.max(0, r.startSeconds)), endSeconds: Math.min(duration, Math.max(0, r.endSeconds)) }));
  return { masterFile, ranges: clamped, warning: confidence < MIN_ALIGN_CONFIDENCE ? MSG_CHECK_CUTS : undefined };
}
