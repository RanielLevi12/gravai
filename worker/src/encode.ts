import { run } from "./ffmpeg";

const AUDIO = ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"];

/** Intermediário de alta qualidade (quase sem perda): só serve para gerar o final e os cortes, nunca é entregue. */
export function masterArgs(): string[] {
  return ["-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-r", "30", "-pix_fmt", "yuv420p", ...AUDIO];
}

/** Arquivo entregue: qualidade constante (CRF 20), com teto de 8 Mbps para não explodir em cenas muito detalhadas. */
export function encodeArgs(): string[] {
  return [
    "-c:v", "libx264", "-crf", "20", "-preset", "faster", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-maxrate", "8M", "-bufsize", "16M", "-r", "30",
    ...AUDIO,
    "-movflags", "+faststart",
  ];
}

/** Gera o arquivo entregue (final ou corte) a partir do intermediário. Sem `start`/`seconds`, converte o arquivo todo. */
export async function encodeFrom(master: string, output: string, cutRange?: { start: number; seconds: number }): Promise<void> {
  const args = ["-y"];
  if (cutRange) args.push("-ss", cutRange.start.toFixed(3));
  args.push("-i", master);
  if (cutRange) args.push("-t", cutRange.seconds.toFixed(3));
  await run([...args, ...encodeArgs(), output]);
}
