import { describe, expect, it } from "vitest";
import type { UserAi } from "@/lib/ai";
import { AiError } from "@/lib/ai/schemas";
import type { InterviewProject } from "@/lib/interview/service";
import { buildCutsUser, cutSecondsOf, normalizeCuts, validateCuts, type Cut, type RawCuts } from "@/lib/script/cuts";
import { cutsWarnings, saveCutsWith, suggestCutsWith, type CutsDb } from "@/lib/script/cuts-generate";

const words = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`).join(" ");
/** 75 palavras = 30 s. */
const BLOCK = words(75);
const texts = [words(25), BLOCK, BLOCK, BLOCK, words(25)];

const cut = (over: Partial<Cut> = {}): Cut => ({ id: "a1", start: 2, end: 2, title: "T", coverPrompt: null, descriptions: {}, ...over });
const opts = { cutSeconds: 30, maxCuts: 3, platforms: ["reels" as const], ctaLine: null as string | null, newId: (() => { let k = 0; return () => `id${++k}`; })() };

describe("validateCuts", () => {
  it("aceita, apara e ordena pelo início", () => {
    const r = validateCuts([cut({ id: "b", start: 4, end: 4, title: "  B " }), cut({ id: "a", start: 2, end: 3 })], 5);
    expect(r.ok && r.cuts.map((c) => [c.id, c.title])).toEqual([["a", "T"], ["b", "B"]]);
  });
  it.each([
    ["fora do script", [cut({ end: 6 })], "não existem"],
    ["início depois do fim", [cut({ start: 3, end: 2 })], "não existem"],
    ["posição quebrada", [cut({ start: 1.5 })], "não existem"],
    ["sobreposição", [cut({ id: "a", start: 2, end: 3 }), cut({ id: "b", start: 3, end: 4 })], "mesmo trecho"],
    ["id repetido", [cut({ start: 1, end: 1 }), cut({ start: 3, end: 3 })], "inválidos"],
    ["título longo", [cut({ title: "x".repeat(101) })], "título"],
    ["descrição de plataforma inexistente", [cut({ descriptions: { orkut: "x" } as never })], "Descrição"],
  ])("recusa %s", (_n, input, msg) => {
    const r = validateCuts(input, 5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });
  it("aceita lista vazia e recusa o que não é lista", () => {
    expect(validateCuts([], 5)).toEqual({ ok: true, cuts: [] });
    expect(validateCuts("x", 5).ok).toBe(false);
  });
});

describe("cutSecondsOf", () => {
  it("soma os blocos do começo ao fim (inclusive)", () => {
    expect(cutSecondsOf(texts, { start: 2, end: 3 })).toBe(60);
  });
});

describe("normalizeCuts", () => {
  const raw = (cuts: Partial<RawCuts["cuts"][number]>[]): RawCuts => ({ cuts: cuts.map((c) => ({ start: 2, end: 2, title: "T", coverPrompt: "capa", descriptions: { reels: "legenda" }, ...c })) });

  it("corta sobreposição, aparo pelo fim e respeita o máximo", () => {
    const out = normalizeCuts(raw([{ start: 2, end: 4 }, { start: 3, end: 3 }, { start: 5, end: 5 }]), texts, { ...opts, maxCuts: 5 });
    // 2..4 (90 s) é aparado para 2..2 (30 s); 3..3 cabe; 5..5 tem só 10 s (< 30% de 30? 10 ≥ 9, fica)
    expect(out.map((c) => [c.start, c.end])).toEqual([[2, 2], [3, 3], [5, 5]]);
    expect(normalizeCuts(raw([{ start: 2, end: 2 }, { start: 3, end: 3 }, { start: 4, end: 4 }]), texts, { ...opts, maxCuts: 2 })).toHaveLength(2);
  });
  it("posições fora do script são recolhidas; início/fim trocados são corrigidos", () => {
    const out = normalizeCuts(raw([{ start: 3, end: 2 }, { start: 9, end: 12 }]), texts, opts);
    expect(out.map((c) => [c.start, c.end])).toEqual([[2, 2]]);
  });
  it("descarta corte curto demais", () => {
    expect(normalizeCuts(raw([{ start: 1, end: 1 }]), [words(6), BLOCK], { ...opts, maxCuts: 3 })).toEqual([]);
  });
  it("chamada para ação só entra pelo código, na última linha da descrição", () => {
    const out = normalizeCuts(raw([{}]), texts, { ...opts, ctaLine: "Link na bio: x.com" });
    expect(out[0].descriptions.reels).toBe("legenda\nLink na bio: x.com");
  });
});

describe("buildCutsUser", () => {
  it("numera os blocos e inclui o 'Sobre este projeto'", () => {
    const u = buildCutsUser({ blocks: [{ position: 1, text: "oi" }, { position: 2, text: "tchau" }], cutSeconds: 30, count: 2, platforms: ["reels"], about: "devocional" });
    expect(u).toContain("[1] (~");
    expect(u).toContain("[2] (~");
    expect(u).toContain("devocional");
    expect(u).toContain("até 2 cortes de cerca de 30 segundos");
  });
});

function fakeDb(over: Partial<InterviewProject> = {}) {
  const project: InterviewProject = {
    id: "p1", title: "Vídeo", source_kind: "text", source_text: "x", source_truncated: false, status: "script",
    interview: { platforms: ["reels"], mainSeconds: 120, cutSeconds: 30 }, series_id: null, episode_index: null, ...over,
  };
  const saved: { cuts: Cut[] | null } = { cuts: null };
  const db: CutsDb = {
    getProject: async (id) => (id === "p1" ? project : null),
    blocks: async () => texts.map((text, k) => ({ position: k + 1, text })),
    cta: async () => ({ kind: "bio", label: null, value: "x.com" }),
    saveCuts: async (_id, cuts) => ((saved.cuts = cuts), true),
  };
  return { db, saved };
}
const aiReturning = (raw: RawCuts) => async () => ({ generateJson: async () => raw }) as unknown as UserAi;

describe("suggestCutsWith", () => {
  it("normaliza, põe o CTA no código e salva", async () => {
    const { db, saved } = fakeDb({ interview: { platforms: ["reels"], mainSeconds: 120, cutSeconds: 30, ctaId: "c1" } });
    const cuts = await suggestCutsWith({ db, ai: aiReturning({ cuts: [{ start: 2, end: 2, title: "A", coverPrompt: "c", descriptions: { reels: "d" } }] }), newId: () => "n1" }, "p1");
    expect(cuts).toEqual([expect.objectContaining({ id: "n1", start: 2, end: 2, descriptions: { reels: "d\nVeja o vídeo completo: Vídeo\nLink na bio: x.com" } })]);
    expect(saved.cuts).toEqual(cuts);
  });
  it("CTA do corte aponta para outro corte quando a IA escolhe, e o contato continua por último", async () => {
    const { db } = fakeDb({ interview: { platforms: ["reels"], mainSeconds: 120, cutSeconds: 30, ctaId: "c1" } });
    const cutsRaw = { cuts: [
      { start: 2, end: 2, title: "A", coverPrompt: "c", descriptions: { reels: "d1" } },
      { start: 4, end: 4, title: "B", coverPrompt: "c", descriptions: { reels: "d2" } },
    ] };
    const pointers = { pointers: [
      { index: 1, target: "principal", targetIndex: null, line: "O vídeo completo tem a conta inteira." },
      { index: 2, target: "corte", targetIndex: 1, line: "Antes disso, veja o corte A." },
    ] };
    let n = 0;
    const ai = async () => ({ generateJson: async () => (n++ === 0 ? cutsRaw : pointers) }) as unknown as UserAi;
    const cuts = await suggestCutsWith({ db, ai, newId: () => `n${n}` }, "p1");
    expect(cuts[0].descriptions.reels).toBe("d1\nO vídeo completo tem a conta inteira.\nLink na bio: x.com");
    expect(cuts[1].descriptions.reels).toBe("d2\nAntes disso, veja o corte A.\nLink na bio: x.com");
  });
  it("sem tamanho de corte (vídeo sem cortes) não chama a IA", async () => {
    const { db } = fakeDb({ interview: { platforms: ["reels"], mainSeconds: 60, cutSeconds: null } });
    await expect(suggestCutsWith({ db, ai: async () => { throw new Error("não devia chamar"); } }, "p1")).rejects.toThrow(AiError);
  });
  it("IA sem cortes aproveitáveis vira erro claro e nada é salvo", async () => {
    const { db, saved } = fakeDb();
    await expect(suggestCutsWith({ db, ai: aiReturning({ cuts: [] }) }, "p1")).rejects.toThrow(/Não achei cortes/);
    expect(saved.cuts).toBeNull();
  });
  it("projeto inexistente", async () => {
    const { db } = fakeDb();
    await expect(suggestCutsWith({ db, ai: aiReturning({ cuts: [] }) }, "outro")).rejects.toThrow(AiError);
  });
});

describe("saveCutsWith", () => {
  it("valida contra o número de blocos do script antes de salvar", async () => {
    const { db, saved } = fakeDb();
    expect(await saveCutsWith(db, "p1", [cut({ end: 9 })])).toMatchObject({ ok: false });
    expect(saved.cuts).toBeNull();
    expect(await saveCutsWith(db, "p1", [cut()])).toMatchObject({ ok: true });
    expect(saved.cuts).toHaveLength(1);
  });
});

describe("cutsWarnings", () => {
  const cut = (id: string, start: number, end: number): Cut => ({ id, start, end, title: id, coverPrompt: null, descriptions: {} });
  it("avisa dos cortes com gancho fraco, lendo o texto de cada corte", async () => {
    const { db } = fakeDb();
    const seen: string[][] = [];
    const review = async (t: string[]) => (seen.push(t), { hook: [0.2, 0.9, 0.1], restart: null });
    const w = await cutsWarnings(db, "p1", [cut("a", 1, 2), cut("b", 3, 3), cut("c", 2, 2)], review);
    expect(w).toEqual([expect.stringContaining("gancho do corte 1 e do corte 3 está fraco")]);
    expect(seen[0][0]).toBe(`${texts[0]}\n\n${texts[1]}`);
  });
  it("tudo forte: sem avisos. Falha do jev: sem avisos, sem erro", async () => {
    const { db } = fakeDb();
    expect(await cutsWarnings(db, "p1", [cut("a", 1, 1)], async () => ({ hook: [0.9], restart: null }))).toEqual([]);
    expect(await cutsWarnings(db, "p1", [cut("a", 1, 1)], async () => { throw new Error("x"); })).toEqual([]);
  });
});
