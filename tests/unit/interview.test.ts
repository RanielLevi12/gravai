import { beforeEach, describe, expect, it } from "vitest";
import { getMockCalls, resetMock, setMockInvalidJson, setMockResponse } from "@/lib/ai/mock";
import { userAiFrom, type UserAi } from "@/lib/ai";
import * as mockProvider from "@/lib/ai/mock";
import { AiError } from "@/lib/ai/schemas";
import { applyAnswer, firstMissing, STEPS, type Interview } from "@/lib/interview/steps";
import {
  confirmSeriesWith,
  saveAnswerWith,
  type InterviewDb,
  type InterviewProject,
  type NewEpisodeProject,
} from "@/lib/interview/service";
import { loadSuggestion, normalizeSuggestion, suggestInterviewWith, suggestTitlesWith } from "@/lib/interview/suggest";

const PALAVRAS = (n: number) => Array.from({ length: n }, (_, i) => `palavra${i + 1}`).join(" ");

/** Banco em memória com a mesma interface que o app usa no Supabase. */
class FakeDb implements InterviewDb {
  projects = new Map<string, InterviewProject>();
  series = new Map<string, string>();
  used = 0;
  limit = 5;
  ctas: string[] = [];
  failInsert = false;
  private seq = 0;

  /** Projeto já criado (e já contado na cota, como no POST /api/projects). */
  add(p: Partial<InterviewProject> = {}, counted = true): InterviewProject {
    const id = p.id ?? `p${++this.seq}`;
    const row: InterviewProject = {
      id,
      title: "Projeto",
      source_kind: "text",
      source_text: PALAVRAS(600),
      source_truncated: false,
      status: "entrevista",
      interview: {},
      series_id: null,
      episode_index: null,
      ...p,
    };
    this.projects.set(id, row);
    if (counted) this.used++;
    return row;
  }
  async getProject(id: string) {
    const p = this.projects.get(id);
    return p ? structuredClone(p) : null;
  }
  stale = new Set<string>();
  async saveInterview(id: string, interview: Interview, opts?: { scriptStale?: boolean }) {
    const p = this.projects.get(id);
    if (!p) return false;
    if (opts?.scriptStale) this.stale.add(id);
    p.interview = structuredClone(interview);
    return true;
  }
  async ctaIds() {
    return this.ctas;
  }
  async remainingProjects() {
    return Math.max(0, this.limit - this.used);
  }
  async createSeries(title: string) {
    const id = `s${++this.seq}`;
    this.series.set(id, title);
    return id;
  }
  async deleteSeries(id: string) {
    this.series.delete(id);
    for (const p of this.projects.values()) if (p.series_id === id) p.series_id = null;
  }
  async claimForSeries(projectId: string, seriesId: string, patch: { title: string; interview: Interview }) {
    const p = this.projects.get(projectId);
    if (!p || p.series_id) return false;
    Object.assign(p, { series_id: seriesId, episode_index: 1, title: patch.title, interview: structuredClone(patch.interview) });
    return true;
  }
  async releaseSeries(projectId: string, original: { title: string; interview: Interview }) {
    const p = this.projects.get(projectId);
    if (p) Object.assign(p, { series_id: null, episode_index: null, title: original.title, interview: original.interview });
  }
  async insertProjects(rows: NewEpisodeProject[]) {
    if (this.failInsert) return null;
    if (this.used + rows.length > this.limit) return "quota";
    this.used += rows.length;
    return rows.map((r) => this.add({ ...r }, false).id);
  }
  async seriesProjectIds(seriesId: string) {
    return [...this.projects.values()]
      .filter((p) => p.series_id === seriesId)
      .sort((a, b) => (a.episode_index ?? 0) - (b.episode_index ?? 0))
      .map((p) => p.id);
  }
}

const EPISODIOS = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `Episódio ${i + 1}`, summary: `Resumo ${i + 1}` }));

