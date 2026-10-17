import { uploadRoute } from "@/lib/storage/route";
import { partUrlsWith } from "@/lib/storage/upload";

export const POST = (req: Request) =>
  uploadRoute(req, async ({ deps, body, recordingId }) => ({
    urls: await partUrlsWith(deps, {
      recordingId,
      uploadId: typeof body.uploadId === "string" ? body.uploadId : "",
      partNumbers: Array.isArray(body.partNumbers) ? (body.partNumbers as number[]) : [],
    }),
  }));
