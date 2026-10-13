// Regenera os fixtures binários: `node tests/fixtures/ingest/generate.mjs` (precisa de ffmpeg no PATH).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import sharp from "sharp";

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = (n) => path.join(dir, n);

// docx
{
  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Marcador docx 123</w:t></w:r></w:p><w:p><w:r><w:t>Segundo parágrafo do documento.</w:t></w:r></w:p></w:body></w:document>`);
  fs.writeFileSync(out("sample.docx"), await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

// pptx: slides 1, 10, 2 gravados nessa ordem para pegar ordenação lexicográfica
{
  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`);
  const slide = (t) => `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  z.file("ppt/slides/slide1.xml", slide("Marcador pptx 456 slide um"));
  z.file("ppt/slides/slide10.xml", slide("Slide dez"));
  z.file("ppt/slides/slide2.xml", slide("Slide dois"));
  fs.writeFileSync(out("sample.pptx"), await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

// pdf mínimo
function pdf(content) {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offs) body += `${String(o).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
const lines = ["Marcador pdf 789", ...Array.from({ length: 8 }, (_, i) => `Linha ${i + 1} de texto de exemplo para passar de duzentos caracteres.`)];
const textContent = "BT /F1 12 Tf 50 740 Td 16 TL " + lines.map((l) => `(${l}) Tj T*`).join(" ") + " ET";
fs.writeFileSync(out("sample-text.pdf"), pdf(textContent));
fs.writeFileSync(out("sample-scanned.pdf"), pdf("0.9 g 50 50 500 700 re f"));

// imagens
const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#fff"/><text x="20" y="100" font-size="28">Texto da pagina</text></svg>`);
await sharp(text).jpeg().toFile(out("page.jpg"));
await sharp({ create: { width: 64, height: 64, channels: 3, background: "#000" } }).jpeg().toFile(out("blank.jpg"));

// áudio de ~3 s
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-codec:a", "libmp3lame", "-b:a", "32k", out("ideia.mp3")]);
