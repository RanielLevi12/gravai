import { MAX_FILE_BYTES, MSG_FILE_TOO_BIG } from "./limits";

export type RecordMode = "take" | "blocks" | "external";

export function allowedModes(mainSeconds: number): RecordMode[] {
  return mainSeconds <= 180
    ? ["take", "blocks", "external"]
    : ["blocks", "external"];
}

export function canApprove(input: {
  mode: RecordMode;
  ready: { kind: "take" | "block" | "external"; blockId: string | null }[];
  blockIds: string[];
}): { ok: true } | { ok: false; error: string } {
  const { mode, ready, blockIds } = input;

  if (mode === "blocks") {
    const done = new Set(
      ready.filter((r) => r.kind === "block").map((r) => r.blockId),
    );
    const missing = blockIds.filter((id) => !done.has(id)).length;
    if (missing === 0) return { ok: true };
    return {
      ok: false,
      error:
        missing === 1
          ? "Falta gravar 1 bloco."
          : `Faltam gravar ${missing} blocos.`,
    };
  }

  if (ready.some((r) => r.kind === mode)) return { ok: true };
  return {
    ok: false,
    error:
      mode === "external"
        ? "Envie o vídeo antes de aprovar."
        : "Grave o vídeo antes de aprovar.",
  };
}

const EXTERNAL_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export function validateExternalFile(file: {
  size: number;
  type: string;
}): { ok: true } | { ok: false; error: string } {
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: MSG_FILE_TOO_BIG };
  if (!EXTERNAL_TYPES.includes(file.type)) return { ok: false, error: "Use um vídeo em MP4, MOV ou WebM." };
  return { ok: true };
}
