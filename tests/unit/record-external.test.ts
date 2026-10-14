import { describe, expect, it } from "vitest";
import { MSG_FILE_TOO_BIG } from "@/lib/record/limits";
import { validateExternalFile } from "@/lib/record/rules";

const MB = 1024 * 1024;

describe("validateExternalFile", () => {
  it("recusa mais de 50 MB", () => {
    expect(validateExternalFile({ size: 52 * MB, type: "video/mp4" })).toEqual({ ok: false, error: MSG_FILE_TOO_BIG });
  });
  it("aceita mp4 de 10 MB", () => {
    expect(validateExternalFile({ size: 10 * MB, type: "video/mp4" })).toEqual({ ok: true });
  });
  it("recusa imagem", () => {
    expect(validateExternalFile({ size: MB, type: "image/png" })).toEqual({
      ok: false,
      error: "Use um vídeo em MP4, MOV ou WebM.",
    });
  });
  it("aceita quicktime", () => {
    expect(validateExternalFile({ size: MB, type: "video/quicktime" })).toEqual({ ok: true });
  });
});
