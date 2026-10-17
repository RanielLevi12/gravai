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
  coverPrompt: string | null = null;
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
  async saveScript(_id: string, data: { blocks: NewScriptBlock[]; descriptions: unknown; coverPrompt: string | null; interview: Interview }) {
    this.coverPrompt = data.coverPrompt;
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

  it("grava o script contínuo: abertura, 5 trechos e fechamento, posições contíguas e status script", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    await generateScriptWith(deps(db), "p1");
    expect(db.blocks.map((b) => b.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(db.blocks.map((b) => b.kind)).toEqual(["opening", "body", "body", "body", "body", "body", "closing"]);
    expect(db.blocks.every((b) => b.cut_index === null && b.cut_title === null && b.cover_prompt === null)).toBe(true);
    expect(db.project.status).toBe("script");
    expect(db.coverPrompt).toBe("Capa do vídeo principal");
    expect(db.project.interview.scriptWarning).toBeUndefined();
    expect(getMockCalls("generateJson")).toBe(1);
  });

  it("com os agentes: o melhor gancho vai no pedido, o melhor fecho vira o fechamento e as opções ficam salvas", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    const seen: string[] = [];
    const base = userAiFrom(mockProvider);
    const spy = { ...base, generateJson: ((schema: never, system: string, user: string) => (seen.push(user), base.generateJson(schema, system, user))) as typeof base.generateJson };
    await generateScriptWith(
      { ...deps(db), ai: async () => spy, agents: { scoreHook: async (t) => t.map((_, i) => [0.5, 0.9, 0.6][i]), scoreClosing: async (t) => t.map((_, i) => [0.5, 0.95, 0.7][i]) } },
      "p1",
    );
    const scriptPrompt = seen.find((u) => u.includes("Texto-fonte:") && u.includes("Vídeo principal"))!;
    expect(scriptPrompt).toContain("Gancho escolhido (a abertura começa com esta frase, sem mudar): Você começa a rotina grande demais.");
    expect(scriptPrompt).toContain("Objetivo do fecho: Levar a pessoa a chamar no WhatsApp");
    expect(db.blocks.at(-1)!.text).toBe("Rotina boa cabe no bolso. Salva este vídeo pra abrir amanhã cedo.");
    const saved = db.project.interview.scriptAgents!;
    expect(saved.hooks![0]).toMatchObject({ best: true, onScreen: "Grande demais", score: 0.9 });
    expect(saved.closing).toHaveLength(3);
    // O contato continua sendo do código, na última linha da descrição.
    expect((db.descriptions as Record<string, string>).reels.split("\n").at(-1)).toBe("Chama no WhatsApp: https://wa.me/5511999990000");
  });

  it("se os agentes falharem, o script sai igual (abertura e fecho da IA principal)", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    const boom = async () => {
      throw new Error("jev fora do ar");
    };
    await generateScriptWith({ ...deps(db), agents: { scoreHook: boom, scoreClosing: boom } }, "p1");
    expect(db.blocks.at(-1)!.text).toMatch(/^Então é isso/);
    expect(db.project.interview.scriptAgents).toBeUndefined();
    expect(db.project.status).toBe("script");
  });

  it("fecho não roda se a geração já gastou o tempo da função", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    let t = 0;
    const now = () => ((t += 100_000), t);
    await generateScriptWith({ ...deps(db), now, agents: { scoreHook: async (x) => x.map(() => 0.9), scoreClosing: async (x) => x.map(() => 0.9) } }, "p1");
    expect(db.blocks.at(-1)!.text).toMatch(/^Então é isso/);
  });

  it("não pede cortes à IA: o prompt manda um vídeo só e cumprimento uma vez", async () => {
    const { SCRIPT_SYSTEM } = await import("@/lib/script/prompts");
    expect(SCRIPT_SYSTEM).toMatch(/UM vídeo/);
    expect(SCRIPT_SYSTEM).toMatch(/no máximo UMA vez/);
    expect(SCRIPT_SYSTEM).not.toMatch(/"cut"/);
  });

  it("anexa o CTA como última linha da descrição do vídeo, só nas plataformas escolhidas", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    await generateScriptWith(deps(db), "p1");
    const main = db.descriptions as Record<string, string>;
    expect(Object.keys(main).sort()).toEqual(["reels", "youtube"]);
    expect(main.reels.split("\n").at(-1)).toBe("Chama no WhatsApp: https://wa.me/5511999990000");
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
      expect((db.descriptions as Record<string, string>).reels.endsWith(`\n${linha}`)).toBe(true);
    }
  });

  it("sem CTA, a descrição fica como veio", async () => {
    const db = new FakeScriptDb({ ...INTERVIEW, ctaId: null });
    await generateScriptWith(deps(db), "p1");
    expect((db.descriptions as Record<string, string>).reels).toBe("Vídeo completo #dicas");
  });

  it("CTA escolhido que não existe mais: script sai sem ele e avisa em scriptChecks", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    db.ctaRow = null;
    await generateScriptWith(deps(db), "p1");
    expect(db.project.interview.scriptChecks).toEqual([expect.stringContaining("foi removida do perfil")]);
  });

  it("script longo demais: tenta duas vezes e grava o aviso", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    const longo = {
      blocks: [
        { kind: "opening", text: PALAVRAS(30) },
        { kind: "body", text: PALAVRAS(900) },
        { kind: "closing", text: PALAVRAS(30) },
      ],
      mainDescriptions: { reels: "d" },
      mainCoverPrompt: "capa",
    };
    setMockResponse("generateJson", longo);
    await generateScriptWith(deps(db), "p1");
    expect(getMockCalls("generateJson")).toBe(2);
    expect(db.blocks).toHaveLength(3);
    expect(db.project.interview.scriptWarning).toMatch(/o vídeo todo tem/);
  });

  it("a segunda tentativa que acerta não deixa aviso", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    setMockResponse("generateJson", [{ blocks: [{ kind: "opening", text: PALAVRAS(10) }], mainDescriptions: {}, mainCoverPrompt: "c" }]);
    await generateScriptWith(deps(db), "p1");
    expect(getMockCalls("generateJson")).toBe(2);
    expect(db.blocks).toHaveLength(7);
    expect(db.project.interview.scriptWarning).toBeUndefined();
  });

  it("primeira geração lenta: não tenta de novo (cabe no maxDuration) e grava o aviso", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    setMockResponse("generateJson", [{ blocks: [{ kind: "opening", text: PALAVRAS(10) }], mainDescriptions: {}, mainCoverPrompt: "c" }]);
    let t = 0;
    const slow = { ...deps(db), now: () => (t += 31_000) };
    await generateScriptWith(slow, "p1");
    expect(getMockCalls("generateJson")).toBe(1);
    expect(db.project.interview.scriptWarning).toMatch(/fora do esperado/);
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

  it("gancho fraco e trecho que recomeça viram avisos; o fechamento não é avaliado", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    // Mock: abertura, trechos 1..5 (o fechamento fica de fora). Abertura e trecho 2 fracos; trecho 3 recomeça.
    setMockResponse("reviewExcerpts", { hook: [0.1, 1, 0.25, 1, 1, 1], restart: [0, 0, 0, 0.9, 0, 0] });
    await generateScriptWith({ ...deps(db), review: mockProvider.reviewExcerpts }, "p1");
    const w = db.project.interview.scriptChecks as string[];
    expect(w).toEqual([expect.stringContaining("gancho da abertura e do trecho 2 está fraco"), expect.stringContaining("O trecho 3 parece recomeçar")]);
    expect(db.blocks.at(-1)?.kind).toBe("closing");
  });

  it("se o jev falhar na revisão, o script salva do mesmo jeito", async () => {
    const db = new FakeScriptDb(INTERVIEW);
    const review = async () => {
      throw new Error("fora do ar");
    };
    await generateScriptWith({ ...deps(db), review }, "p1");
    expect(db.blocks).toHaveLength(7);
    expect(db.project.interview.scriptChecks).toBeUndefined();
  });

  it("entrevista incompleta ou projeto inexistente: erro sem chamar a IA", async () => {
    const db = new FakeScriptDb({});
    await expect(generateScriptWith(deps(db), "p1")).rejects.toThrow();
    await expect(generateScriptWith(deps(db), "nada")).rejects.toThrow("Projeto não encontrado.");
    expect(getMockCalls("generateJson")).toBe(0);
  });
});
