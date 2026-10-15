import { describe, expect, it } from "vitest";
import { createOpenRouterAi, WORDS_MODEL } from "@/lib/ai/openrouter";
import type { AiUsage } from "@/lib/ai/usage-types";
import { AiError } from "@/lib/ai/schemas";

const KEY = "sk-or-v1-teste";

function fakeFetch(reply: () => Response, sink: { url: string; headers: Headers; form: FormData }[]) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    sink.push({ url, headers: new Headers(init?.headers), form: init?.body as FormData });
    return reply();
  }) as typeof fetch;
}

const ok = () =>
  new Response(
    JSON.stringify({
      text: "olá mundo",
      duration: 1.5,
      words: [
        { word: "olá", start: 0.1, end: 0.5 },
        { word: "mundo", start: 0.6, end: 1.2 },
      ],
      usage: { cost: 0.0004, seconds: 1.5 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

describe("transcribeWords", () => {
  it("envia o áudio ao endpoint de transcrição pedindo tempo por palavra e devolve as palavras", async () => {
    const sink: { url: string; headers: Headers; form: FormData }[] = [];
    const usage: AiUsage[] = [];
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch(ok, sink), onUsage: (u) => usage.push(u) });
    const res = await ai.transcribeWords(Buffer.from("fake-mp3"), "audio.mp3");

    expect(res).toEqual({
      words: [
        { w: "olá", s: 0.1, e: 0.5 },
        { w: "mundo", s: 0.6, e: 1.2 },
      ],
      seconds: 1.5,
    });
    expect(sink[0].url).toBe("https://openrouter.ai/api/v1/audio/transcriptions");
    expect(sink[0].headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(sink[0].form.get("model")).toBe(WORDS_MODEL);
    expect(sink[0].form.get("response_format")).toBe("verbose_json");
    expect(sink[0].form.getAll("timestamp_granularities[]")).toEqual(["word"]);
    expect((sink[0].form.get("file") as File).name).toBe("audio.mp3");
    expect(usage).toEqual([{ kind: "audio", model: WORDS_MODEL, costUsd: 0.0004 }]);
  });

  it("erro do provedor vira AiError 'provider' sem a chave", async () => {
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch(() => new Response("no credits", { status: 402 }), []) });
    const err = await ai.transcribeWords(Buffer.from("x"), "a.mp3").catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("provider");
    expect(err.message).not.toContain(KEY);
  });

  it("resposta sem palavras → AiError 'invalid_output'", async () => {
    const ai = createOpenRouterAi(KEY, { fetch: fakeFetch(() => new Response(JSON.stringify({ text: "x", duration: 1 })), []) });
    const err = await ai.transcribeWords(Buffer.from("x"), "a.mp3").catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("invalid_output");
  });
});
