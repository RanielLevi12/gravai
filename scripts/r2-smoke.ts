/**
 * Fumaça do R2: envia (multipart com link pré-assinado, como o navegador), lê, apaga, e repete o caminho do
 * worker (stream). Usa as variáveis R2_* do .env.local e nunca imprime chaves.
 *
 *   npm run smoke:r2          (em sandbox/proxy: NODE_USE_ENV_PROXY=1 npm run smoke:r2)
 *
 * Procura o .env.local em R2_ENV_FILE, na pasta atual e na pasta principal do repositório (fora do worktree).
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const candidates = [process.env.R2_ENV_FILE, ".env.local", "../../../.env.local"].filter(Boolean) as string[];
const envFile = candidates.map((p) => path.resolve(p)).find(existsSync);
if (envFile) process.loadEnvFile(envFile);
for (const k of ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
  if (!process.env[k]) throw new Error(`Falta ${k} (procurei em: ${candidates.join(", ")})`);
}

/** Atrás de proxy (NODE_USE_ENV_PROXY=1) o SDK precisa usar o agente global do Node, que já respeita o proxy. */
async function useGlobalProxyAgent() {
  if (!process.env.NODE_USE_ENV_PROXY) return;
  const https = (await import("node:https")).default;
  https.Agent = function () {
    return https.globalAgent;
  } as never;
}

async function main() {
  await useGlobalProxyAgent();
  const { getR2, r2Key } = await import("../src/lib/storage/r2");
  const worker = await import("../worker/src/storage");

  const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
  const step = (msg: string) => console.log(`✓ ${msg}`);
  const r2 = getR2();
  const id = randomUUID();
  const keys: string[] = [];

  try {
    // 1) Como o navegador: partes por link pré-assinado (8 MB + 4 MB) e conclusão.
    const key = r2Key("recordings", `_smoke/${id}.bin`);
    keys.push(key);
    const data = randomBytes(12 * 1024 * 1024);
    const uploadId = await r2.createMultipart(key, "application/octet-stream");
    const parts: { PartNumber: number; ETag: string }[] = [];
    for (const [i, chunk] of [data.subarray(0, 8 * 1024 * 1024), data.subarray(8 * 1024 * 1024)].entries()) {
      const url = await r2.presignPart(key, uploadId, i + 1, 600);
      const res = await fetch(url, { method: "PUT", body: chunk });
      if (!res.ok) throw new Error(`PUT da parte ${i + 1}: HTTP ${res.status}`);
      parts.push({ PartNumber: i + 1, ETag: res.headers.get("etag")! });
    }
    const listed = await r2.listParts(key, uploadId);
    if (listed?.length !== 2) throw new Error("listParts não achou as 2 partes");
    step("envio multipart com links pré-assinados + retomada (listParts)");
    await r2.completeMultipart(key, uploadId, parts);
    const size = await r2.size(key);
    if (size !== data.length) throw new Error(`tamanho no R2 = ${size}, esperado ${data.length}`);
    step(`conclusão e tamanho conferido (${data.length} bytes)`);

    const read = await fetch(await r2.presignGet(key, 300, "teste.bin"));
    if (!read.ok) throw new Error(`GET pré-assinado: HTTP ${read.status}`);
    if (!read.headers.get("content-disposition")?.includes("teste.bin")) throw new Error("download sem o nome pedido");
    if (sha(new Uint8Array(await read.arrayBuffer())) !== sha(data)) throw new Error("conteúdo lido difere do enviado");
    step("leitura por link pré-assinado, conteúdo idêntico, nome de download aplicado");

    // 2) Como o worker: stream do disco para o R2 e de volta.
    const dir = await mkdtemp(path.join(tmpdir(), "r2-smoke-"));
    const src = path.join(dir, "src.bin");
    const back = path.join(dir, "back.bin");
    const payload = randomBytes(9 * 1024 * 1024);
    await writeFile(src, payload);
    const wPath = `_smoke/${id}-worker.bin`;
    keys.push(r2Key("exports", wPath));
    const up = await worker.upload({} as never, wPath, src, "application/octet-stream");
    if (up.sizeBytes !== payload.length) throw new Error("upload do worker devolveu tamanho errado");
    await worker.download({} as never, "exports", wPath, back);
    if ((await stat(back)).size !== payload.length || sha(await readFile(back)) !== sha(payload)) throw new Error("ida e volta do worker difere");
    step("worker: upload e download em stream, ida e volta idênticas");

    // 3) Apagar.
    await r2.deleteMany(keys);
    if ((await r2.size(keys[0])) !== null || (await r2.size(keys[1])) !== null) throw new Error("arquivo ainda existe depois de apagar");
    keys.length = 0;
    step("apagar: objetos removidos");
    console.log("\nR2 OK.");
  } catch (e) {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    if (keys.length) await r2.deleteMany(keys).catch(() => console.error("(não consegui limpar os arquivos de teste)"));
  }
}

void main();
