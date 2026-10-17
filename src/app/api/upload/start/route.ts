import { uploadRoute } from "@/lib/storage/route";
import { startUploadWith } from "@/lib/storage/upload";

export const POST = (req: Request) =>
  uploadRoute(req, ({ deps, body, recordingId }) =>
    startUploadWith(deps, { recordingId, size: Number(body.size), uploadId: typeof body.uploadId === "string" ? body.uploadId : null }),
  );
