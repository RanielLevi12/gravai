export const MAX_SOURCE_CHARS = 60_000;

/** Erro de ingestão com mensagem em pt-BR segura para mostrar ao usuário. */
export class IngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestError";
  }
}

/** Normaliza quebras de linha, apara e corta em MAX_SOURCE_CHARS. */
export function clip(raw: string): { text: string; truncated: boolean } {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (text.length > MAX_SOURCE_CHARS) return { text: text.slice(0, MAX_SOURCE_CHARS), truncated: true };
  return { text, truncated: false };
}

export function extractPlain(text: string | undefined): string {
  const t = (text ?? "").trim();
  if (!t) throw new IngestError("Cole o texto que você quer transformar em vídeo.");
  return t;
}

export async function readTxt(file: File): Promise<string> {
  return new TextDecoder("utf-8").decode(await file.arrayBuffer());
}
