import { beforeEach, describe, expect, it } from "vitest";
import * as mockProvider from "@/lib/ai/mock";
import { getMockCalls, resetMock, setMockResponse } from "@/lib/ai/mock";
import { userAiFrom } from "@/lib/ai";
import { conclusaoCtaAgent, ctaObjective } from "@/lib/ai/agents/conclusao-cta";
import { contextBlock, styleLines } from "@/lib/ai/agents/contexto";
import { cortesCtaAgent, normalizePointers, withPointer } from "@/lib/ai/agents/cortes-cta";
import { pickBest } from "@/lib/ai/agents/escolher";
import { GUIA_ROTEIRO, GUIA_SEM_SLOP } from "@/lib/ai/agents/guia";
import { hooksAgent } from "@/lib/ai/agents/hooks";
import { findSlop, slopScore } from "@/lib/ai/agents/slop";
import { titulosAgent } from "@/lib/ai/agents/titulos";

const ai = () => userAiFrom(mockProvider);
const ctx = { sourceText: "Um texto sobre hábitos de dois minutos.", platforms: ["reels" as const], mainSeconds: 60 };

beforeEach(() => resetMock());

describe("detector de cara de IA", () => {
  it.each([
    "Você sabia que isso importa?",
    "Neste vídeo eu vou mostrar",
    "Vamos mergulhar nessa jornada",
    "É importante ressaltar que sim",
    "Isso não é apenas uma dica, é uma revolução",
    "Tem um travessão — aqui",
    "E é isso, pessoal",
  ])("pega: %s", (t) => expect(findSlop(t).length).toBeGreaterThan(0));

  it("deixa passar fala limpa e concreta", () => {
    expect(findSlop("Faltavam 5 minutos pro culto e o som morreu. Eu tinha um cabo reserva na bolsa.")).toEqual([]);
    expect(slopScore("Quem responde em 5 minutos fecha 9 vezes mais venda que quem responde em 1 hora.")).toBe(0);
  });

  it("nota por 100 palavras sobe com os vícios", () => {
    expect(slopScore("Vamos mergulhar. Você sabia que sim?")).toBeGreaterThan(3);
  });

  it("o guia carregado nos prompts traz a lista proibida e as estruturas", () => {
    for (const w of ["Você sabia que", "Neste vídeo", "mergulhar", "jornada"]) expect(GUIA_SEM_SLOP).toContain(w);
    expect(GUIA_ROTEIRO).toContain("E / Mas / Portanto");
    expect(GUIA_ROTEIRO.length).toBeLessThan(12_000);
  });
});

