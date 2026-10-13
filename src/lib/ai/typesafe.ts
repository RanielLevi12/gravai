import "server-only";
import { noul, score, TypeSafeClient } from "@typesafe-ai/sdk";
import { AiError, type ScriptCheck } from "./schemas";

export const JUDGE_MODEL = "jev-latest";

const VIRAL_LEVELS = [
  "Título sem gancho: genérico, confuso ou que ninguém clicaria",
  "Título fraco: informa o tema, mas não desperta curiosidade",
  "Título razoável: claro, com algum interesse",
  "Título forte: curiosidade ou benefício claro, específico",
  "Título excelente: gancho irresistível, específico e fácil de entender de relance",
] as const;

let client: TypeSafeClient | null = null;
function getClient(): TypeSafeClient {
  if (!process.env.TYPESAFE_API_KEY) throw new AiError("A análise não está configurada. Tente mais tarde.");
  client ??= new TypeSafeClient();
  return client;
}

export async function scoreViral(titles: string[], context: string): Promise<number[]> {
  if (titles.length === 0) return [];
  try {
    const questions = Object.fromEntries(
      titles.map((t, i) => [
        `t${i}`,
        score(
          {
            pergunta: "Quanto potencial de viralizar (atrair cliques e compartilhamentos) tem este título de vídeo curto?",
            titulo: t,
            contexto: context,
          },
          VIRAL_LEVELS,
        ),
      ]),
    );
    const res = await getClient().systemOne({ state: { contexto: context }, questions, model: JUDGE_MODEL });
    const max = VIRAL_LEVELS.length - 1;
    return titles.map((_, i) => {
      const s = (res.answers as Record<string, { score: number }>)[`t${i}`].score;
      return Math.min(1, Math.max(0, s / max));
    });
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(undefined, { code: "provider", cause: e });
  }
}

export async function checkScript(
  text: string,
  opts: { tone: string; cta?: string },
): Promise<ScriptCheck> {
  try {
    const questions: Record<string, ReturnType<typeof noul>> = {
      toneOk: noul(`O texto do roteiro soa com o tom pedido: "${opts.tone}"?`),
    };
    if (opts.cta) {
      questions.ctaPresent = noul(
        `O roteiro inclui, de forma clara, esta chamada para ação (pode estar com outras palavras): "${opts.cta}"?`,
      );
    }
    const res = await getClient().systemOne({ state: { roteiro: text }, questions, model: JUDGE_MODEL });
    const a = res.answers as Record<string, { noul: number }>;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return { toneOk: clamp(a.toneOk.noul), ctaPresent: opts.cta ? clamp(a.ctaPresent.noul) : null };
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(undefined, { code: "provider", cause: e });
  }
}
