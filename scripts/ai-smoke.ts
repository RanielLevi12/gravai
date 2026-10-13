// Rodar: node --conditions=react-server --import tsx scripts/ai-smoke.ts   (ou npx tsx --conditions=react-server ...)
// Se o Node não usar o proxy de rede: NODE_USE_ENV_PROXY=1
// (a condição react-server neutraliza o pacote "server-only" fora do Next)
// Chama cada função real uma vez, só para os provedores com chave em .env.local.
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
    const err = e as { userMessage?: string; cause?: { status?: number; message?: string } };
    console.log(`FALHA ${name}:`, err.userMessage ?? String(e), err.cause?.status ?? "", err.cause?.message?.slice(0, 200) ?? "");
    process.exitCode = 1;
  }
}

async function main() {
  const ai = await import("../src/lib/ai");
  if (process.env.TYPESAFE_API_KEY) {
    await step("scoreViral", () => ai.scoreViral(["5 erros que matam seu vídeo", "Vídeo sobre coisas"], "vídeos curtos sobre edição"));
    await step("checkScript", () => ai.checkScript("Oi pessoal! Hoje eu mostro um truque. Assine o canal!", { tone: "descontraído", cta: "assine o canal" }));
  } else console.log("PENDENTE jev: sem TYPESAFE_API_KEY");

  if (process.env.OPENAI_API_KEY) {
    await step("generateJson", () => ai.generateJson(z.object({ titulo: z.string() }), "Responda em JSON.", "Dê um título para um vídeo sobre café."));
    console.log("transcribeAudio: precisa de um arquivo de áudio real; passe SMOKE_AUDIO=caminho");
    if (process.env.SMOKE_AUDIO) {
      const fs = await import("node:fs");
      await step("transcribeAudio", () => ai.transcribeAudio(fs.readFileSync(process.env.SMOKE_AUDIO!), "smoke.mp3"));
    }
  } else console.log("PENDENTE openai (generateJson, transcribeAudio): sem OPENAI_API_KEY");

  if (process.env.ANTHROPIC_API_KEY) {
    const sharp = (await import("sharp")).default;
    const png = await sharp({ create: { width: 400, height: 120, channels: 3, background: "white" } })
      .composite([{ input: Buffer.from('<svg width="400" height="120"><text x="10" y="70" font-size="40">Ola mundo</text></svg>') }])
      .png()
      .toBuffer();
    await step("ocrImages", () => ai.ocrImages([{ data: png, mediaType: "image/png" }]));
    if (process.env.SMOKE_PDF) {
      const fs = await import("node:fs");
      await step("ocrPdf", () => ai.ocrPdf(fs.readFileSync(process.env.SMOKE_PDF!)));
    } else console.log("ocrPdf: passe SMOKE_PDF=caminho");
  } else console.log("PENDENTE anthropic (ocrImages, ocrPdf): sem ANTHROPIC_API_KEY");
}
main();
