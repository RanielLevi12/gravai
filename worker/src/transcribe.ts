import { readFile } from "node:fs/promises";
import type { Word } from "./align";

export type TranscribeFn = (input: { audioFile: string; jobId: string; recordingId: string }) => Promise<Word[]>;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta a variável ${name}`);
  return v;
}

/** Pede ao app a transcrição com tempos (a chave de IA do usuário só existe lá). */
export const transcribeViaApp: TranscribeFn = async ({ audioFile, jobId, recordingId }) => {
  const url = new URL("/api/internal/transcribe", env("APP_URL"));
  url.searchParams.set("job", jobId);
  url.searchParams.set("recording", recordingId);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WORKER_SECRET")}`, "Content-Type": "application/octet-stream" },
    body: await readFile(audioFile),
    signal: AbortSignal.timeout(280_000),
  });
  if (!res.ok) throw new Error(`transcrição recusada (status ${res.status})`);
  const json = (await res.json()) as { words?: Word[] };
  if (!Array.isArray(json.words)) throw new Error("transcrição sem palavras");
  return json.words;
};
