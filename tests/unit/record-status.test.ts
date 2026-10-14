import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectRow } from "@/components/project/ProjectRow";
import { hasScript } from "@/lib/interview/steps";

describe("status gravado", () => {
  it("conta como já tendo script", () => {
    expect(hasScript("gravado")).toBe(true);
  });

  it("a linha do projeto mostra Gravado e o botão Ver", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectRow, {
        project: { id: "11111111-2222-3333-4444-555555555555", title: "Meu vídeo", status: "gravado", source_kind: "text", interview: {} },
      }),
    );
    expect(html).toContain("Gravado");
    expect(html).toContain("Vídeo guardado");
    expect(html).toContain("Ver");
  });
});
