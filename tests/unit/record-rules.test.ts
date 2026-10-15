import { describe, expect, it } from "vitest";
import { allowedModes, canApprove, recordingsInOrder } from "@/lib/record/rules";

describe("allowedModes", () => {
  it("take só até 3 min", () => {
    expect(allowedModes(180)).toContain("take");
    expect(allowedModes(300)).toEqual(["blocks", "external"]);
  });
});

describe("canApprove", () => {
  const blockIds = ["a", "b", "c", "d"];
  it("take com gravação pronta", () => {
    expect(
      canApprove({ mode: "take", ready: [{ kind: "take", blockId: null }], blockIds }),
    ).toEqual({ ok: true });
  });
  it("take sem nada", () => {
    expect(canApprove({ mode: "take", ready: [], blockIds })).toEqual({
      ok: false,
      error: "Grave o vídeo antes de aprovar.",
    });
  });
  it("blocos: falta 1", () => {
    const ready = ["a", "b", "c"].map((id) => ({ kind: "block" as const, blockId: id }));
    expect(canApprove({ mode: "blocks", ready, blockIds })).toEqual({
      ok: false,
      error: "Falta gravar 1 bloco.",
    });
  });
  it("blocos: faltam vários", () => {
    const ready = [{ kind: "block" as const, blockId: "a" }];
    expect(canApprove({ mode: "blocks", ready, blockIds })).toEqual({
      ok: false,
      error: "Faltam gravar 3 blocos.",
    });
  });
  it("blocos: todos prontos", () => {
    const ready = blockIds.map((id) => ({ kind: "block" as const, blockId: id }));
    expect(canApprove({ mode: "blocks", ready, blockIds })).toEqual({ ok: true });
  });
  it("externo com 1", () => {
    expect(
      canApprove({ mode: "external", ready: [{ kind: "external", blockId: null }], blockIds }),
    ).toEqual({ ok: true });
  });
  it("externo sem nada", () => {
    expect(canApprove({ mode: "external", ready: [], blockIds })).toEqual({
      ok: false,
      error: "Envie o vídeo antes de aprovar.",
    });
  });
  it("modo take só com blocos prontos", () => {
    const ready = [{ kind: "block" as const, blockId: "a" }];
    expect(canApprove({ mode: "take", ready, blockIds })).toEqual({
      ok: false,
      error: "Grave o vídeo antes de aprovar.",
    });
  });
});

describe("recordingsInOrder", () => {
  const blocks = [
    { id: "a", label: "Abertura" },
    { id: "b", label: "Trecho 1" },
  ];
  it("blocos na ordem do script, a mais nova de cada bloco", () => {
    const ready = [
      { id: "r3", kind: "block" as const, blockId: "a", createdAt: "2026-10-15T10:00:00Z" },
      { id: "r1", kind: "block" as const, blockId: "b", createdAt: "2026-10-15T09:00:00Z" },
      { id: "r2", kind: "block" as const, blockId: "a", createdAt: "2026-10-15T08:00:00Z" },
    ];
    expect(recordingsInOrder(ready, blocks).map((r) => [r.id, r.label])).toEqual([
      ["r3", "Abertura"],
      ["r1", "Trecho 1"],
    ]);
  });
  it("take único: só o mais novo", () => {
    const ready = [
      { id: "t1", kind: "take" as const, blockId: null, createdAt: "2026-10-15T08:00:00Z" },
      { id: "t2", kind: "take" as const, blockId: null, createdAt: "2026-10-15T09:00:00Z" },
    ];
    expect(recordingsInOrder(ready, blocks).map((r) => [r.id, r.label])).toEqual([["t2", "Vídeo inteiro"]]);
  });
  it("vídeo enviado", () => {
    const ready = [{ id: "e1", kind: "external" as const, blockId: null, createdAt: "2026-10-15T08:00:00Z" }];
    expect(recordingsInOrder(ready, blocks).map((r) => r.label)).toEqual(["Vídeo enviado"]);
  });
  it("sem gravações", () => {
    expect(recordingsInOrder([], blocks)).toEqual([]);
  });
});
