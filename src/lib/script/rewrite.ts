/** Reescrita de um bloco e salvamento de edições, sobre um banco abstrato (Supabase no app, memória nos testes). */
import { z } from "zod";
import type { UserAi } from "@/lib/ai";
import { AiError } from "@/lib/ai/schemas";
import { estimateSeconds } from "@/lib/rules/duration";
import type { BlockKind } from "./generate";
import { buildRewriteUser, MAX_CUSTOM, REWRITE_SYSTEM, type RewriteInstruction } from "./prompts";

export type RewriteMode = RewriteInstruction;

export const RewriteSchema = z.object({ text: z.string() }).meta({ title: "block_rewrite" });

export const MAX_BLOCK_TEXT = 6000;
const CUT_TOLERANCE = 1.2;
const MODES = ["noGreeting", "shorter", "direct", "emotional", "hook", "simpler"] as const;

export type BlockContext = {
  kind: BlockKind;
  text: string;
  previous: string | null;
  next: string | null;
  cutSeconds: number | null;
  tone: string | null;
};

export interface BlockDb {
  blockContext(blockId: string): Promise<BlockContext | null>;
  /** Grava o texto do bloco; false se o bloco não existe (ou não é do usuário). */
  saveBlockText(blockId: string, text: string): Promise<boolean>;
}

export const MSG_BLOCK_NOT_FOUND = "Trecho não encontrado.";

/** Valida o pedido vindo do cliente (a ação roda no servidor, então nada é confiável). */
export function parseRewriteMode(mode: unknown): RewriteMode {
  if (typeof mode === "string" && (MODES as readonly string[]).includes(mode)) return mode as RewriteMode;
  if (mode && typeof mode === "object" && typeof (mode as { custom?: unknown }).custom === "string") {
    const custom = (mode as { custom: string }).custom.trim();
    if (custom.length > 0 && custom.length <= MAX_CUSTOM) return { custom };
  }
  throw new AiError("Escolha como reescrever (até 300 caracteres).", { code: "invalid_input" });
}

/** Reescreve só o bloco pedido; em corte, o resultado respeita a duração do corte. Não grava: o cliente salva. */
export async function rewriteBlockWith(
  deps: { db: BlockDb; ai: () => Promise<UserAi> },
  blockId: string,
  mode: unknown,
): Promise<{ text: string }> {
  const instruction = parseRewriteMode(mode);
  const ctx = await deps.db.blockContext(blockId);
  if (!ctx) throw new AiError(MSG_BLOCK_NOT_FOUND, { code: "invalid_input" });
  const ai = await deps.ai();
  const limit = ctx.kind === "cut" && ctx.cutSeconds ? ctx.cutSeconds * CUT_TOLERANCE : null;

  const attempt = async (problem?: string) => {
    const out = await ai.generateJson(
      RewriteSchema,
      REWRITE_SYSTEM,
      buildRewriteUser({ ...ctx, instruction, problem }),
    );
    return out.text.trim();
  };

  let text = await attempt();
  const tooLong = (t: string) => limit !== null && estimateSeconds(t) > limit;
  if (text === "" || tooLong(text)) {
    text = await attempt(text === "" ? "o texto veio vazio" : `o texto tem ~${estimateSeconds(text)} s e o limite do corte é ${Math.round(limit!)} s`);
  }
  if (text === "") throw new AiError(undefined, { code: "invalid_output" });
  if (tooLong(text)) {
    throw new AiError(`O novo texto passou do tempo do corte (${ctx.cutSeconds} s). Tente "Mais curto".`, { code: "invalid_output" });
  }
  return { text };
}

export async function updateBlockTextWith(db: BlockDb, blockId: string, text: unknown): Promise<void> {
  if (typeof text !== "string" || text.length > MAX_BLOCK_TEXT) throw new Error("Texto inválido.");
  if (!(await db.saveBlockText(blockId, text))) throw new Error(MSG_BLOCK_NOT_FOUND);
}