describe("pickBest", () => {
  const types = ["a", "b", "c", "d"] as const;
  const scoreBy = (m: Record<string, number>) => async (texts: string[]) => texts.map((t) => m[t] ?? 0);

  it("marca a melhor e põe primeiro", async () => {
    const r = await pickBest({
      types,
      generate: async () => [{ type: "a", text: "um" }, { type: "b", text: "dois" }, { type: "c", text: "três" }],
      score: scoreBy({ um: 0.6, dois: 0.9, três: 0.7 }),
    });
    expect(r.map((o) => [o.text, o.best])).toEqual([["dois", true], ["três", false], ["um", false]]);
  });

  it("descarta tipo repetido, tipo inválido e texto repetido", async () => {
    const r = await pickBest({
      types,
      generate: async () => [
        { type: "a", text: "um" },
        { type: "a", text: "outro do mesmo tipo" },
        { type: "z", text: "tipo que não existe" },
        { type: "b", text: "UM" },
        { type: "c", text: "três" },
      ],
      score: scoreBy({ um: 0.8, três: 0.8 }),
    });
    expect(r.map((o) => o.type).sort()).toEqual(["a", "c"]);
  });

  it("refaz só o fraco, uma vez, e troca se a nova for melhor", async () => {
    const calls: unknown[] = [];
    const r = await pickBest({
      types,
      generate: async ({ redo }) => {
        calls.push(redo ?? null);
        return redo
          ? [{ type: "c", text: "terceira nova" }]
          : [{ type: "a", text: "um" }, { type: "b", text: "dois" }, { type: "c", text: "terceira velha" }];
      },
      score: scoreBy({ um: 0.9, dois: 0.8, "terceira velha": 0.1, "terceira nova": 0.7 }),
    });
    expect(calls).toEqual([null, { types: ["c"], problem: expect.stringContaining("c: ficou genérica") }]);
    expect(r.map((o) => o.text)).toEqual(["um", "dois", "terceira nova"]);
  });

  it("não troca por uma nova que também é fraca, e não refaz de novo", async () => {
    let n = 0;
    const r = await pickBest({
      types,
      generate: async () => (n++ === 0 ? [{ type: "a", text: "fraca" }] : [{ type: "b", text: "ainda pior" }]),
      score: scoreBy({ fraca: 0.3, "ainda pior": 0.1 }),
    });
    expect(n).toBe(2);
    expect(r.map((o) => o.text)).toEqual(["fraca"]);
  });

  it("opção com vício de IA nunca é a melhor se há outra limpa, e é refeita", async () => {
    const r = await pickBest({
      types,
      generate: async ({ redo }) =>
        redo
          ? [{ type: "a", text: "Faltavam 5 minutos pro culto" }]
          : [{ type: "a", text: "Vamos mergulhar nessa jornada" }, { type: "b", text: "Testei 12 aberturas" }],
      score: scoreBy({ "Vamos mergulhar nessa jornada": 0.95, "Testei 12 aberturas": 0.7, "Faltavam 5 minutos pro culto": 0.8 }),
    });
    expect(r[0]).toMatchObject({ text: "Faltavam 5 minutos pro culto", best: true });
    expect(r.some((o) => o.text.includes("mergulhar"))).toBe(false);
  });

  it("falha na segunda rodada mantém a primeira", async () => {
    let n = 0;
    const r = await pickBest({
      types,
      generate: async () => {
        if (n++ > 0) throw new Error("caiu");
        return [{ type: "a", text: "fraca" }];
      },
      score: scoreBy({ fraca: 0.3 }),
    });
    expect(r.map((o) => o.text)).toEqual(["fraca"]);
  });

  it("sem nenhuma opção válida é erro", async () => {
    await expect(pickBest({ types, generate: async () => [{ type: "z", text: "x" }], score: scoreBy({}) })).rejects.toThrow();
  });
});

describe("agentes com o mock", () => {
  it("títulos: 3 tipos diferentes com nota, o melhor primeiro", async () => {
    setMockResponse("scoreViral", [[0.4, 0.9, 0.6]]);
    const r = await titulosAgent({ ai: ai(), score: mockProvider.scoreViral }, ctx);
    expect(r).toHaveLength(3);
    expect(new Set(r.map((o) => o.type)).size).toBe(3);
    expect(r[0].best).toBe(true);
    expect(r.filter((o) => o.best)).toHaveLength(1);
    expect(r[0].score).toBe(0.9);
  });

  it("ganchos: fala, texto na tela e imagem", async () => {
    const r = await hooksAgent({ ai: ai(), score: async (t) => t.map((_, i) => [0.5, 0.9, 0.6][i]) }, ctx);
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ best: true, score: 0.9 });
    expect(r[0].text).toBeTruthy();
    expect(r[0].onScreen).toBeTruthy();
    expect(r[0].visual).toBeTruthy();
  });

  it("fecho: conclusão e CTA juntos, nota do jev e o melhor marcado", async () => {
    setMockResponse("scoreClosing", [[0.5, 0.95, 0.7]]);
    const r = await conclusaoCtaAgent({ ai: ai(), score: mockProvider.scoreClosing }, { ctx, scriptBody: "abertura e corpo", cta: null });
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ best: true, score: 0.95 });
    expect(r[0].text).toBe(`${r[0].conclusion} ${r[0].cta}`);
    expect(getMockCalls("scoreClosing")).toBe(1);
  });
});

