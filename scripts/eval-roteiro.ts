// Bateria do roteiro: gera com o pipeline ANTES (prompts congelados) e DEPOIS (guia + agentes) e compara a nota média do jev.
// Rodar:   NODE_USE_ENV_PROXY=1 node --conditions=react-server --import tsx scripts/eval-roteiro.ts [--fontes 5] [--so antes|depois]
// (a condição react-server neutraliza o pacote "server-only" fora do Next)
// Precisa de TYPESAFE_API_KEY (jev) e OPENROUTER_API_KEY ou OPENROUTER_DEV_KEY (IA). Sem elas, só mostra o comando.
// Custa dinheiro de IA de verdade (cerca de 4 chamadas por fonte). Nenhuma chave é impressa.
import fs from "node:fs";
import path from "node:path";
import { evaluate, currentPipeline, formatComparison, legacyPipeline, type Judge, type Report } from "../tests/evals/harness";
import { SOURCES } from "../tests/evals/fontes";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: usa só o ambiente
}
delete process.env.AI_MOCK;

const COMMAND = "NODE_USE_ENV_PROXY=1 node --conditions=react-server --import tsx scripts/eval-roteiro.ts";
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_DEV_KEY;
  if (!process.env.TYPESAFE_API_KEY || !key) {
    console.log("Bateria pulada: faltam chaves (TYPESAFE_API_KEY e OPENROUTER_API_KEY ou OPENROUTER_DEV_KEY) no .env.local.");
    console.log(`Quando tiver, rode:\n  ${COMMAND}\nOpções: --fontes 5 (só as 5 primeiras)  --so antes|depois`);
    return;
  }
  const { userAiFrom } = await import("../src/lib/ai");
  const { createOpenRouterAi } = await import("../src/lib/ai/openrouter");
  const { scoreViral, scoreClosing, reviewExcerpts } = await import("../src/lib/ai/typesafe");

  const ai = userAiFrom(createOpenRouterAi(key));
  const judge: Judge = {
    title: scoreViral,
    hook: async (texts) => (await reviewExcerpts(texts, { restart: false })).hook,
    closing: scoreClosing,
  };
  const n = Number(arg("fontes")) || SOURCES.length;
  const sources = SOURCES.slice(0, n);
  const only = arg("so");
  const onProgress = (tag: string) => (id: string) => console.log(`  ${tag} ${id}`);

  let before: Report | null = null;
  let after: Report | null = null;
  if (only !== "depois") {
    console.log(`ANTES (${sources.length} fontes)...`);
    before = await evaluate(sources, legacyPipeline(ai, judge), judge, { onProgress: onProgress("antes") });
  }
  if (only !== "antes") {
    console.log(`DEPOIS (${sources.length} fontes)...`);
    after = await evaluate(sources, currentPipeline(ai, judge), judge, { onProgress: onProgress("depois") });
  }

  const dir = path.join("tests", "evals", "results");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ before, after }, null, 2));
  console.log(before && after ? `\n${formatComparison(before, after)}` : `\nMédias: ${JSON.stringify((before ?? after)?.mean)}`);
  console.log(`\nResultado salvo em ${file}`);
}

main().catch((e) => {
  const err = e as { userMessage?: string; code?: string };
  // Só a mensagem segura; nunca o objeto de erro inteiro (pode carregar cabeçalhos).
  console.error("Bateria falhou:", err.userMessage ?? (e as Error).name, err.code ?? "");
  process.exitCode = 1;
});
