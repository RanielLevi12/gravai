import { IngestError } from "./text";

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export async function extractPptx(file: File): Promise<string> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slides = Object.keys(zip.files)
      .map((name) => ({ name, n: /^ppt\/slides\/slide(\d+)\.xml$/.exec(name)?.[1] }))
      .filter((s): s is { name: string; n: string } => s.n !== undefined)
      .sort((a, b) => Number(a.n) - Number(b.n));
    const parts: string[] = [];
    for (const s of slides) {
      const xml = await zip.files[s.name].async("string");
      const texts = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map((m) => decode(m[1]));
      if (texts.length) parts.push(texts.join(" "));
    }
    return parts.join("\n\n");
  } catch {
    throw new IngestError("Não consegui abrir este arquivo .pptx. Confira se ele não está corrompido.");
  }
}
