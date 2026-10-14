import { writeFile } from "node:fs/promises";
import { run } from "./ffmpeg";

const FONT = process.env.WORKER_FONT ?? "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const LINE_CHARS = 22;

/** Quebra o título em linhas de até 22 letras, sem cortar palavras. */
export function wrapTitle(title: string): string {
  const lines: string[] = [];
  for (const word of title.trim().split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= LINE_CHARS) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.join("\n");
}

const esc = (p: string) => p.replace(/[\\:']/g, (m) => `\\${m}`);

/** Capa JPEG: um quadro do vídeo no instante `at` com o título por cima (faixa escura legível). */
export async function makeCover(video: string, at: number, title: string, out: string): Promise<void> {
  const textFile = `${out}.txt`;
  await writeFile(textFile, wrapTitle(title));
  const draw = [
    `fontfile=${esc(FONT)}`,
    `textfile=${esc(textFile)}`,
    "fontcolor=white",
    "fontsize=72",
    "line_spacing=14",
    "box=1",
    "boxcolor=black@0.55",
    "boxborderw=28",
    "x=(w-text_w)/2",
    "y=h*0.68",
  ].join(":");
  await run(["-y", "-ss", at.toFixed(2), "-i", video, "-frames:v", "1", "-vf", `drawtext=${draw}`, "-q:v", "3", out]);
}
