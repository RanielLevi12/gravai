import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

process.env.AI_MOCK = "1";

const keys = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("@/lib/ai/keys", () => ({ getUserAiKey: async () => keys.value }));

import { AiError, checkScript, scoreViral, withUserAi, type OcrImage } from "@/lib/ai";
import { stripNulls, toStrictJsonSchema } from "@/lib/ai/schemas";
import {
  getMockCalls,
  resetMock,
  setMockInvalidJson,
  setMockResponse,
} from "@/lib/ai/mock";

const UID = "11111111-1111-4111-8111-111111111111";
// Funções por usuário vêm de withUserAi; com AI_MOCK=1 não exigem conexão.
const generateJson = <T,>(schema: z.ZodType<T>, system: string, user: string) =>
  withUserAi(UID).then((ai) => ai.generateJson(schema, system, user));
const ocrImages = (images: OcrImage[]) => withUserAi(UID).then((ai) => ai.ocrImages(images));
const ocrPdf = (pdf: Buffer) => withUserAi(UID).then((ai) => ai.ocrPdf(pdf));
const transcribeAudio = (f: Buffer, n: string) => withUserAi(UID).then((ai) => ai.transcribeAudio(f, n));

beforeEach(() => {
  resetMock();
  keys.value = null;
});
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

describe("schema strict e stripNulls", () => {
  const schema = z.object({
    a: z.string(),
    b: z.string().optional(),
    d: z.partialRecord(z.enum(["youtube", "reels"]), z.string()),
  });

  it("toStrictJsonSchema deixa tudo required, sem propertyNames", () => {
    const js = toStrictJsonSchema(schema) as any;
    expect(js.required).toEqual(["a", "b", "d"]);
    expect(js.additionalProperties).toBe(false);
    expect(js.properties.b.anyOf).toContainEqual({ type: "null" });
    expect(js.properties.d.required).toEqual(["youtube", "reels"]);
    expect(js.properties.d.additionalProperties).toBe(false);
    expect(JSON.stringify(js)).not.toContain("propertyNames");
    expect(js.properties.d.properties.reels.anyOf).toContainEqual({ type: "null" });
  });

  it("resposta com nulls valida para o objeto sem as chaves nulas", async () => {
    const reply = { a: "x", b: null, d: { youtube: "y", reels: null } };
    expect(schema.parse(stripNulls(reply))).toEqual({ a: "x", d: { youtube: "y" } });
    setMockResponse("generateJson", reply);
    expect(await generateJson(schema, "s", "u")).toEqual({ a: "x", d: { youtube: "y" } });
  });
});

describe("trava de produção do mock", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lança AiError em produção sem AI_MOCK_ALLOW_PROD", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(ocrPdf(Buffer.from("x"))).rejects.toBeInstanceOf(AiError);
  });

  it("permite com AI_MOCK_ALLOW_PROD=1", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_MOCK_ALLOW_PROD", "1");
    await expect(ocrPdf(Buffer.from("x"))).resolves.toBeTypeOf("string");
  });
});

describe("stripOptionalNulls", () => {
  it("mantém null em campo .nullable()", async () => {
    const sch = z.object({ n: z.number().nullable(), o: z.string().optional() });
    setMockResponse("generateJson", { n: null, o: null });
    expect(await generateJson(sch, "s", "u")).toEqual({ n: null });
  });

  it("array de objetos com opcional null vira chave ausente", async () => {
    const sch = z.object({ itens: z.array(z.object({ k: z.string(), x: z.number().optional(), m: z.string().nullable() })) });
    setMockResponse("generateJson", { itens: [{ k: "a", x: null, m: null }, { k: "b", x: 2, m: "z" }] });
    expect(await generateJson(sch, "s", "u")).toEqual({
      itens: [{ k: "a", m: null }, { k: "b", x: 2, m: "z" }],
    });
  });
});

describe("withUserAi", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sem conexão e sem mock → AiError code 'not_connected'", async () => {
    vi.stubEnv("AI_MOCK", "");
    const err = await withUserAi(UID).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("not_connected");
    expect(err.userMessage).toBe("Conecte sua conta de IA para continuar.");
  });

  it("com AI_MOCK=1 funciona sem conexão", async () => {
    const ai = await withUserAi(UID);
    expect(await ai.ocrPdf(Buffer.from("x"))).toBeTypeOf("string");
    expect(await ai.generateJson(z.object({ a: z.number() }), "s", "u")).toEqual({ a: 1 });
  });

  it("com conexão e sem mock devolve as quatro funções", async () => {
    vi.stubEnv("AI_MOCK", "");
    keys.value = "sk-or-v1-x";
    const ai = await withUserAi(UID);
    expect(Object.keys(ai).sort()).toEqual(["generateJson", "ocrImages", "ocrPdf", "transcribeAudio"]);
  });

  it("JSON inválido duas vezes → code 'invalid_output'", async () => {
    setMockInvalidJson(2);
    const err = await generateJson(z.object({ a: z.number() }), "s", "u").catch((e) => e);
    expect(err.code).toBe("invalid_output");
  });
});
