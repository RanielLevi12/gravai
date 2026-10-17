import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Db } from "./claim";

/** No R2 há um bucket só; o "balde" antigo (recordings/exports) vira prefixo da chave. */
export const r2Key = (area: string, storagePath: string) => `${area}/${storagePath}`;

let cached: { client: S3Client; bucket: string } | null = null;

/** Cliente do R2 pelas variáveis de ambiente (R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY). */
export function r2(): { client: S3Client; bucket: string } {
  if (cached) return cached;
  const { R2_ACCOUNT_ID: account, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
  if (!account || !bucket || !accessKeyId || !secretAccessKey) throw new Error("R2 não configurado (faltam variáveis R2_*)");
  const client = new S3Client({
    region: "auto",
    forcePathStyle: true,
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // O R2 não aceita os checksums extras que o SDK novo adiciona por padrão.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return (cached = { client, bucket });
}

/** Só para testes: troca o cliente do R2. */
export function setR2ForTests(v: { client: S3Client; bucket: string } | null) {
  cached = v;
}

/** Baixa um arquivo do R2 direto para o disco, aos poucos (gravações de até 500 MB não cabem na memória). */
export async function download(_db: Db, bucket: string, storagePath: string, dest: string): Promise<void> {
  const fail = (why: string) => new Error(`download ${bucket}/${storagePath}: ${why}`);
  const { client, bucket: b } = r2();
  let body: unknown;
  try {
    body = (await client.send(new GetObjectCommand({ Bucket: b, Key: r2Key(bucket, storagePath) }))).Body;
  } catch (e) {
    throw fail(e instanceof Error ? e.message : "erro");
  }
  if (!(body instanceof Readable)) throw fail("sem conteúdo");
  await pipeline(body, createWriteStream(dest));
}

/** Sobe `file` para o R2 em "exports" (substitui se já existir), em partes: o arquivo nunca fica inteiro na memória. */
export async function upload(_db: Db, storagePath: string, file: string, mime: string): Promise<{ sizeBytes: number }> {
  const { size } = await stat(file);
  const { client, bucket } = r2();
  try {
    await new Upload({
      client,
      params: { Bucket: bucket, Key: r2Key("exports", storagePath), Body: createReadStream(file), ContentType: mime },
      partSize: 8 * 1024 * 1024,
      queueSize: 3,
    }).done();
  } catch (e) {
    throw new Error(`upload exports/${storagePath}: ${e instanceof Error ? e.message : "erro"}`);
  }
  return { sizeBytes: size };
}
