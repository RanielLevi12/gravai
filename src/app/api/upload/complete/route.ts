import type { R2Part } from "@/lib/storage/r2";
import { uploadRoute } from "@/lib/storage/route";
import { completeUploadWith } from "@/lib/storage/upload";

export const POST = (req: Request) =>
  uploadRoute(req, ({ deps, body, recordingId }) =>
    completeUploadWith(deps, {
      recordingId,
      uploadId: typeof body.uploadId === "string" ? body.uploadId : "",
      parts: Array.isArray(body.parts) ? (body.parts as R2Part[]) : [],
    }),
  );
