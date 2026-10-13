import { beforeEach, describe, expect, it } from "vitest";
import * as mockProvider from "@/lib/ai/mock";
import { getMockCalls, resetMock, setMockResponse } from "@/lib/ai/mock";
import { userAiFrom } from "@/lib/ai";
import type { InterviewProject } from "@/lib/interview/service";
import type { Interview } from "@/lib/interview/steps";
import { generateScriptWith, type NewScriptBlock, type ScriptCta, type ScriptDb, type ScriptDeps } from "@/lib/script/generate";

const PALAVRAS = (n: number) => Array.from({ length: n }, (_, i) => `palavra${i + 1}`).join(" ");

class FakeScriptDb implements ScriptDb {
  project: InterviewProject;
  blocks: NewScriptBlock[] = [];
  descriptions: unknown = {};
  ctaRow: ScriptCta | null = { kind: "whatsapp", label: "WhatsApp", value: "11999990000" };
  constructor(interview: Interview) {
    this.project = {
      id: "p1",
      title: "Projeto",
      source_kind: "text",
      source_text: PALAVRAS(600),
      source_truncated: false,
      status: "entrevista",
      interview,
      series_id: null,
      episode_index: null,
    };
  }
  async getProject(id: string) {
    return id === this.project.id ? structuredClone(this.project) : null;
  }
  async profile() {
    return { niche: "Finanças", audience: "Iniciantes", tone: "didatico", phrases: null };
  }
  async cta() {
    return this.ctaRow;
  }
  async saveScript(_id: string, data: { blocks: NewScriptBlock[]; descriptions: unknown; interview: Interview }) {
    this.blocks = structuredClone(data.blocks);
    this.descriptions = data.descriptions;
    this.project.interview = data.interview;
    this.project.status = "script";
    return true;
  }
}

const INTERVIEW: Interview = { platforms: ["reels", "youtube"], mainSeconds: 180, cutSeconds: 30, ctaId: "c1" };

function deps(db: ScriptDb): ScriptDeps {
  return { db, ai: async () => userAiFrom(mockProvider), check: mockProvider.checkScript };
}

describe("generateScript", () => {
  beforeEach(() => resetMock());

  it("grava 5 cortes numerados, com posições contíguas e status script", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    await generateScriptWith(deps(db), "p1");
    expect(db.blocks.map((b) => b.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(db.blocks.filter((b) => b.kind === "cut").map((b) => b.cut_index)).toEqual([1, 2, 3, 4, 5]);
    expect(db.blocks[0].kind).toBe("opening");
    expect(db.blocks[6].kind).toBe("closing");
    expect(db.project.status).toBe("script");
    expect(db.project.interview.scriptWarning).toBeUndefined();
    expect(getMockCalls("generateJson")).toBe(1);
  });

  it("anexa o CTA como última linha das descrições, só nas plataformas escolhidas", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    await generateScriptWith(deps(db), "p1");
    const cut2 = db.blocks.find((b) => b.cut_index === 2)!;
    expect(cut2.descriptions.reels?.split("\n").at(-1)).toBe("Chama no WhatsApp: https://wa.me/5511999990000");
    expect(Object.keys(cut2.descriptions).sort()).toEqual(["reels", "youtube"]);
    const main = db.descriptions as Record<string, string>;
    expect(main.youtube.endsWith("Chama no WhatsApp: https://wa.me/5511999990000")).toBe(true);
  });

  it("formata os outros tipos de CTA", async () => {
    const casos: [ScriptCta, string][] = [
      [{ kind: "bio", label: "Instagram", value: "@gravai" }, "Link na bio: @gravai"],
      [{ kind: "link", label: "Loja", value: "https://gravai.app/loja" }, "Loja: https://gravai.app/loja"],
      [{ kind: "phone", label: "Telefone", value: "1133334444" }, "Ligue: 1133334444"],
    ];
    for (const [cta, linha] of casos) {
      const db = new FakeScriptDb(INTERVIEW);
      db.ctaRow = cta;
      await generateScriptWith(deps(db), "p1");
      expect(db.blocks.find((b) => b.cut_index === 1)!.descriptions.reels?.endsWith(`\n${linha}`)).toBe(true);
    }
  });

  it("sem CTA, a descrição fica como veio", async () => {
    const db = new FakeScriptDb({ ...INTERVIEW, ctaId: null });
    await generateScriptWith(deps(db), "p1");
    expect(db.blocks.find((b) => b.cut_index === 1)!.descriptions.reels).toBe("Dica 1 #dicas");
  });

  it("corte longo demais: tenta duas vezes e grava o aviso", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    const longo = {
      blocks: [
        { kind: "opening", text: PALAVRAS(30) },
        { kind: "cut", text: PALAVRAS(140), cutTitle: "Longo", descriptions: { reels: "d" } },
        { kind: "cut", text: PALAVRAS(70), cutTitle: "B", descriptions: { reels: "d" } },
        { kind: "cut", text: PALAVRAS(70), cutTitle: "C", descriptions: { reels: "d" } },
        { kind: "cut", text: PALAVRAS(70), cutTitle: "D", descriptions: { reels: "d" } },
        { kind: "cut", text: PALAVRAS(70), cutTitle: "E", descriptions: { reels: "d" } },
        { kind: "closing", text: PALAVRAS(30) },
      ],
      mainDescriptions: { reels: "d" },
      mainCoverPrompt: "capa",
    };
    setMockResponse("generateJson", longo);
    await generateScriptWith(deps(db), "p1");
    expect(getMockCalls("generateJson")).toBe(2);
    expect(db.blocks).toHaveLength(7);
    expect(db.project.interview.scriptWarning).toMatch(/corte 1/);
  });

  it("a segunda tentativa que acerta não deixa aviso", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    setMockResponse("generateJson", [{ blocks: [{ kind: "opening", text: PALAVRAS(10) }], mainDescriptions: {}, mainCoverPrompt: "c" }]);
    await generateScriptWith(deps(db), "p1");
    expect(getMockCalls("generateJson")).toBe(2);
    expect(db.blocks).toHaveLength(7);
    expect(db.project.interview.scriptWarning).toBeUndefined();
  });

  it("regenerar substitui os blocos sem duplicar", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    await generateScriptWith(deps(db), "p1");
    await generateScriptWith(deps(db), "p1");
    expect(db.blocks).toHaveLength(7);
  });

  it("tom ou CTA fracos viram avisos em scriptChecks, e a regeneração limpa os antigos", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    setMockResponse("checkScript", { toneOk: 0.2, ctaPresent: 0.1 });
    await generateScriptWith(deps(db), "p1");
    expect(db.project.interview.scriptChecks).toHaveLength(2);
    setMockResponse("checkScript", { toneOk: 0.9, ctaPresent: 0.9 });
    await generateScriptWith(deps(db), "p1");
    expect(db.project.interview.scriptChecks).toBeUndefined();
  });

  it("entrevista incompleta ou projeto inexistente: erro sem chamar a IA", async () => {
    const db = new FakeScriptDb({});
    await expect(generateScriptWith(deps(db), "p1")).rejects.toThrow();
    await expect(generateScriptWith(deps(db), "nada")).rejects.toThrow("Projeto não encontrado.");
    expect(getMockCalls("generateJson")).toBe(0);
  });
});