describe("saveAnswer", () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
  });

  it("salvar o mesmo passo duas vezes com o mesmo valor gera estado idêntico", async () => {
    const p = db.add();
    const a = await saveAnswerWith(db, p.id, "plataformas", ["reels", "tiktok"]);
    const first = structuredClone(db.projects.get(p.id)!.interview);
    const b = await saveAnswerWith(db, p.id, "plataformas", ["reels", "tiktok"]);
    expect(a).toEqual({ next: "formato" });
    expect(b).toEqual(a);
    expect(db.projects.get(p.id)!.interview).toEqual(first);
    expect(first).toEqual({ platforms: ["reels", "tiktok"], current: "formato" });
  });

  it("mudar mainSeconds de 180 para 30 com cutSeconds=30 zera cutSeconds", async () => {
    const p = db.add({ interview: { mainSeconds: 180, cutSeconds: 30, current: "cenario" } });
    expect(await saveAnswerWith(db, p.id, "duracao", 30)).toEqual({ next: "cortes" });
    const i = db.projects.get(p.id)!.interview;
    expect(i.mainSeconds).toBe(30);
    expect(i.cutSeconds).toBeUndefined();
    expect(firstMissing(i)).toBe("plataformas");
  });

  it("mantém cutSeconds quando continua válido para a nova duração", async () => {
    const p = db.add({ interview: { mainSeconds: 180, cutSeconds: 30 } });
    await saveAnswerWith(db, p.id, "duracao", 60);
    expect(db.projects.get(p.id)!.interview.cutSeconds).toBe(30);
  });

  it("recusa corte que não cabe no vídeo e duração que o texto não rende", async () => {
    const p = db.add({ source_text: PALAVRAS(80), interview: { mainSeconds: 60 } });
    expect(await saveAnswerWith(db, p.id, "cortes", 60)).toEqual({ error: expect.any(String) });
    expect(await saveAnswerWith(db, p.id, "duracao", 600)).toEqual({ error: "Seu texto rende até ~1 min" });
    expect(db.projects.get(p.id)!.interview).toEqual({ mainSeconds: 60 });
  });

  it("formato série abre a subtela de episódios; vídeo único segue para duração", async () => {
    const p = db.add();
    expect(await saveAnswerWith(db, p.id, "formato", "series")).toEqual({ next: "episodios" });
    expect(await saveAnswerWith(db, p.id, "formato", "single")).toEqual({ next: "duracao" });
  });

  it("CTA só aceita um id do próprio usuário ou nenhum", async () => {
    db.ctas = ["c1"];
    const p = db.add();
    expect(await saveAnswerWith(db, p.id, "cta", "outro")).toEqual({ error: expect.any(String) });
    expect(await saveAnswerWith(db, p.id, "cta", "c1")).toEqual({ next: "resumo" });
    expect(await saveAnswerWith(db, p.id, "cta", null)).toEqual({ next: "resumo" });
  });

  it("mudar uma resposta depois de o script existir marca o script como desatualizado", async () => {
    const p = db.add({ status: "script", interview: { platforms: ["reels"], format: "single", mainSeconds: 180, cutSeconds: null, current: "resumo" } });
    expect(await saveAnswerWith(db, p.id, "duracao", 60)).toEqual({ next: expect.any(String) });
    expect(db.stale.has(p.id)).toBe(true);
  });

  it("repetir a mesma resposta ou responder antes do script não marca nada", async () => {
    const comScript = db.add({ status: "script", interview: { platforms: ["reels"], format: "single", mainSeconds: 180, cutSeconds: null, current: "resumo" } });
    await saveAnswerWith(db, comScript.id, "duracao", 180);
    await saveAnswerWith(db, comScript.id, "plataformas", ["reels"]);
    const semScript = db.add({ status: "entrevista", interview: { platforms: ["reels"], format: "single", mainSeconds: 180, cutSeconds: null } });
    await saveAnswerWith(db, semScript.id, "duracao", 60);
    expect(db.stale.size).toBe(0);
  });

  it("projeto inexistente devolve erro", async () => {
    expect(await saveAnswerWith(db, "nada", "capa", "frame")).toEqual({ error: "Projeto não encontrado." });
  });
});

describe("applyAnswer e passos", () => {
  it("tem 8 perguntas e o resumo, na ordem", () => {
    expect(STEPS).toEqual(["plataformas", "formato", "duracao", "cortes", "cenario", "titulos", "capa", "cta", "resumo"]);
  });

  it("valida o formato do valor", () => {
    const r = applyAnswer({}, "plataformas", ["orkut"], { sourceText: "", ctaIds: [] });
    expect(r.ok).toBe(false);
  });
});

