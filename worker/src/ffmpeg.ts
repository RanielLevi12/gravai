import { spawn } from "node:child_process";

/** Roda um programa e junta a saída; falha com as últimas linhas do stderr. */
function exec(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d));
    child.stderr.on("data", (d: Buffer) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      const tail = stderr.trim().split("\n").slice(-6).join("\n");
      reject(new Error(`${cmd} saiu com código ${code}: ${tail}`));
    });
  });
}

export async function run(args: string[]): Promise<void> {
  await exec("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args]);
}

export type MediaInfo = { duration: number; width: number; height: number; hasAudio: boolean };

export async function probe(file: string): Promise<MediaInfo> {
  const { stdout } = await exec("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  const info = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: { codec_type: string; width?: number; height?: number }[];
  };
  const video = info.streams?.find((s) => s.codec_type === "video");
  return {
    duration: Number(info.format?.duration ?? 0),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    hasAudio: info.streams?.some((s) => s.codec_type === "audio") ?? false,
  };
}
