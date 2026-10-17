import { execFileSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { encodeArgs, encodeFrom, masterArgs } from "../src/encode";
import { probe } from "../src/ffmpeg";
import { normalize } from "../src/render";

const dir = mkdtempSync(path.join(tmpdir(), "gravai-encode-"));

/** Vídeo com bastante detalhe (padrão + ruído), como um rosto com cabelo e fundo vivo. */
function detailed(name: string, seconds: number, size: string): string {
  const file = path.join(dir, name);
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", `testsrc2=duration=${seconds}:size=${size}:rate=30,noise=alls=25:allf=t`, "-f", "lavfi", "-i", `sine=duration=${seconds}`, "-shortest", "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", file],
    { stdio: "ignore" },
  );
  return file;
}

async function kbps(file: string): Promise<number> {
  const { duration } = await probe(file);
  return (statSync(file).size * 8) / duration / 1000;
}

function streams(file: string) {
  const out = execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", file]).toString();
  return JSON.parse(out).streams as { codec_type: string; codec_name: string; profile?: string; pix_fmt?: string; sample_rate?: string; bit_rate?: string }[];
}

describe("qualidade do encode", () => {
  it("args: CRF 20, preset faster, teto 8M, AAC 128k/48k, faststart", () => {
    const a = encodeArgs().join(" ");
    expect(a).toContain("-crf 20");
    expect(a).toContain("-preset faster");
    expect(a).toContain("-maxrate 8M -bufsize 16M");
    expect(a).toContain("-profile:v high");
    expect(a).toContain("-pix_fmt yuv420p");
    expect(a).toContain("-b:a 128k -ar 48000");
    expect(a).toContain("+faststart");
    expect(a).not.toContain("-b:v");
    expect(masterArgs().join(" ")).toContain("-crf 16");
  });

  it("720p vira 1080x1920 e o bitrate efetivo passa de 1,8 Mbps em conteúdo com detalhe", async () => {
    const raw = detailed("raw.mp4", 4, "1280x720");
    const master = path.join(dir, "master.mp4");
    const final = path.join(dir, "final.mp4");
    await normalize(raw, master, null);
    expect(await probe(master)).toMatchObject({ width: 1080, height: 1920, hasAudio: true });

    const t0 = Date.now();
    await encodeFrom(master, final);
    const ms = Date.now() - t0;

    const info = await probe(final);
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1920);
    const rate = await kbps(final);
    console.log(`[medida] final 4 s: ${rate.toFixed(0)} kbps, ${(statSync(final).size / 1e6).toFixed(2)} MB, encode ${ms} ms`);
    expect(rate).toBeGreaterThan(1800);
    expect(rate).toBeLessThan(11000); // ruído extremo + buffer de 16M deixam estourar um pouco em clipe curto

    const [v, a] = [streams(final).find((s) => s.codec_type === "video")!, streams(final).find((s) => s.codec_type === "audio")!];
    expect(v).toMatchObject({ codec_name: "h264", profile: "High", pix_fmt: "yuv420p" });
    expect(a).toMatchObject({ codec_name: "aac", sample_rate: "48000" });
  }, 120_000);

  it("corte vem do intermediário: 1080x1920, duração certa, bitrate alto", async () => {
    const master = path.join(dir, "master.mp4");
    const cut = path.join(dir, "corte.mp4");
    await encodeFrom(master, cut, { start: 1, seconds: 2 });
    const info = await probe(cut);
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1920);
    expect(info.duration).toBeGreaterThan(1.9);
    expect(info.duration).toBeLessThan(2.2);
    expect(await kbps(cut)).toBeGreaterThan(1800);
  }, 120_000);
});
