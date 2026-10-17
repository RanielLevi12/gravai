export const MSG_UPLOAD_FAILED = "Não consegui enviar o vídeo. Veja a internet e tente de novo.";

/** Erro com mensagem pronta para mostrar (ex.: espaço cheio). Não adianta tentar de novo. */
export class UploadRejected extends Error {}

type Part = { PartNumber: number; ETag: string };
type PutPart = (url: string, body: Blob, onProgress: (loaded: number) => void, signal?: AbortSignal) => Promise<string>;

const RETRY_DELAYS = [1000, 3000, 5000, 10000];
const PARALLEL = 3;
const storeKey = (recordingId: string) => `gravai:upload:${recordingId}`;

/** Manda uma parte direto ao R2 e devolve o ETag (precisa estar liberado no CORS do bucket). */
const putPartXhr: PutPart = (url, body, onProgress, signal) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      const etag = xhr.getResponseHeader("etag");
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
      else reject(new Error(`parte: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("parte: rede"));
    signal?.addEventListener("abort", () => (xhr.abort(), reject(new Error("abortado"))), { once: true });
    xhr.send(body);
  });

async function api<T>(path: string, body: object, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/upload/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (res.ok && json) return json;
  // 4xx traz uma mensagem para a pessoa; 5xx é problema passageiro e entra na regra de tentar de novo.
  if (res.status >= 400 && res.status < 500 && json?.error) throw new UploadRejected(json.error);
  throw new Error(`${path}: HTTP ${res.status}`);
}

function remembered(recordingId: string, set?: string | null): string | null {
  try {
    if (set === null) localStorage.removeItem(storeKey(recordingId));
    else if (set) localStorage.setItem(storeKey(recordingId), set);
    else return localStorage.getItem(storeKey(recordingId));
  } catch {
    // Sem armazenamento (aba anônima): o envio funciona, só não retoma depois de fechar a página.
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Envia a gravação ao R2 em partes de 8 MB, com links gerados pelo servidor (que confere o dono).
 * Se a página fechar no meio, o próximo envio da mesma gravação continua de onde parou.
 * Devolve o tamanho real que o R2 recebeu.
 */
export async function uploadRecording(
  input: {
    blob: Blob;
    recordingId: string;
    onProgress?: (sent: number, total: number) => void;
    signal?: AbortSignal;
  },
  putPart: PutPart = putPartXhr,
): Promise<{ sizeBytes: number }> {
  const { blob, recordingId, signal } = input;
  const total = blob.size;
  try {
    if (signal?.aborted) throw new Error("abortado");
    const started = await api<{ uploadId: string; partSize: number; done: Part[] }>(
      "start",
      { recordingId, size: total, uploadId: remembered(recordingId) },
      signal,
    );
    const { uploadId, partSize } = started;
    remembered(recordingId, uploadId);

    const count = Math.ceil(total / partSize);
    const parts = new Map<number, string>(started.done.filter((p) => p.PartNumber <= count).map((p) => [p.PartNumber, p.ETag]));
    const sizeOf = (n: number) => (n < count ? partSize : total - partSize * (count - 1));
    const loaded = new Map<number, number>([...parts.keys()].map((n) => [n, sizeOf(n)]));
    const report = () => input.onProgress?.([...loaded.values()].reduce((a, b) => a + b, 0), total);
    report();

    const queue = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !parts.has(n));
    async function sendPart(n: number) {
      const piece = blob.slice((n - 1) * partSize, (n - 1) * partSize + sizeOf(n));
      for (let attempt = 0; ; attempt++) {
        try {
          const { urls } = await api<{ urls: { PartNumber: number; url: string }[] }>("part-urls", { recordingId, uploadId, partNumbers: [n] }, signal);
          const etag = await putPart(urls[0].url, piece, (l) => (loaded.set(n, l), report()), signal);
          parts.set(n, etag);
          loaded.set(n, sizeOf(n));
          report();
          return;
        } catch (e) {
          if (e instanceof UploadRejected || signal?.aborted || attempt >= RETRY_DELAYS.length) throw e;
          loaded.set(n, 0);
          await sleep(RETRY_DELAYS[attempt]);
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
        for (let n = queue.shift(); n !== undefined; n = queue.shift()) await sendPart(n);
      }),
    );

    const done = await api<{ sizeBytes: number }>(
      "complete",
      { recordingId, uploadId, parts: [...parts].map(([PartNumber, ETag]) => ({ PartNumber, ETag })) },
      signal,
    );
    remembered(recordingId, null);
    return done;
  } catch (e) {
    if (e instanceof UploadRejected) {
      remembered(recordingId, null);
      throw e;
    }
    throw new Error(MSG_UPLOAD_FAILED);
  }
}
