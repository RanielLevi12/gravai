/** Uma chamada de IA com o custo em dólares que o OpenRouter informou. */
export type AiUsage = { kind: "text" | "ocr" | "audio"; model: string; costUsd: number; promptTokens?: number; completionTokens?: number };
