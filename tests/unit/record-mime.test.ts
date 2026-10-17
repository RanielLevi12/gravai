import { describe, expect, it } from "vitest";
import { codecLabel, extensionFor, pickMimeType } from "@/lib/record/mime";

describe("pickMimeType", () => {
  it("prefere MP4 com H.264 quando o navegador grava assim", () => {
    expect(pickMimeType(() => true)).toBe("video/mp4;codecs=avc1,mp4a");
  });
  it("MP4 com H.264 vence o WebM", () => {
    expect(pickMimeType((t) => t === "video/mp4;codecs=avc1,mp4a" || t.startsWith("video/webm"))).toBe("video/mp4;codecs=avc1,mp4a");
  });
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
    expect(extensionFor("video/mp4;codecs=avc1,mp4a")).toBe("mp4");
  });
});

describe("codecLabel", () => {
  it("nomeia o codec para a Info técnica", () => {
    expect(codecLabel("video/mp4;codecs=avc1,mp4a")).toBe("H.264");
    expect(codecLabel("video/webm;codecs=vp9,opus")).toBe("VP9");
    expect(codecLabel("video/webm")).toBe("VP8");
    expect(codecLabel(null)).toBe("—");
  });
});
