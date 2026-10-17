import { describe, expect, it } from "vitest";
import { labelBlocks, joinNames, missingBlocks, missingPartsCount, nextMissing } from "@/lib/record/missing";
import { canApprove } from "@/lib/record/rules";
import { statusLabel } from "@/lib/project/status-label";

const rows = [
  { id: "a", kind: "opening", cut_index: null },
  { id: "b", kind: "body", cut_index: null },
  { id: "c", kind: "body", cut_index: null },
  { id: "d", kind: "body", cut_index: null },
  { id: "e", kind: "closing", cut_index: null },
];
const blocks = labelBlocks(rows);

describe("nomes dos blocos", () => {
  it("numera só os trechos", () => {
    expect(blocks.map((b) => b.label)).toEqual(["Abertura", "Trecho 1", "Trecho 2", "Trecho 3", "Fechamento"]);
  });
});

describe("blocos que faltam", () => {
  it("lista na ordem do script", () => {
    expect(missingBlocks(blocks, { a: true, c: true }).map((b) => b.label)).toEqual(["Trecho 1", "Trecho 3", "Fechamento"]);
  });
  it("nada falta → lista vazia", () => {
    expect(missingBlocks(blocks, new Set(["a", "b", "c", "d", "e"]))).toEqual([]);
  });
  it("junta os nomes com vírgula e 'e'", () => {
    expect(joinNames(["Trecho 2"])).toBe("Trecho 2");
    expect(joinNames(["Trecho 2", "Trecho 3"])).toBe("Trecho 2 e Trecho 3");
    expect(joinNames(["Abertura", "Trecho 2", "Fechamento"])).toBe("Abertura, Trecho 2 e Fechamento");
  });
});

describe("próximo bloco", () => {
  it("é o primeiro que falta depois do que acabou de gravar", () => {
    expect(nextMissing(blocks, { a: true, b: true }, "b")?.label).toBe("Trecho 2");
  });
  it("pula os já gravados", () => {
    expect(nextMissing(blocks, { a: true, b: true, c: true }, "b")?.label).toBe("Trecho 3");
  });
  it("não sobrou nenhum depois: volta ao primeiro que falta", () => {
    expect(nextMissing(blocks, { b: true, c: true, d: true, e: true }, "e")?.label).toBe("Abertura");
  });
  it("sem referência, o primeiro que falta", () => {
    expect(nextMissing(blocks, { a: true })?.label).toBe("Trecho 1");
  });
  it("tudo gravado → null", () => {
    expect(nextMissing(blocks, new Set(["a", "b", "c", "d", "e"]), "e")).toBeNull();
  });
});

describe("canApprove com nomes", () => {
  const ready = (ids: string[]) => ids.map((id) => ({ kind: "block" as const, blockId: id }));
  const input = { mode: "blocks" as const, blockIds: rows.map((r) => r.id), blockLabels: blocks.map((b) => b.label) };
  it("diz qual falta", () => {
    expect(canApprove({ ...input, ready: ready(["a", "b", "c", "e"]) })).toEqual({ ok: false, error: "Falta gravar: Trecho 3." });
  });
  it("diz quais faltam", () => {
    expect(canApprove({ ...input, ready: ready(["a", "e"]) })).toEqual({ ok: false, error: "Faltam gravar: Trecho 1, Trecho 2 e Trecho 3." });
  });
});

describe("status 'faltam N partes'", () => {
  it("conta só quando já gravou algum bloco", () => {
    expect(missingPartsCount(["a", "b", "c"], ["a"])).toBe(2);
    expect(missingPartsCount(["a", "b", "c"], [])).toBeNull();
    expect(missingPartsCount(["a", "b"], ["x", null])).toBeNull();
    expect(missingPartsCount(["a", "b"], ["a", "b"])).toBe(0);
  });
  it("aparece na tela inicial", () => {
    expect(statusLabel("gravacao", 2)).toEqual({ label: "Gravar", hint: "Faltam 2 partes para gravar" });
    expect(statusLabel("gravacao", 1).hint).toBe("Falta 1 parte para gravar");
  });
  it("sem partes faltando mantém o texto de sempre", () => {
    expect(statusLabel("gravacao", null).hint).toBe("Script pronto, falta gravar");
    expect(statusLabel("gravacao", 0).hint).toBe("Script pronto, falta gravar");
    expect(statusLabel("pronto", 3).hint).toBe("Vídeos prontos para baixar");
  });
});
