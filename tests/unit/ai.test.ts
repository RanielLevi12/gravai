import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

process.env.AI_MOCK = "1";

import {
  AiError,
  checkScript,
  generateJson,
  ocrImages,
  ocrPdf,
  scoreViral,
  transcribeAudio,
} from "@/lib/ai";
import {
  getMockCalls,
  resetMock,
  setMockInvalidJson,
  setMockResponse,
} from "@/lib/ai/mock";

beforeEach(() => resetMock());
afterEach(() => resetMock());

describe("camada de IA com mock", () => {
  it("generateJson devolve o objeto do fixture", async () => {
    const r = await generateJson(z.object({ a: z.number() }), "s", "u");
    expect(r).toEqual({ a: 1 });
    expect(getMockCalls("generateJson")).toBe(1);
  });

  it("scoreViral devolve notas 0..1 na mesma ordem", async () => {
    const r = await scoreViral(["a", "b"], "c");
    expect(r).toHaveLength(2);
    for (const n of r) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it("generateJson lança AiError após JSON inválido duas vezes", async () => {
    setMockInvalidJson(2);
    const p = generateJson(z.object({ a: z.number() }), "s", "u");
    await expect(p).rejects.toBeInstanceOf(AiError);
    await expect(
      (async () => {
        setMockInvalidJson(2);
        return generateJson(z.object({ a: z.number() }), "s", "u");
      })(),
    ).rejects.toMatchObject({ userMessage: expect.stringContaining("IA") });
  });

  it("generateJson tenta de novo uma vez e se recupera", async () => {
    setMockInvalidJson(1);
    const r = await generateJson(z.object({ a: z.number() }), "s", "u");
    expect(r).toEqual({ a: 1 });
    expect(getMockCalls("generateJson")).toBe(2);
  });

  it("setMockResponse enfileira respostas por chamada", async () => {
    setMockResponse("generateJson", [{ a: 5 }, { a: 6 }]);
    const s = z.object({ a: z.number() });
    expect(await generateJson(s, "s", "u")).toEqual({ a: 5 });
    expect(await generateJson(s, "s", "u")).toEqual({ a: 6 });
    expect(await generateJson(s, "s", "u")).toEqual({ a: 1 });
  });

  it("ocr, transcrição e checkScript usam fixtures e contam chamadas", async () => {
    expect(typeof (await ocrImages([{ data: Buffer.from("x"), mediaType: "image/png" }]))).toBe("string");
    expect(typeof (await ocrPdf(Buffer.from("x")))).toBe("string");
    const t = await transcribeAudio(Buffer.from("x"), "a.mp3");
    expect(t.seconds).toBeGreaterThan(0);
    const c = await checkScript("texto", { tone: "leve", cta: "assine" });
    expect(c.ctaPresent).not.toBeNull();
    const c2 = await checkScript("texto", { tone: "leve" });
    expect(c2.ctaPresent).toBeNull();
    expect(getMockCalls("ocrPdf")).toBe(1);
    expect(getMockCalls("ocrImages")).toBe(1);
  });
});
