import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { probe, run } from "../src/ffmpeg";

const dir = mkdtempSync(path.join(tmpdir(), "gravai-ffmpeg-"));

/** Vídeo de teste: imagem + tom, sem depender de arquivos no repositório. */
function clip(name: string, seconds: number, size = "640x360", audio = true): string {
  const file = path.join(dir, name);
  const args = ["-y", "-f", "lavfi", "-i", `testsrc=duration=${seconds}:size=${size}:rate=30`];
  if (audio) args.push("-f", "lavfi", "-i", `sine=duration=${seconds}`, "-shortest");
  execFileSync("ffmpeg", [...args, "-pix_fmt", "yuv420p", file], { stdio: "ignore" });
  return file;
}

describe("probe", () => {
  it("lê duração, tamanho e se tem áudio", async () => {
    const info = await probe(clip("a.mp4", 2));
    expect(info.duration).toBeGreaterThan(1.9);
    expect(info.duration).toBeLessThan(2.1);
    expect(info.width).toBe(640);
    expect(info.height).toBe(360);
    expect(info.hasAudio).toBe(true);
  });

  it("vídeo sem áudio", async () => {
    expect((await probe(clip("mudo.mp4", 1, "320x240", false))).hasAudio).toBe(false);
  });

  it("arquivo que não existe falha com mensagem", async () => {
    await expect(probe(path.join(dir, "nao-existe.mp4"))).rejects.toThrow();
  });
});

describe("run", () => {
  it("roda o ffmpeg e falha com as últimas linhas do erro", async () => {
    const out = path.join(dir, "saida.mp4");
    await run(["-y", "-i", clip("b.mp4", 1), "-t", "0.5", out]);
    expect((await probe(out)).duration).toBeLessThan(0.7);
    await expect(run(["-y", "-i", path.join(dir, "nada.mp4"), out])).rejects.toThrow(/nada\.mp4/);
  });
});
