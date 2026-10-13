import type { UserAi } from "@/lib/ai";
import { IngestError } from "./text";

export const MAX_IMAGES = 10;
const UNREADABLE = "Não consegui ler esta foto. Tente com mais luz e a página inteira no quadro.";

export async function extractImages(files: File[], ai: UserAi): Promise<string> {
  if (files.length === 0) throw new IngestError("Envie ao menos uma foto.");
  if (files.length > MAX_IMAGES) throw new IngestError(`Envie no máximo ${MAX_IMAGES} fotos por vez.`);
  const images = await Promise.all(
    files.map(async (f) => ({ data: Buffer.from(await f.arrayBuffer()), mediaType: f.type || "image/jpeg" })),
  );
  const text = (await ai.ocrImages(images)).trim();
  if (text.length < 20) throw new IngestError(UNREADABLE);
  return text;
}
