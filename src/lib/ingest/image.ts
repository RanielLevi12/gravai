import type { UserAi } from "@/lib/ai";
import { IngestError } from "./text";

export const MAX_IMAGES = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const HEIC = "Formato HEIC não suportado. No iPhone, use Ajustes › Câmera › Formatos › Mais compatível.";

/** Limites por foto, checados antes de qualquer chamada de IA. */
export function validateImages(files: File[]): void {
  for (const f of files) {
    if (/hei[cf]$/i.test(f.name) || /hei[cf]/i.test(f.type)) throw new IngestError(HEIC);
    if (f.size > MAX_IMAGE_BYTES) throw new IngestError("Foto acima de 10 MB. Envie uma foto menor.");
  }
}
const UNREADABLE = "Não consegui ler esta foto. Tente com mais luz e a página inteira no quadro.";

export async function extractImages(files: File[], ai: UserAi): Promise<string> {
  if (files.length === 0) throw new IngestError("Envie ao menos uma foto.");
  if (files.length > MAX_IMAGES) throw new IngestError(`Envie no máximo ${MAX_IMAGES} fotos por vez.`);
  validateImages(files);
  const images = await Promise.all(
    files.map(async (f) => ({ data: Buffer.from(await f.arrayBuffer()), mediaType: f.type || "image/jpeg" })),
  );
  const text = (await ai.ocrImages(images)).trim();
  if (text.length < 20) throw new IngestError(UNREADABLE);
  return text;
}
