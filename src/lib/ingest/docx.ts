import { IngestError } from "./text";

export async function extractDocx(file: File): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) });
    return value;
  } catch {
    throw new IngestError("Não consegui abrir este arquivo .docx. Confira se ele não está corrompido.");
  }
}
