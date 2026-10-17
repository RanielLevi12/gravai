import "server-only";
import { noul, score, TypeSafeClient } from "@typesafe-ai/sdk";
import { AiError, type ExcerptReview, type ScriptCheck } from "./schemas";

export const JUDGE_MODEL = "jev-latest";
const CHECK_TIMEOUT_MS = 15_000;
const REVIEW_TIMEOUT_MS = 15_000;

const VIRAL_LEVELS = [
  "Título sem gancho: genérico, confuso ou que ninguém clicaria",
  "Título fraco: informa o tema, mas não desperta curiosidade",
  "Título razoável: claro, com algum interesse",
  "Título forte: curiosidade ou benefício claro, específico",
  "Título excelente: gancho irresistível, específico e fácil de entender de relance",
] as const;

const HOOK_LEVELS = [
  "Gancho inexistente: começa sem nada que prenda, genérico ou confuso",
  "Gancho fraco: informa, mas não desperta curiosidade nem vontade de continuar",
  "Gancho razoável: claro, com algum interesse",
  "Gancho forte: curiosidade ou benefício claro logo nas primeiras frases",
  "Gancho excelente: prende de imediato, específico e fácil de entender",
] as const;

const CLOSING_LEVELS = [
  "Fecho ruim: recap vazio, despedida genérica ou pedido genérico (curta, compartilhe, se inscreva)",
  "Fecho fraco: encerra sem pagar o que o começo prometeu, ou o pedido não tem relação com o vídeo",
  "Fecho razoável: fecha o assunto e faz um pedido, mas soa comum",
  "Fecho forte: paga o que o começo prometeu e faz um único pedido claro e ligado ao vídeo",
  "Fecho excelente: frase final memorável, paga a promessa e o pedido é específico e fácil de cumprir",
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
    // Teto total (tentativas incluídas): roda depois das gerações na mesma função de maxDuration=300.
    const res = await getClient().systemOne(
      { state: { roteiro: text }, questions, model: JUDGE_MODEL },
      { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) },
    );
    const a = res.answers as Record<string, { noul: number }>;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return { toneOk: clamp(a.toneOk.noul), ctaPresent: opts.cta ? clamp(a.ctaPresent.noul) : null };
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(undefined, { code: "provider", cause: e });
  }
}

/** Nota de gancho (e, se pedido, de "recomeço") de cada texto. Uma chamada só, perguntas em paralelo. */
export async function reviewExcerpts(texts: string[], opts: { restart: boolean }): Promise<ExcerptReview> {
  if (texts.length === 0) return { hook: [], restart: opts.restart ? [] : null };
  try {
    const questions: Record<string, ReturnType<typeof noul> | ReturnType<typeof score>> = {};
    texts.forEach((t, i) => {
      questions[`h${i}`] = score(
        { pergunta: "Quão forte é o gancho do começo deste trecho de vídeo curto?", trecho: t },
        HOOK_LEVELS,
      );
      // O primeiro trecho abre o vídeo: cumprimentar ali é normal.
      if (opts.restart && i > 0) {
        questions[`r${i}`] = noul(
          `Este trecho recomeça o vídeo, com nova saudação ou se apresentando de novo como se fosse o começo?\n\nTrecho: "${t}"`,
        );
      }
    });
    const res = await getClient().systemOne(
      { state: { trechos: texts.length }, questions, model: JUDGE_MODEL },
      { signal: AbortSignal.timeout(REVIEW_TIMEOUT_MS) },
    );
    const a = res.answers as Record<string, { score?: number; noul?: number }>;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const max = HOOK_LEVELS.length - 1;
    return {
      hook: texts.map((_, i) => clamp((a[`h${i}`].score ?? 0) / max)),
      restart: opts.restart ? texts.map((_, i) => (i > 0 ? clamp(a[`r${i}`].noul ?? 0) : 0)) : null,
    };
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(undefined, { code: "provider", cause: e });
  }
}

/** Nota (0..1) do fecho (conclusão + chamada para ação) de cada opção. */
export async function scoreClosing(texts: string[], context: string): Promise<number[]> {
  if (texts.length === 0) return [];
  try {
    const questions = Object.fromEntries(
      texts.map((t, i) => [
        `c${i}`,
        score(
          {
            pergunta: "Quão bom é este fecho de vídeo curto: paga a promessa do começo e faz UMA chamada para ação natural?",
            fecho: t,
            contexto: context,
          },
          CLOSING_LEVELS,
        ),
      ]),
    );
    const res = await getClient().systemOne({ state: { contexto: context }, questions, model: JUDGE_MODEL });
    const max = CLOSING_LEVELS.length - 1;
    return texts.map((_, i) => Math.min(1, Math.max(0, (res.answers as Record<string, { score: number }>)[`c${i}`].score / max)));
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(undefined, { code: "provider", cause: e });
  }
}
