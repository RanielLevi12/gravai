import { describe, expect, it } from "vitest";
import { novoVideoHref, statusLabel } from "@/lib/project/status-label";

describe("statusLabel", () => {
  it("usa só três palavras: Gravar, Editar e Pronto", () => {
    expect(statusLabel("gravacao").label).toBe("Gravar");
    expect(statusLabel("pronto").label).toBe("Pronto");
    for (const s of ["fonte", "entrevista", "script", "gravado", "qualquer-outro"]) expect(statusLabel(s).label).toBe("Editar");
  });

  it("diz o que falta em cada etapa", () => {
    expect(statusLabel("gravado").hint).toMatch(/gerar/);
    expect(statusLabel("script").hint).toMatch(/script/);
  });
});

describe("novoVideoHref", () => {
  it("leva a origem e, se houver, o projeto", () => {
    expect(novoVideoHref("texto", null)).toBe("/novo?origem=texto");
    expect(novoVideoHref("foto", "abc")).toBe("/novo?origem=foto&projeto=abc");
  });
});
