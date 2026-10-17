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

  it("gravando por blocos: 'Faltam N partes' mesmo com o status ainda em script", () => {
    expect(statusLabel("script", 6)).toEqual({ label: "Gravar", hint: "Faltam 6 partes para gravar" });
    expect(statusLabel("gravacao", 1).hint).toBe("Falta 1 parte para gravar");
    expect(statusLabel("script", 0).label).toBe("Editar");
  });
});

describe("novoVideoHref", () => {
  it("leva a origem e, se houver, o projeto", () => {
    expect(novoVideoHref("texto", null)).toBe("/novo?origem=texto");
    expect(novoVideoHref("foto", "abc")).toBe("/novo?origem=foto&projeto=abc");
  });
});
