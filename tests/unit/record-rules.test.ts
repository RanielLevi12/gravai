import { describe, expect, it } from "vitest";
import { allowedModes, canApprove } from "@/lib/record/rules";

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
