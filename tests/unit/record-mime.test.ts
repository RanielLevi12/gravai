import { describe, expect, it } from "vitest";
import { extensionFor, pickMimeType } from "@/lib/record/mime";

describe("pickMimeType", () => {
  it("Safari: só mp4", () => {
    expect(pickMimeType((t) => t === "video/mp4")).toBe("video/mp4");
  });
  it("Chrome: webm vp9", () => {
    expect(pickMimeType((t) => t.startsWith("video/webm"))).toBe(
      "video/webm;codecs=vp9,opus",
    );
  });
  it("só webm simples", () => {
    expect(pickMimeType((t) => t === "video/webm")).toBe("video/webm");
  });
  it("nada suportado", () => {
    expect(pickMimeType(() => false)).toBeNull();
  });
});

describe("extensionFor", () => {
  it("devolve a extensão pelo tipo", () => {
    expect(extensionFor("video/webm;codecs=vp9,opus")).toBe("webm");
    expect(extensionFor("video/mp4")).toBe("mp4");
  });
});
