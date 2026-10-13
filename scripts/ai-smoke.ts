// Rodar: NODE_USE_ENV_PROXY=1 node --conditions=react-server --import tsx scripts/ai-smoke.ts
// (a condição react-server neutraliza o pacote "server-only" fora do Next)
// Chama cada função real uma vez:
//  - jev (scoreViral, checkScript) com TYPESAFE_API_KEY;
//  - OpenRouter (generateJson, ocrImages, ocrPdf, transcribeAudio) com OPENROUTER_DEV_KEY,
//    a chave do dono, usada SÓ aqui. O app nunca lê OPENROUTER_DEV_KEY (usa a chave do OAuth de cada usuário).
// Nenhuma chave é impressa.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.log("sem .env.local; usando só o ambiente");
}
delete process.env.AI_MOCK;

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    const out = await fn();
    console.log(`OK    ${name}:`, JSON.stringify(out).slice(0, 200));
  } catch (e) {
    const err = e as { userMessage?: string; code?: string; cause?: { status?: number } };
    // Só a mensagem segura, o code e o status HTTP; nunca o objeto de erro inteiro.
    console.log(`FALHA ${name}:`, err.userMessage ?? (e as Error).name, err.code ?? "", err.cause?.status ?? "");
    process.exitCode = 1;
  }
}

/** PDF mínimo de uma página com uma linha de texto (Helvetica). */
function tinyPdf(text: string): Buffer {
  const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** Fala sintetizada offline (ffmpeg + flite), em WAV. null se não houver ffmpeg/flite. */
function spokenWav(text: string): Buffer | null {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gravai-smoke-")), "fala.wav");
  try {
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `flite=text='${text}'`, "-ar", "16000", "-ac", "1", file]);
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

async function main() {
  const ai = await import("../src/lib/ai");

  if (process.env.TYPESAFE_API_KEY) {
    await step("scoreViral", () => ai.scoreViral(["5 erros que matam seu vídeo", "Vídeo sobre coisas"], "vídeos curtos sobre edição"));
    await step("checkScript", () => ai.checkScript("Oi pessoal! Hoje eu mostro um truque. Assine o canal!", { tone: "descontraído", cta: "assine o canal" }));
  } else console.log("PENDENTE jev: sem TYPESAFE_API_KEY");

  const devKey = process.env.OPENROUTER_DEV_KEY;
  if (!devKey) {
    console.log("PENDENTE OpenRouter (generateJson, ocrImages, ocrPdf, transcribeAudio): sem OPENROUTER_DEV_KEY");
    return;
  }
  const { createOpenRouterAi } = await import("../src/lib/ai/openrouter");
  const user = ai.userAiFrom(createOpenRouterAi(devKey));

  await step("generateJson", () => user.generateJson(z.object({ titulo: z.string() }), "Responda em JSON.", "Dê um título curto para um vídeo sobre café."));

  const sharp = (await import("sharp")).default;
  const png = await sharp({ create: { width: 400, height: 120, channels: 3, background: "white" } })
    .composite([{ input: Buffer.from('<svg width="400" height="120"><text x="10" y="70" font-size="40">Ola mundo</text></svg>') }])
    .png()
    .toBuffer();
  await step("ocrImages", () => user.ocrImages([{ data: png, mediaType: "image/png" }]));

  await step("ocrPdf", () => user.ocrPdf(tinyPdf("Gravai teste de PDF")));

  const wav = spokenWav("hello, this is a short test");
  if (wav) await step("transcribeAudio", () => user.transcribeAudio(wav, "fala.wav"));
  else console.log("PENDENTE transcribeAudio: sem ffmpeg com flite para gerar áudio");
}
main();
