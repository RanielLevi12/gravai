import { Upload } from "tus-js-client";

export const MSG_UPLOAD_FAILED = "Não consegui enviar o vídeo. Veja a internet e tente de novo.";

// O endpoint resumable do Supabase exige pedaços de exatamente 6 MiB.
const CHUNK_SIZE = 6 * 1024 * 1024;

export function uploadRecording(input: {
  blob: Blob;
  path: string;
  mime: string;
  accessToken: string;
  supabaseUrl: string;
  onProgress?: (sent: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(input.blob, {
      endpoint: `${input.supabaseUrl}/storage/v1/upload/resumable`,
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: { authorization: `Bearer ${input.accessToken}`, "x-upsert": "true" },
      metadata: {
        bucketName: "recordings",
        objectName: input.path,
        contentType: input.mime,
        cacheControl: "3600",
      },
      removeFingerprintOnSuccess: true,
      onProgress: (sent, total) => input.onProgress?.(sent, total),
      onError: () => reject(new Error(MSG_UPLOAD_FAILED)),
      onSuccess: () => resolve(),
    });
    if (input.signal) {
      if (input.signal.aborted) {
        reject(new Error(MSG_UPLOAD_FAILED));
        return;
      }
      input.signal.addEventListener(
        "abort",
        () => {
          void upload.abort();
          reject(new Error(MSG_UPLOAD_FAILED));
        },
        { once: true },
      );
    }
    upload.start();
  });
}
