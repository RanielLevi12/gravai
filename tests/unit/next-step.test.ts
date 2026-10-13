import { describe, expect, it } from "vitest";
import { nextStepHref } from "@/lib/project/next-step";

const id = "11111111-2222-3333-4444-555555555555";

describe("nextStepHref", () => {
  it("fonte → revisão do texto", () => {
    expect(nextStepHref({ id, status: "fonte", interview: {} })).toBe(`/projetos/${id}/fonte`);
  });

  it("entrevista sem passo salvo → plataformas", () => {
    expect(nextStepHref({ id, status: "entrevista", interview: {} })).toBe(`/projetos/${id}/entrevista/plataformas`);
    expect(nextStepHref({ id, status: "entrevista", interview: null })).toBe(`/projetos/${id}/entrevista/plataformas`);
  });

  it("entrevista retoma o passo atual", () => {
    expect(nextStepHref({ id, status: "entrevista", interview: { current: "duracao" } })).toBe(`/projetos/${id}/entrevista/duracao`);
  });

  it("passo atual inválido cai em plataformas", () => {
    expect(nextStepHref({ id, status: "entrevista", interview: { current: "../x" } })).toBe(`/projetos/${id}/entrevista/plataformas`);
    expect(nextStepHref({ id, status: "entrevista", interview: { current: 3 } })).toBe(`/projetos/${id}/entrevista/plataformas`);
  });

  it("script, gravação e pronto", () => {
    expect(nextStepHref({ id, status: "script", interview: {} })).toBe(`/projetos/${id}/script`);
    expect(nextStepHref({ id, status: "gravacao", interview: {} })).toBe(`/projetos/${id}/gravar`);
    expect(nextStepHref({ id, status: "pronto", interview: {} })).toBe(`/projetos/${id}`);
  });
});
