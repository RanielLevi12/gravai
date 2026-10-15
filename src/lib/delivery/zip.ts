import JSZip from "jszip";
import { PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/interview/steps";
import type { Descriptions } from "@/lib/script/generate";
import { exportFileName } from "./rules";
import { MSG_FILE_NOT_FOUND, MSG_PROJECT_NOT_FOUND, type DeliveryDb } from "./service";

export const MSG_ZIP_TOO_BIG = "Os arquivos são grandes demais para um .zip. Baixe um por um.";
/** O zip é montado em memória: até 4 vídeos de 50 MB. */
export const MAX_ZIP_BYTES = 4 * 50 * 1024 * 1024;

export class ZipError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 413,
  ) {
    super(message);
  }
}

/** Um bloco por corte e por plataforma, com título e descrição. */
export function descriptionsText(cuts: { title: string; descriptions: Descriptions }[], platforms: readonly Platform[]): string {
  if (cuts.length === 0) return "Sem cortes.";
  return cuts
    .map((cut, i) => {
      const head = `Corte ${i + 1}${cut.title ? ` · ${cut.title}` : ""}`;
      const blocks = platforms.filter((p) => cut.descriptions[p]).map((p) => `${PLATFORM_LABELS[p]}\n${cut.descriptions[p]}`);
      return [head, ...blocks].join("\n\n");
    })
    .join("\n\n----------\n\n");
}

export async function buildZip(files: { name: string; data: Uint8Array }[], descriptions: string): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  zip.file("descricoes.txt", descriptions);
  return zip.generateAsync({ type: "uint8array", compression: "STORE" });
}

/** Zip de tudo que o usuário pode ver do projeto (a RLS limita ao dono). */
export async function zipFor(db: DeliveryDb, projectId: string): Promise<Uint8Array> {
  const project = await db.project(projectId);
  if (!project) throw new ZipError(MSG_PROJECT_NOT_FOUND, 404);
  const [rows, cuts] = await Promise.all([db.exportsOf(projectId), db.cuts(projectId)]);
  if (rows.length === 0) throw new ZipError(MSG_FILE_NOT_FOUND, 404);
  if (rows.reduce((sum, r) => sum + r.sizeBytes, 0) > MAX_ZIP_BYTES) throw new ZipError(MSG_ZIP_TOO_BIG, 413);

  const files: { name: string; data: Uint8Array }[] = [];
  for (const r of rows) {
    const index = r.cutId === null ? null : cuts.findIndex((c) => c.id === r.cutId) + 1;
    if (index === 0) continue; // corte que já não existe
    const name = exportFileName(r.kind, index, r.mime === "image/jpeg" ? "jpg" : "mp4");
    files.push({ name, data: await db.download(r.storagePath) });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  return buildZip(files, descriptionsText(cuts, PLATFORMS));
}
