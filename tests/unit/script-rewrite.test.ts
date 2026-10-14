import { beforeEach, describe, expect, it, vi } from "vitest";
import * as mockProvider from "@/lib/ai/mock";
import { getMockCalls, resetMock, setMockResponse } from "@/lib/ai/mock";
import { AiError, userAiFrom } from "@/lib/ai";
import { buildRewriteUser } from "@/lib/script/prompts";
import { rewriteBlockWith, updateBlockTextWith, type BlockContext, type BlockDb } from "@/lib/script/rewrite";

const PALAVRAS = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`).join(" ");

class FakeBlockDb implements BlockDb {
  saved: Record<string, string> = {};
  constructor(public ctx: BlockContext | null) {}
  async blockContext() {
    return this.ctx;
  }
  async saveBlockText(id: string, text: string) {
    if (!this.ctx) return false;
    this.saved[id] = text;
    return true;
  }
}

const CUT: BlockContext = { kind: "cut", text: PALAVRAS(75), previous: "antes", next: "depois", cutSeconds: 30, tone: "didático" };
const deps = (db: BlockDb) => ({ db, ai: async () => userAiFrom(mockProvider) });

describe("buildRewriteUser", () => {

  it("\"tirar saudação\" manda começar direto na ideia e é aceito pelo servidor", async () => {
    const u = buildRewriteUser({ ...base, kind: "body", instruction: "noGreeting" });
    expect(u).toMatch(/Tire a saudação/);
    expect(u).toMatch(/Fala, pessoal/);
    await expect(rewriteBlockWith(deps(new FakeBlockDb({ ...CUT, kind: "body", cutSeconds: null })), "b1", "noGreeting")).resolves.toHaveProperty("text");
  });
  const base = { kind: "cut" as const, text: "texto atual", previous: "texto antes", next: "texto depois", tone: "didático", cutSeconds: 30 };

  it("leva o pedido, o tom, os vizinhos como contexto e o limite do corte", () => {
    const u = buildRewriteUser({ ...base, instruction: "shorter" });
    expect(u).toContain("Deixe mais curto");
    expect(u).toContain("Tom de voz: didático");
    expect(u).toContain("texto antes");
    expect(u).toContain("texto depois");
    expect(u).toContain("corte de 30 segundos");
    expect(u).toContain("cerca de 75 palavras e no máximo 90");
    expect(u.indexOf("Trecho a reescrever")).toBeGreaterThan(u.indexOf("texto depois"));
  });

  it("usa o pedido livre e omite o limite fora de um corte", () => {
    const u = buildRewriteUser({ ...base, kind: "opening", previous: null, instruction: { custom: "  com um exemplo  " } });
    expect(u).toContain("Pedido: com um exemplo");
    expect(u).not.toContain("corte de 30 segundos");
    expect(u).not.toContain("vem antes");
  });
});

describe("rewriteBlock", () => {
  beforeEach(() => resetMock());

  it("devolve o texto novo sem gravar", async () => {
    const db = new FakeBlockDb(CUT);
    setMockResponse("generateJson", [{ text: "  novo texto curto  " }]);
    await expect(rewriteBlockWith(deps(db), "b1", "shorter")).resolves.toEqual({ text: "novo texto curto" });
    expect(db.saved).toEqual({});
  });

  it("em corte, tenta de novo quando passa do tempo e aceita a versão dentro do limite", async () => {
    const db = new FakeBlockDb(CUT);
    setMockResponse("generateJson", [{ text: PALAVRAS(120) }, { text: PALAVRAS(60) }]);
    const r = await rewriteBlockWith(deps(db), "b1", "direct");
    expect(r.text).toBe(PALAVRAS(60));
    expect(getMockCalls("generateJson")).toBe(2);
  });

  it("em corte, recusa quando as duas tentativas passam do tempo do corte", async () => {
    const db = new FakeBlockDb(CUT);
    setMockResponse("generateJson", [{ text: PALAVRAS(120) }, { text: PALAVRAS(110) }]);
    await expect(rewriteBlockWith(deps(db), "b1", "emotional")).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("fora de corte não limita a duração", async () => {
    const db = new FakeBlockDb({ ...CUT, kind: "opening" });
    setMockResponse("generateJson", [{ text: PALAVRAS(200) }]);
    await expect(rewriteBlockWith(deps(db), "b1", "hook")).resolves.toHaveProperty("text", PALAVRAS(200));
    expect(getMockCalls("generateJson")).toBe(1);
  });

  it("tenta de novo quando a IA devolve texto vazio e falha se continuar vazio", async () => {
    const db = new FakeBlockDb(CUT);
    setMockResponse("generateJson", [{ text: "  " }, { text: "" }]);
    await expect(rewriteBlockWith(deps(db), "b1", "simpler")).rejects.toBeInstanceOf(AiError);
    expect(getMockCalls("generateJson")).toBe(2);
  });

  it.each([["" ], ["   "], ["x".repeat(301)], ["inventado"], [null], [{ custom: 5 }]])("recusa pedido inválido (%j) antes de chamar a IA", async (mode) => {
    const db = new FakeBlockDb(CUT);
    await expect(rewriteBlockWith(deps(db), "b1", mode)).rejects.toMatchObject({ code: "invalid_input" });
    expect(getMockCalls("generateJson")).toBe(0);
  });

  it("bloco inexistente não chama a IA", async () => {
    const ai = vi.fn();
    await expect(rewriteBlockWith({ db: new FakeBlockDb(null), ai }, "b1", "shorter")).rejects.toMatchObject({ code: "invalid_input" });
    expect(ai).not.toHaveBeenCalled();
  });
});

describe("updateBlockText", () => {
  it("grava o texto, inclusive vazio", async () => {
    const db = new FakeBlockDb(CUT);
    await updateBlockTextWith(db, "b1", "novo");
    await updateBlockTextWith(db, "b1", "");
    expect(db.saved).toEqual({ b1: "" });
  });

  it("recusa texto grande demais ou de outro tipo e bloco que não existe", async () => {
    const db = new FakeBlockDb(CUT);
    await expect(updateBlockTextWith(db, "b1", "x".repeat(6001))).rejects.toThrow();
    await expect(updateBlockTextWith(db, "b1", 42)).rejects.toThrow();
    await expect(updateBlockTextWith(new FakeBlockDb(null), "b1", "ok")).rejects.toThrow("Trecho não encontrado.");
  });
});