describe("objetivo do CTA", () => {
  it("vem do CTA salvo e nunca pede o contato na fala", () => {
    expect(ctaObjective({ kind: "whatsapp", label: null, value: "11999990000" })).toMatch(/WhatsApp.*sem falar número/);
    expect(ctaObjective({ kind: "bio", label: "Instagram", value: "@gravai" })).toMatch(/link da bio/);
    expect(ctaObjective({ kind: "link", label: "Loja", value: "https://x" })).toMatch(/"Loja".*descrição/);
    expect(ctaObjective({ kind: "phone", label: null, value: "1133334444" })).toMatch(/telefone/);
  });
  it("sem CTA salvo, pede uma ação simples", () => {
    expect(ctaObjective(null)).toMatch(/Sem contato salvo/);
    expect(ctaObjective({ kind: "link", label: null, value: "  " })).toMatch(/Sem contato salvo/);
  });
});

describe("estilo do projeto", () => {
  it("vale mais que o perfil e traz os exemplos", () => {
    const lines = styleLines({ tone: "serio", audience: "geral" }, { tone: "acolhedor", examples: "Gente, vem comigo." }, "canal de fé");
    const text = lines.join("\n");
    expect(text).toContain("Tom de voz: acolhedor");
    expect(text).not.toContain("serio");
    expect(text).toContain("Público: geral");
    expect(text).toContain("Gente, vem comigo.");
    expect(text).toContain("canal de fé");
  });
  it("o contexto inclui o texto-fonte entre aspas, ou não", () => {
    expect(contextBlock(ctx)).toContain("Texto-fonte:");
    expect(contextBlock(ctx, { withSource: false })).not.toContain("Texto-fonte");
  });
});

describe("CTA dos cortes", () => {
  it("valida o destino: corte inexistente, o próprio corte, link e vício voltam para o vídeo principal", () => {
    const raw = {
      pointers: [
        { index: 1, target: "corte" as const, targetIndex: 9, line: "Veja o outro corte." },
        { index: 2, target: "corte" as const, targetIndex: 2, line: "Veja o outro corte." },
        { index: 3, target: "principal" as const, targetIndex: null, line: "Tudo em https://x.com/video" },
        { index: 4, target: "principal" as const, targetIndex: null, line: "Vamos mergulhar no vídeo completo." },
        { index: 5, target: "corte" as const, targetIndex: 1, line: "A parte 1 mostra o começo da conta." },
      ],
    };
    const r = normalizePointers(raw, 6, "Minha conta");
    expect(r.slice(0, 4).every((p) => p.target === "principal" && p.line === "Veja o vídeo completo: Minha conta")).toBe(true);
    expect(r[4]).toEqual({ target: "corte", targetIndex: 1, line: "A parte 1 mostra o começo da conta." });
    expect(r[5].line).toBe("Veja o vídeo completo: Minha conta");
  });
  it("põe a frase antes do contato", () => {
    expect(withPointer({ reels: "d\nLigue: 1" }, "Veja tudo", "Ligue: 1")).toEqual({ reels: "d\nVeja tudo\nLigue: 1" });
    expect(withPointer({ reels: "d" }, "Veja tudo", null)).toEqual({ reels: "d\nVeja tudo" });
  });
  it("sem a IA, todos apontam para o vídeo completo", async () => {
    const broken = { generateJson: async () => { throw new Error("caiu"); } } as unknown as Parameters<typeof cortesCtaAgent>[0]["ai"];
    const r = await cortesCtaAgent({ ai: broken }, { mainTitle: "T", cuts: [{ index: 1, title: "a", text: "x" }] });
    expect(r).toEqual([{ target: "principal", targetIndex: null, line: "Veja o vídeo completo: T" }]);
  });
});
