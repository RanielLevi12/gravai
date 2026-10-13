import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.AI_MOCK = "1";

import { withUserAi } from "@/lib/ai";
import { getMockCalls, resetMock, setMockResponse } from "@/lib/ai/mock";
import { MAX_AUDIO_BYTES, MAX_SOURCE_CHARS, extractText } from "@/lib/ingest";

const fx = (name: string) => fs.readFileSync(path.join(process.cwd(), "tests/fixtures/ingest", name));
const file = (name: string, type: string) => new File([new Uint8Array(fx(name))], name, { type });

let ai: Awaited<ReturnType<typeof withUserAi>>;
beforeEach(async () => {
  resetMock();
  ai = await withUserAi("u1");
});
afterEach(() => vi.unstubAllGlobals());

describe("extractText", () => {
  it("texto colado", async () => {
    const r = await extractText({ kind: "text", text: "  Olá mundo  " }, ai);
    expect(r).toEqual({ text: "Olá mundo", truncated: false });
  });

  it("docx traz a frase marcadora", async () => {
    const r = await extractText({ kind: "docx", files: [file("sample.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")] }, ai);
    expect(r.text).toContain("Marcador docx 123");
  });

  it("pptx lê os slides em ordem numérica (1, 2, 10)", async () => {
    const r = await extractText({ kind: "pptx", files: [file("sample.pptx", "application/octet-stream")] }, ai);
    expect(r.text).toContain("Marcador pptx 456");
    const order = ["slide um", "Slide dois", "Slide dez"].map((s) => r.text.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("pdf de texto não chama OCR", async () => {
    const r = await extractText({ kind: "pdf", files: [file("sample-text.pdf", "application/pdf")] }, ai);
    expect(r.text).toContain("Marcador pdf 789");
    expect(getMockCalls("ocrPdf")).toBe(0);
  });

  it("pdf escaneado chama ocrPdf", async () => {
    setMockResponse("ocrPdf", "Texto do OCR do PDF escaneado, com mais de vinte caracteres.");
    const r = await extractText({ kind: "pdf", files: [file("sample-scanned.pdf", "application/pdf")] }, ai);
    expect(getMockCalls("ocrPdf")).toBe(1);
    expect(r.text).toContain("OCR do PDF escaneado");
  });

  it("imagens usam ocrImages", async () => {
    setMockResponse("ocrImages", "Texto longo o bastante lido da foto.");
    const r = await extractText({ kind: "images", files: [file("page.jpg", "image/jpeg")] }, ai);
    expect(getMockCalls("ocrImages")).toBe(1);
    expect(r.text).toBe("Texto longo o bastante lido da foto.");
  });

  it("foto ilegível rejeita com a mensagem do produto", async () => {
    setMockResponse("ocrImages", "");
    await expect(extractText({ kind: "images", files: [file("blank.jpg", "image/jpeg")] }, ai)).rejects.toThrow(
      "Não consegui ler esta foto. Tente com mais luz e a página inteira no quadro.",
    );
  });

  it("corta em 60.000 caracteres e avisa", async () => {
    const r = await extractText({ kind: "text", text: "a".repeat(70_000) }, ai);
    expect(r.text.length).toBe(MAX_SOURCE_CHARS);
    expect(r.truncated).toBe(true);
  });

  it("áudio acima de 25 MB é recusado sem transcrever", async () => {
    const big = new File([new Uint8Array(MAX_AUDIO_BYTES + 1)], "grande.mp3", { type: "audio/mpeg" });
    await expect(extractText({ kind: "audio", files: [big] }, ai)).rejects.toThrow("Áudio acima de 25 MB");
    expect(getMockCalls("transcribeAudio")).toBe(0);
  });

  it("áudio válido: transcreve e devolve a duração lida do arquivo", async () => {
    const r = await extractText({ kind: "audio", files: [file("ideia.mp3", "audio/mpeg")] }, ai);
    expect(getMockCalls("transcribeAudio")).toBe(1);
    expect(r.audioSeconds).toBeGreaterThanOrEqual(3);
    expect(r.audioSeconds).toBeLessThan(4);
  });

  it("áudio ilegível/webm: mensagem de formato, sem transcrever", async () => {
    const bad = new File([new Uint8Array([1, 2, 3, 4])], "voz.webm", { type: "audio/webm" });
    await expect(extractText({ kind: "audio", files: [bad] }, ai)).rejects.toThrow("Formato de áudio não suportado");
    expect(getMockCalls("transcribeAudio")).toBe(0);
  });

  it("gdocs sem id", async () => {
    await expect(extractText({ kind: "gdocs", url: "https://exemplo.com/x" }, ai)).rejects.toThrow("Link do Google Docs inválido");
  });

  it("gdocs privado (HTML de login) pede link público", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!DOCTYPE html><html>login</html>", { status: 200, headers: { "content-type": "text/html" } })));
    await expect(extractText({ kind: "gdocs", url: "https://docs.google.com/document/d/abc123/edit" }, ai)).rejects.toThrow("Esse documento não está público");
  });

  it("gdocs público", async () => {
    const f = vi.fn(async (_u: string) => new Response("Texto do documento público", { status: 200, headers: { "content-type": "text/plain" } }));
    vi.stubGlobal("fetch", f);
    const r = await extractText({ kind: "gdocs", url: "https://docs.google.com/document/d/abc123/edit" }, ai);
    expect(r.text).toBe("Texto do documento público");
    expect(String(f.mock.calls[0][0])).toBe("https://docs.google.com/document/d/abc123/export?format=txt");
  });

  it("gdocs com /u/0/ no caminho", async () => {
    const f = vi.fn(async (_u: string) => new Response("ok texto", { status: 200, headers: { "content-type": "text/plain" } }));
    vi.stubGlobal("fetch", f);
    await extractText({ kind: "gdocs", url: "https://docs.google.com/document/u/0/d/xyz_9-A/edit" }, ai);
    expect(String(f.mock.calls[0][0])).toBe("https://docs.google.com/document/d/xyz_9-A/export?format=txt");
  });

  it("foto HEIC e foto acima de 10 MB são recusadas", async () => {
    const heic = new File([new Uint8Array(10)], "foto.heic", { type: "image/heic" });
    await expect(extractText({ kind: "images", files: [heic] }, ai)).rejects.toThrow("Formato HEIC não suportado");
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "g.jpg", { type: "image/jpeg" });
    await expect(extractText({ kind: "images", files: [big] }, ai)).rejects.toThrow("Foto acima de 10 MB");
    expect(getMockCalls("ocrImages")).toBe(0);
  });
});