describe("confirmSeries", () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
  });

  it("5 episódios com cota restante 2 recusa avisando quantos cabem", async () => {
    db.used = 2; // + o original = 3 usados → restam 2
    const p = db.add({ interview: { platforms: ["reels"], format: "series" } });
    const r = await confirmSeriesWith(db, p.id, EPISODIOS(5));
    expect(r).toEqual({ error: "Cabem só 2 episódios este mês." });
    expect(db.used).toBe(3);
    expect(db.series.size).toBe(0);
    expect(db.projects.size).toBe(1);
  });

  it("episódios de uma série ficam no mesmo projeto (pasta) do episódio 1", async () => {
    const p = db.add({ folder_id: "pasta-1", interview: { platforms: ["reels"], format: "series", current: "episodios" } });
    const r = await confirmSeriesWith(db, p.id, EPISODIOS(3));
    if (!("ids" in r)) throw new Error(r.error);
    expect(r.ids.map((id) => db.projects.get(id)!.folder_id)).toEqual(["pasta-1", "pasta-1", "pasta-1"]);
  });

  it("cria a série, um projeto por episódio e consome 1 cota por episódio novo", async () => {
    const p = db.add({ title: "Hábitos", interview: { platforms: ["reels"], format: "series", current: "episodios" } });
    const r = await confirmSeriesWith(db, p.id, EPISODIOS(3));
    if (!("ids" in r)) throw new Error(r.error);
    expect(r.ids).toHaveLength(3);
    expect(r.ids[0]).toBe(p.id);
    expect(db.used).toBe(3);
    const rows = r.ids.map((id) => db.projects.get(id)!);
    expect(rows.map((x) => x.episode_index)).toEqual([1, 2, 3]);
    expect(rows.map((x) => x.title)).toEqual(["Episódio 1", "Episódio 2", "Episódio 3"]);
    expect(new Set(rows.map((x) => x.series_id)).size).toBe(1);
    expect(new Set(rows.map((x) => x.source_text)).size).toBe(1);
    for (const x of rows) {
      expect(x.interview).toMatchObject({ platforms: ["reels"], format: "series", current: "duracao", episodes: EPISODIOS(3) });
      expect(x.status).toBe("entrevista");
    }
  });

  it("confirmar de novo não cria nem consome nada", async () => {
    const p = db.add({ interview: { format: "series" } });
    const a = await confirmSeriesWith(db, p.id, EPISODIOS(2));
    const b = await confirmSeriesWith(db, p.id, EPISODIOS(2));
    expect(b).toEqual(a);
    expect(db.used).toBe(2);
    expect(db.projects.size).toBe(2);
  });

  it("falha ao criar os episódios desfaz a série e não consome cota", async () => {
    const p = db.add({ title: "Original", interview: { format: "series" } });
    db.failInsert = true;
    const r = await confirmSeriesWith(db, p.id, EPISODIOS(3));
    expect(r).toEqual({ error: expect.any(String) });
    expect(db.used).toBe(1);
    expect(db.series.size).toBe(0);
    expect(db.projects.get(p.id)).toMatchObject({ series_id: null, title: "Original" });
  });

  it("a cota acabar entre a conferência e a criação desfaz a série e avisa quantos cabem", async () => {
    const p = db.add({ title: "Original", interview: { format: "series" } });
    const insert = db.insertProjects.bind(db);
    db.insertProjects = async (rows: NewEpisodeProject[]) => {
      db.used = 4; // outra aba consumiu antes
      return insert(rows);
    };
    const r = await confirmSeriesWith(db, p.id, EPISODIOS(3));
    expect(r).toEqual({ error: "Cabe só 1 episódio este mês." });
    expect(db.used).toBe(4);
    expect(db.series.size).toBe(0);
    expect(db.projects.size).toBe(1);
    expect(db.projects.get(p.id)).toMatchObject({ series_id: null, title: "Original" });
  });

  it("perdeu a corrida e a releitura falha: erro, sem consumir nada", async () => {
    const p = db.add({ interview: { format: "series" } });
    let reads = 0;
    const getProject = db.getProject.bind(db);
    db.getProject = async (id: string) => {
      if (++reads > 1) throw new Error("rede caiu");
      return getProject(id);
    };
    db.claimForSeries = async () => false;
    const r = await confirmSeriesWith(db, p.id, EPISODIOS(3));
    expect(r).toEqual({ error: expect.any(String) });
    expect(db.used).toBe(1);
    expect(db.series.size).toBe(0);
  });

  it("exige pelo menos 2 episódios", async () => {
    const p = db.add({ interview: { format: "series" } });
    expect(await confirmSeriesWith(db, p.id, EPISODIOS(1))).toEqual({ error: expect.any(String) });
  });
});

