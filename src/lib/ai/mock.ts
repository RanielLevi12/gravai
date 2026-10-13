// Provedor falso. Sem "server-only" para poder ser usado direto em testes.
import fs from "node:fs";
import path from "node:path";
import { AiError, type OcrImage, type ScriptCheck, type Transcription } from "./schemas";

export type MockFn =
  | "ocrImages"
  | "ocrPdf"
  | "transcribeAudio"
  | "generateJson"
  | "scoreViral"
  | "checkScript";

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

function fixture(fn: MockFn): unknown {
  const file = path.join(process.cwd(), "tests", "fixtures", "ai", `${fn}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function next(fn: MockFn): unknown {
  calls[fn] = (calls[fn] ?? 0) + 1;
  const q = queues[fn];
  if (q && q.length > 0) return q.shift();
  if (fn in constants) return constants[fn];
  return fixture(fn);
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

/** Texto JSON bruto, como o provedor real devolveria. */
export async function rawJson(_schema: Record<string, unknown>, _system: string, _user: string): Promise<string> {
  const value = next("generateJson");
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

export async function checkScript(
  _text: string,
  opts: { tone: string; cta?: string },
): Promise<ScriptCheck> {
  const v = next("checkScript") as ScriptCheck;
  return { toneOk: v.toneOk, ctaPresent: opts.cta ? (v.ctaPresent ?? 0) : null };
}

export { AiError };
