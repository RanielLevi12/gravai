// Provedor falso. Sem "server-only" para poder ser usado direto em testes.
import fs from "node:fs";
import path from "node:path";
import { AiError, type OcrImage, type ExcerptReview, type ScriptCheck, type Transcription, type WordTranscription } from "./schemas";

export type MockFn =
  | "ocrImages"
  | "ocrPdf"
  | "transcribeAudio"
  | "transcribeWords"
  | "generateJson"
  | "scoreViral"
  | "scoreClosing"
  | "checkScript"
  | "reviewExcerpts";

const calls: Record<string, number> = {};
const queues: Record<string, unknown[]> = {};
const constants: Record<string, unknown> = {};
let invalidJsonLeft = 0;

/** Zera contadores, filas, respostas fixas e o forçar-JSON-inválido. Chame no beforeEach. */
export function resetMock(): void {
  for (const k of Object.keys(calls)) delete calls[k];
  for (const k of Object.keys(queues)) delete queues[k];
  for (const k of Object.keys(constants)) delete constants[k];
  invalidJsonLeft = 0;
}

/** Quantas vezes a função foi chamada desde o último resetMock(). */
export function getMockCalls(fn: MockFn): number {
  return calls[fn] ?? 0;
}

/**
 * Define a resposta da função. Array = fila (uma resposta por chamada, na ordem; depois cai no fixture).
 * Valor único = usado em todas as chamadas. Para uma resposta que é ela mesma um array
 * (ex.: scoreViral), envolva em fila: setMockResponse("scoreViral", [[0.1, 0.9]]).
 * Em generateJson, vale por tentativa (inclusive a nova tentativa após validação falhar).
 */
export function setMockResponse(fn: MockFn, value: unknown): void {
  delete queues[fn];
  delete constants[fn];
  if (Array.isArray(value)) queues[fn] = [...value];
  else constants[fn] = value;
}

/** Força as próximas `n` chamadas de generateJson (tentativas) a devolver JSON inválido. */
export function setMockInvalidJson(n: number): void {
  invalidJsonLeft = n;
}

/**
 * Fixture da função. `variant` escolhe `{fn}.{variant}.json` quando existe (em generateJson,
 * o `title` do JSON Schema, ex.: interview_suggestion); senão cai em `{fn}.json`.
 */
function fixture(fn: MockFn, variant?: string): unknown {
  const dir = path.join(process.cwd(), "tests", "fixtures", "ai");
  const specific = variant && /^[a-z0-9_]+$/.test(variant) ? path.join(dir, `${fn}.${variant}.json`) : null;
  const file = specific && fs.existsSync(specific) ? specific : path.join(dir, `${fn}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function next(fn: MockFn, variant?: string): unknown {
  calls[fn] = (calls[fn] ?? 0) + 1;
  const q = queues[fn];
  if (q && q.length > 0) return q.shift();
  if (fn in constants) return constants[fn];
  return fixture(fn, variant);
}

export async function ocrImages(_images: OcrImage[]): Promise<string> {
  return next("ocrImages") as string;
}

export async function ocrPdf(_pdf: Buffer): Promise<string> {
  return next("ocrPdf") as string;
}

export async function transcribeAudio(_file: Buffer, _filename: string): Promise<Transcription> {
  return next("transcribeAudio") as Transcription;
}

export async function transcribeWords(_file: Buffer, _filename: string): Promise<WordTranscription> {
  return next("transcribeWords") as WordTranscription;
}

/** Texto JSON bruto, como o provedor real devolveria. */
export async function rawJson(schema: Record<string, unknown>, _system: string, _user: string): Promise<string> {
  const value = next("generateJson", typeof schema.title === "string" ? schema.title : undefined);
  if (invalidJsonLeft > 0) {
    invalidJsonLeft--;
    return "{ isto não é json";
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function scoreViral(titles: string[], _context: string): Promise<number[]> {
  const v = next("scoreViral") as number[];
  return titles.map((_, i) => v[i % v.length]);
}

export async function scoreClosing(texts: string[], _context: string): Promise<number[]> {
  const v = next("scoreClosing") as number[];
  return texts.map((_, i) => v[i % v.length]);
}

export async function checkScript(
  _text: string,
  opts: { tone: string; cta?: string },
): Promise<ScriptCheck> {
  const v = next("checkScript") as ScriptCheck;
  return { toneOk: v.toneOk, ctaPresent: opts.cta ? (v.ctaPresent ?? 0) : null };
}

/** Resposta fixa/fila: `{ hook?: number[]; restart?: number[] }`. O que faltar vira "gancho forte, sem recomeço". */
export async function reviewExcerpts(texts: string[], opts: { restart: boolean }): Promise<ExcerptReview> {
  const v = next("reviewExcerpts") as { hook?: number[]; restart?: number[] };
  return {
    hook: texts.map((_, i) => v.hook?.[i] ?? 1),
    restart: opts.restart ? texts.map((_, i) => v.restart?.[i] ?? 0) : null,
  };
}

export { AiError };
