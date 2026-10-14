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
