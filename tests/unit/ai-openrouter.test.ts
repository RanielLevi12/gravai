import { describe, expect, it } from "vitest";
import { AiError } from "@/lib/ai/schemas";
import { createOpenRouterAi, AUDIO_MODEL, OCR_MODEL, TEXT_MODEL } from "@/lib/ai/openrouter";

type Captured = { url: string; headers: Headers; body: any };

function fakeFetch(reply: string | (() => Response), sink: Captured[]) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    sink.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    if (typeof reply === "function") return reply();
    return new Response(
      JSON.stringify({
        id: "gen-1",
        object: "chat.completion",
        created: 0,
        model: "x",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: reply } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

/** WAV PCM 16-bit mono de `seconds` segundos de silêncio. */
function wav(seconds: number, rate = 8000): Buffer {
  const data = rate * 2 * seconds;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + data, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(data, 40);
  return b;
}

const KEY = "sk-or-v1-teste";

describe("openrouter.ts", () => {
  it("usa a chave do usuário como Bearer na base do OpenRouter", async () => {
    const sink: Captured[] = [];
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch("{}", sink) });
    await ai.rawJson({ type: "object" }, "s", "u");
    expect(sink[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(sink[0].headers.get("authorization")).toBe(`Bearer ${KEY}`);
  });

  it("rawJson: modelo de texto, json_schema strict e require_parameters", async () => {
    const sink: Captured[] = [];
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch('{"a":1}', sink) });
    const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false };
    expect(await ai.rawJson(schema, "sys", "usr")).toBe('{"a":1}');
    const b = sink[0].body;
    expect(b.model).toBe(TEXT_MODEL);
    expect(b.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "usr" },
    ]);
    expect(b.response_format).toEqual({ type: "json_schema", json_schema: { name: "resposta", strict: true, schema } });
    expect(b.provider).toEqual({ require_parameters: true });
  });

  it("ocrImages: partes image_url com data URL, na ordem, depois a instrução", async () => {
    const sink: Captured[] = [];
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch("  página um\npágina dois ", sink) });
    const out = await ai.ocrImages([
      { data: Buffer.from("img1"), mediaType: "image/png" },
      { data: Buffer.from("img2"), mediaType: "image/jpeg" },
    ]);
    expect(out).toBe("página um\npágina dois");
    const b = sink[0].body;
    expect(b.model).toBe(OCR_MODEL);
    const parts = b.messages[0].content;
    expect(parts[0]).toEqual({ type: "image_url", image_url: { url: `data:image/png;base64,${Buffer.from("img1").toString("base64")}` } });
    expect(parts[1]).toEqual({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${Buffer.from("img2").toString("base64")}` } });
    expect(parts[2].type).toBe("text");
    expect(parts[2].text).toMatch(/transcreva fielmente/i);
  });

  it("ocrPdf: parte file com data URL de PDF e motor nativo", async () => {
    const sink: Captured[] = [];
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch("texto do pdf", sink) });
    const pdf = Buffer.from("%PDF-1.4 fake");
    expect(await ai.ocrPdf(pdf)).toBe("texto do pdf");
    const b = sink[0].body;
    expect(b.model).toBe(OCR_MODEL);
    expect(b.messages[0].content[0]).toEqual({
      type: "file",
      file: { filename: "documento.pdf", file_data: `data:application/pdf;base64,${pdf.toString("base64")}` },
    });
    expect(b.plugins).toEqual([{ id: "file-parser", pdf: { engine: "native" } }]);
  });

  it("transcribeAudio: input_audio com formato, segundos lidos do arquivo", async () => {
    const sink: Captured[] = [];
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch("olá mundo", sink) });
    const audio = wav(2);
    const t = await ai.transcribeAudio(audio, "ideia.wav");
    expect(t.text).toBe("olá mundo");
    expect(t.seconds).toBeCloseTo(2, 1);
    const b = sink[0].body;
    expect(b.model).toBe(AUDIO_MODEL);
    const parts = b.messages[0].content;
    expect(parts).toContainEqual({ type: "input_audio", input_audio: { data: audio.toString("base64"), format: "wav" } });
    expect(parts.find((p: any) => p.type === "text").text).toMatch(/transcreva fielmente, sem comentar/i);
  });

  it("transcribeAudio sem duração legível → AiError, sem chamar o modelo", async () => {
    const sink: Captured[] = [];
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch("x", sink) });
    const err = await ai.transcribeAudio(Buffer.from("isto não é áudio"), "a.mp3").catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("invalid_input");
    expect(sink).toHaveLength(0);
  });

  it("transcribeAudio em webm (formato não aceito) → AiError code 'invalid_input'", async () => {
    const sink: Captured[] = [];
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch("x", sink) });
    // cabeçalho EBML mínimo de WebM
    const webm = Buffer.from("1a45dfa39f4286810142f7810142f2810442f381084282847765626d42878104428581021853806701ffffffffffffff", "hex");
    const err = await ai.transcribeAudio(webm, "gravacao.webm").catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("invalid_input");
    expect(sink).toHaveLength(0);
  });

  it("erro do provedor vira AiError code 'provider' sem a chave na mensagem", async () => {
    const sink: Captured[] = [];
    const ai = createOpenRouterAi(KEY, {
      fetch: fakeFetch(() => new Response(JSON.stringify({ error: { message: "No credits" } }), { status: 402 }), sink),
    });
    const err = await ai.ocrPdf(Buffer.from("x")).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("provider");
    expect(err.userMessage).not.toContain(KEY);
    expect(err.message).not.toContain(KEY);
  });

  it("rawJson: define max_tokens e recusa resposta cortada (finish_reason length) sem repetir", async () => {
    const sink: Captured[] = [];
    const cortada = () =>
      new Response(
        JSON.stringify({
          id: "g", object: "chat.completion", created: 0, model: "x",
          choices: [{ index: 0, finish_reason: "length", message: { role: "assistant", content: '{"blocks":[' } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch(cortada, sink) });
    const err = await ai.rawJson({ type: "object" }, "s", "u").catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("invalid_output");
    expect(sink).toHaveLength(1);
    expect(sink[0].body.max_tokens).toBe(16_000);
  });

  it("chamada que trava vira AiError 'provider' pelo timeout, com uma nova tentativa só", async () => {
    let calls = 0;
    const travado = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }) as typeof fetch;
    const ai = createOpenRouterAi(KEY, { fetch: travado, timeoutMs: 40 });
    const err = await ai.rawJson({ type: "object" }, "s", "u").catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("provider");
    expect(calls).toBe(2);
    calls = 0;
    await expect(ai.ocrImages([{ data: Buffer.from("x"), mediaType: "image/png" }])).rejects.toBeInstanceOf(AiError);
    expect(calls).toBe(1);
  });
});
