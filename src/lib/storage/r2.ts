import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** No R2 há um bucket só; o "balde" antigo (recordings/exports) vira prefixo da chave. */
export type Area = "recordings" | "exports";

/** Chave no R2 de um arquivo guardado no banco como `{user}/{projeto}/{arquivo}`. */
export function r2Key(area: Area, storagePath: string): string {
  return `${area}/${storagePath}`;
}

export type R2Part = { PartNumber: number; ETag: string };

export function createR2(client: S3Client, bucket: string) {
  const sign = (cmd: GetObjectCommand | UploadPartCommand, seconds: number) => getSignedUrl(client, cmd as never, { expiresIn: seconds });
  return {
    /** Link temporário de leitura; com `downloadName` o navegador baixa o arquivo com esse nome. */
    presignGet(key: string, seconds: number, downloadName: string | null = null) {
      const name = downloadName?.replace(/[^\w.\- ]/g, "_");
      return sign(
        new GetObjectCommand({ Bucket: bucket, Key: key, ...(name ? { ResponseContentDisposition: `attachment; filename="${name}"` } : {}) }),
        seconds,
      );
    },
    async createMultipart(key: string, contentType: string): Promise<string> {
      const res = await client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }));
      if (!res.UploadId) throw new Error("r2: sem uploadId");
      return res.UploadId;
    },
    presignPart(key: string, uploadId: string, partNumber: number, seconds: number) {
      return sign(new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), seconds);
    },
    /** Partes já recebidas de um envio em andamento; `null` se esse envio não existe mais. */
    async listParts(key: string, uploadId: string): Promise<{ PartNumber: number; ETag: string; Size: number }[] | null> {
      const out: { PartNumber: number; ETag: string; Size: number }[] = [];
      let marker: string | undefined;
      try {
        for (;;) {
          const res = await client.send(new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }));
          for (const p of res.Parts ?? []) out.push({ PartNumber: p.PartNumber!, ETag: p.ETag!, Size: p.Size ?? 0 });
          if (!res.IsTruncated) return out;
          marker = String(res.NextPartNumberMarker);
        }
      } catch (e) {
        if (e instanceof Error && e.name === "NoSuchUpload") return null;
        throw e;
      }
    },
    async completeMultipart(key: string, uploadId: string, parts: R2Part[]) {
      const sorted = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
      await client.send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: sorted } }));
    },
    /** Tamanho em bytes, ou `null` se o objeto não existe. */
    async size(key: string): Promise<number | null> {
      try {
        const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return res.ContentLength ?? 0;
      } catch (e) {
        if (e instanceof Error && (e.name === "NotFound" || e.name === "NoSuchKey")) return null;
        throw e;
      }
    },
    async getBytes(key: string): Promise<Uint8Array> {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) throw new Error("r2: objeto vazio");
      return res.Body.transformToByteArray();
    },
    /** Apaga em lotes de 1000 (limite do S3). Chave que não existe não dá erro. */
    async deleteMany(keys: string[]): Promise<void> {
      for (let i = 0; i < keys.length; i += 1000) {
        const res = await client.send(
          new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }),
        );
        if (res.Errors?.length) throw new Error(`r2: não apagou ${res.Errors.length} arquivo(s)`);
      }
    },
    /** Lista chaves (e quando mudaram) sob um prefixo. */
    async list(prefix: string): Promise<{ key: string; modified: Date; size: number }[]> {
      const out: { key: string; modified: Date; size: number }[] = [];
      let token: string | undefined;
      do {
        const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
        for (const o of res.Contents ?? []) out.push({ key: o.Key!, modified: o.LastModified ?? new Date(0), size: o.Size ?? 0 });
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
      return out;
    },
  };
}

export type R2 = ReturnType<typeof createR2>;

let cached: R2 | null = null;

/** R2 configurado pelas variáveis de ambiente (só no servidor). */
export function getR2(env: NodeJS.ProcessEnv = process.env): R2 {
  if (cached) return cached;
  const { R2_ACCOUNT_ID: account, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = env;
  if (!account || !bucket || !accessKeyId || !secretAccessKey) throw new Error("R2 não configurado (faltam variáveis R2_*)");
  const client = new S3Client({
    region: "auto",
    forcePathStyle: true,
    // O R2 não aceita os checksums extras que o SDK novo adiciona por padrão.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  cached = createR2(client, bucket);
  return cached;
}
