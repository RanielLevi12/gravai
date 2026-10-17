import { joinNames } from "./missing";
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
  /** Nome de cada bloco (mesma ordem de `blockIds`); com ele a mensagem diz quais faltam. */
  blockLabels?: string[];
}): { ok: true } | { ok: false; error: string } {
  const { mode, ready, blockIds, blockLabels } = input;

  if (mode === "blocks") {
    const done = new Set(
      ready.filter((r) => r.kind === "block").map((r) => r.blockId),
    );
    const missingIds = blockIds.filter((id) => !done.has(id));
    const missing = missingIds.length;
    if (missing === 0) return { ok: true };
    if (blockLabels && blockLabels.length === blockIds.length) {
      const names = missingIds.map((id) => blockLabels[blockIds.indexOf(id)]);
      return { ok: false, error: missing === 1 ? `Falta gravar: ${names[0]}.` : `Faltam gravar: ${joinNames(names)}.` };
    }
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

type ReadyRecording = { id: string; kind: "take" | "block" | "external"; blockId: string | null; createdAt: string };

/** Gravações para assistir: take/enviado só o mais novo; blocos na ordem do script, o mais novo de cada. */
export function recordingsInOrder<T extends ReadyRecording>(
  ready: T[],
  blocks: { id: string; label: string }[],
): (T & { label: string })[] {
  const newest = [...ready].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const whole = newest.find((r) => r.kind !== "block");
  if (whole) return [{ ...whole, label: whole.kind === "take" ? "Vídeo inteiro" : "Vídeo enviado" }];
  return blocks.flatMap((b) => {
    const rec = newest.find((r) => r.blockId === b.id);
    return rec ? [{ ...rec, label: b.label }] : [];
  });
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
