import { describe, expect, it } from "vitest";
import { formatMaxVideo, formatWords, kindForFile, kindForFiles, safeFileName } from "@/lib/project/source";

const f = (name: string, type = "") => ({ name, type });

describe("project source helpers", () => {
  it("tipo pelo nome do arquivo", () => {
    expect(kindForFile(f("Aula.DOCX"))).toBe("docx");
    expect(kindForFile(f("foto", "image/jpeg"))).toBe("images");
    expect(kindForFile(f("x.zip", "application/zip"))).toBeNull();
  });

  it("vários arquivos só se forem imagens", () => {
    expect(kindForFiles([f("a.jpg"), f("b.png")])).toBe("images");
    expect(kindForFiles([f("a.pdf"), f("b.pdf")])).toBe("misto");
    expect(kindForFiles([])).toBeNull();
  });

  it("nome seguro para o Storage", () => {
    expect(safeFileName("Capítulo 3 / final?.pdf")).toBe("Capitulo-3-final-.pdf");
    expect(safeFileName("../../etc")).toBe("etc");
    expect(safeFileName("ação")).toBe("acao");
    expect(safeFileName("???")).toBe("arquivo");
    expect(safeFileName(`${"a".repeat(300)}.docx`).length).toBeLessThanOrEqual(120);
  });

  it("contagem e duração", () => {
    const t = Array.from({ length: 300 }, () => "x").join(" ");
    expect(formatWords(t)).toBe("300 palavras");
    expect(formatWords("uma")).toBe("1 palavra");
    expect(formatMaxVideo(t)).toBe("dá até ~4 min de vídeo");
    expect(formatMaxVideo("dez palavras só aqui")).toBe("dá até ~4 s de vídeo");
  });
});
