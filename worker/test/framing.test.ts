import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { framingFilter, parseCrop } from "../src/render";

/** Passa um quadro branco do tamanho dado pelo filtro e devolve os pixels (cinza) do quadro 1080×1920. */
function frame(filter: string, size: string): Buffer {
  return execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `color=c=white:size=${size}:rate=1:duration=1`, "-vf", `${filter},format=gray`, "-frames:v", "1", "-f", "rawvideo", "-"], {
    maxBuffer: 1080 * 1920 * 2,
  });
}

describe("parseCrop", () => {
  it("aceita só inteiros positivos", () => {
    expect(parseCrop({ x: 656, y: 0, w: 608, h: 1080 })).toEqual({ x: 656, y: 0, w: 608, h: 1080 });
    expect(parseCrop(null)).toBeNull();
    expect(parseCrop({ x: 1.5, y: 0, w: 10, h: 10 })).toBeNull();
    expect(parseCrop({ x: 0, y: 0, w: 0, h: 10 })).toBeNull();
  });
});

describe("framingFilter", () => {
  it("usa o retângulo salvo, quando cabe no vídeo", () => {
    expect(framingFilter({ x: 656, y: 0, w: 608, h: 1080 }, 1920, 1080)).toBe("crop=608:1080:656:0,scale=1080:1920:flags=lanczos,setsar=1");
  });
  it("retângulo maior que o vídeo cai no corte central", () => {
    expect(framingFilter({ x: 656, y: 0, w: 608, h: 1080 }, 640, 360)).toContain("min(iw");
  });
  it("sem retângulo, corta o centro 9:16 (sem barras pretas) e sai 1080×1920", () => {
    for (const size of ["1920x1080", "1080x1920", "1440x1080", "640x480"]) {
      const px = frame(framingFilter(null, 0, 0), size);
      expect(px.length, size).toBe(1080 * 1920);
      expect(px.every((v) => v > 200), size).toBe(true);
    }
  });
  it("com o retângulo, também sem barras", () => {
    const px = frame(framingFilter({ x: 656, y: 0, w: 608, h: 1080 }, 1920, 1080), "1920x1080");
    expect(px.length).toBe(1080 * 1920);
    expect(px.every((v) => v > 200)).toBe(true);
  });
});