describe("sugestões", () => {
  let ai: UserAi;
  beforeEach(() => {
    resetMock();
    ai = userAiFrom(mockProvider);
  });

  it("normaliza a duração para uma opção habilitada e série sem episódios vira vídeo único", () => {
    const s = normalizeSuggestion(
      {
        platforms: ["reels", "reels", "tiktok"],
        format: "series",
        episodes: [{ title: "Só um", summary: "x" }],
        mainSeconds: 600,
        scenery: { natural: "Estante", aiPrompt: "Fundo" },
        cover: "frame",
        reasons: { plataformas: "a", formato: "b", duracao: "c", cenario: "d", capa: "e" },
      },
      PALAVRAS(300),
    );
    expect(s.platforms).toEqual(["reels", "tiktok"]);
    expect(s.format).toBe("single");
    expect(s.episodes).toEqual([]);
    expect(s.mainSeconds).toBe(180);
  });

  it("suggestInterview salva a sugestão em interview.suggestion", async () => {
    const db = new FakeDb();
    const p = db.add({ source_text: PALAVRAS(300) });
    const s = await suggestInterviewWith({ db, ai: async () => ai }, p.id);
    expect(s.platforms.length).toBeGreaterThan(0);
    expect(db.projects.get(p.id)!.interview.suggestion).toEqual(s);
  });

  it("suggestTitles devolve 3 títulos de tipos diferentes, o melhor primeiro e marcado", async () => {
    const db = new FakeDb();
    const p = db.add({ interview: { mainSeconds: 60, platforms: ["reels"] } });
    setMockResponse("generateJson", {
      options: [
        { type: "beneficio", text: "Como estudar 20 minutos por dia" },
        { type: "erro_comum", text: "O erro que faz você desistir no terceiro dia" },
        { type: "pergunta", text: "Por que o terceiro dia é o mais difícil?" },
      ],
    });
    const score = async (titles: string[]) => titles.map((_, i) => [0.6, 0.9, 0.7][i]);
    const r = await suggestTitlesWith({ db, ai: async () => ai, score }, p.id);
    expect(r).toEqual([
      { text: "O erro que faz você desistir no terceiro dia", score: 0.9, type: "erro_comum", best: true },
      { text: "Por que o terceiro dia é o mais difícil?", score: 0.7, type: "pergunta", best: false },
      { text: "Como estudar 20 minutos por dia", score: 0.6, type: "beneficio", best: false },
    ]);
    expect(db.projects.get(p.id)!.interview.titleSuggestions).toEqual(r);
  });

  it("suggestTitles refaz o título fraco uma vez e fica com o melhor", async () => {
    const db = new FakeDb();
    const p = db.add({ interview: { mainSeconds: 60, platforms: ["reels"] } });
    setMockResponse("generateJson", [
      { options: [
        { type: "beneficio", text: "Como estudar 20 minutos por dia" },
        { type: "erro_comum", text: "O erro que faz você desistir" },
        { type: "pergunta", text: "Dicas incríveis de estudo" },
      ] },
      { options: [{ type: "pergunta", text: "Por que você esquece tudo uma semana depois da prova?" }] },
    ]);
    const scores = new Map([
      ["Como estudar 20 minutos por dia", 0.8],
      ["O erro que faz você desistir", 0.7],
      ["Dicas incríveis de estudo", 0.2],
      ["Por que você esquece tudo uma semana depois da prova?", 0.75],
    ]);
    const score = async (titles: string[]) => titles.map((t) => scores.get(t) ?? 0);
    const r = await suggestTitlesWith({ db, ai: async () => ai, score }, p.id);
    expect(getMockCalls("generateJson")).toBe(2);
    expect(r.map((o) => o.text)).toEqual([
      "Como estudar 20 minutos por dia",
      "Por que você esquece tudo uma semana depois da prova?",
      "O erro que faz você desistir",
    ]);
    expect(r[0].best).toBe(true);
  });

  it("falha da IA na sugestão é marcada e não é repetida", async () => {
    const db = new FakeDb();
    const p = db.add({ source_text: PALAVRAS(300) });
    const deps = { db, ai: async () => ai };
    setMockInvalidJson(2); // as duas tentativas de generateJson devolvem JSON inválido
    const a = await loadSuggestion(deps, p.id, {});
    expect(a).toEqual({ suggestion: null, noAi: false });
    expect(getMockCalls("generateJson")).toBe(2);
    const saved = db.projects.get(p.id)!.interview;
    expect(saved.suggestionFailedAt).toEqual(expect.any(String));
    expect(saved.suggestion).toBeUndefined();

    const b = await loadSuggestion(deps, p.id, saved);
    expect(b).toEqual({ suggestion: null, noAi: false });
    expect(getMockCalls("generateJson")).toBe(2);
  });

  it("sem IA conectada, loadSuggestion devolve noAi e não marca falha", async () => {
    const db = new FakeDb();
    const p = db.add();
    const noAi = async (): Promise<UserAi> => {
      throw new AiError("Conecte", { code: "not_connected" });
    };
    expect(await loadSuggestion({ db, ai: noAi }, p.id, {})).toEqual({ suggestion: null, noAi: true });
    expect(db.projects.get(p.id)!.interview.suggestionFailedAt).toBeUndefined();
  });

  it("sem IA conectada, suggestInterview propaga not_connected", async () => {
    const db = new FakeDb();
    const p = db.add();
    const noAi = async (): Promise<UserAi> => {
      throw new AiError("Conecte", { code: "not_connected" });
    };
    await expect(suggestInterviewWith({ db, ai: noAi }, p.id)).rejects.toMatchObject({ code: "not_connected" });
  });
});
