import { z } from "zod";

export type AiErrorCode = "not_connected" | "provider" | "invalid_input" | "invalid_output" | "limit_reached";

/**
 * Erro da camada de IA. `userMessage` é genérica e segura para mostrar ao usuário.
 * `code`: not_connected = usuário sem conta de IA conectada; provider = o provedor falhou;
 * invalid_input = a entrada não serve (ex.: áudio ilegível ou em formato não aceito);
 * invalid_output = a IA respondeu fora do formato; limit_reached = acabou o limite mensal da IA do Gravaí.
 */
export class AiError extends Error {
  userMessage: string;
  code?: AiErrorCode;
  constructor(
    userMessage = "A IA não respondeu como esperado. Tente de novo.",
    options?: { cause?: unknown; code?: AiErrorCode },
  ) {
    super(userMessage, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AiError";
    this.userMessage = userMessage;
    this.code = options?.code;
  }
}

export type OcrImage = { data: Buffer; mediaType: string };
export type Transcription = { text: string; seconds: number };
/** Fala com tempo por palavra (segundos), para achar onde cada trecho do script foi dito. */
export type WordTranscription = { words: { w: string; s: number; e: number }[]; seconds: number };
export type ScriptCheck = { toneOk: number; ctaPresent: number | null };
/** Por trecho, em 0..1: força do gancho e chance de recomeçar o vídeo (null = não perguntado). */
export type ExcerptReview = { hook: number[]; restart: number[] | null };

export const transcriptionSchema = z.object({ text: z.string(), seconds: z.number() });
export const scriptCheckSchema = z.object({
  toneOk: z.number().min(0).max(1),
  ctaPresent: z.number().min(0).max(1).nullable(),
});

type Json = Record<string, unknown>;

function nullable(schema: Json): Json {
  return { anyOf: [schema, { type: "null" }] };
}

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (node === null || typeof node !== "object") return node;
  const src = node as Json;
  const out: Json = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === "properties" || k === "$defs" || k === "definitions") {
      out[k] = Object.fromEntries(Object.entries(v as Json).map(([pk, pv]) => [pk, strictify(pv)]));
    } else out[k] = strictify(v);
  }

  // record com chaves enum -> objeto com uma propriedade anulável por chave
  const names = src.propertyNames as { enum?: string[] } | undefined;
  if (names?.enum && src.additionalProperties && typeof src.additionalProperties === "object") {
    const value = out.additionalProperties as Json;
    delete out.propertyNames;
    out.type = "object";
    out.properties = Object.fromEntries(names.enum.map((key) => [key, nullable(value)]));
    out.required = [...names.enum];
    out.additionalProperties = false;
    return out;
  }

  if (out.properties && typeof out.properties === "object") {
    const props = out.properties as Json;
    const required = new Set((src.required as string[] | undefined) ?? []);
    for (const key of Object.keys(props)) {
      if (!required.has(key)) props[key] = nullable(props[key] as Json);
    }
    out.required = Object.keys(props);
    out.additionalProperties = false;
  }
  return out;
}

/**
 * JSON Schema compatível com o modo strict da OpenAI, derivado do zod:
 * todo objeto lista todas as propriedades em `required` e tem `additionalProperties: false`;
 * opcionais viram anuláveis; records com chaves enum viram objetos com uma propriedade anulável por chave.
 */
export function toStrictJsonSchema(schema: z.ZodType): Json {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Json;
  return strictify(rest) as Json;
}

/**
 * Remove, em profundidade, chaves de objeto cujo valor é null (o inverso da anulabilidade do modo strict).
 * Atenção: campos que o schema original declara como `.nullable()` também perdem o null.
 */
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Json)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, stripNulls(v)]),
    );
  }
  return value;
}

function isNullable(js: Json | undefined): boolean {
  if (!js) return false;
  if (js.type === "null" || (Array.isArray(js.type) && js.type.includes("null"))) return true;
  return Array.isArray(js.anyOf) && (js.anyOf as Json[]).some(isNullable);
}

/**
 * Remove null apenas onde o schema ORIGINAL (não strict) tinha chave opcional
 * (ou valor de record parcial). Campos `.nullable()` mantêm o null.
 */
export function stripOptionalNulls(value: unknown, original: Json | undefined): unknown {
  if (!original) return value;
  if (Array.isArray(original.anyOf)) {
    // escolhe a opção compatível com a forma do valor
    const opts = original.anyOf as Json[];
    const isArr = Array.isArray(value);
    const isObj = value !== null && typeof value === "object" && !isArr;
    const opt = opts.find((o) => (isArr && o.type === "array") || (isObj && o.type === "object"));
    return opt ? stripOptionalNulls(value, opt) : value;
  }
  if (Array.isArray(value)) {
    const items = original.items as Json | undefined;
    return value.map((v) => stripOptionalNulls(v, items));
  }
  if (value === null || typeof value !== "object") return value;
  const props = (original.properties ?? {}) as Record<string, Json>;
  const required = new Set((original.required as string[] | undefined) ?? []);
  const names = original.propertyNames as { enum?: string[] } | undefined;
  const recordValue =
    names?.enum && original.additionalProperties && typeof original.additionalProperties === "object"
      ? (original.additionalProperties as Json)
      : undefined;
  const out: Json = {};
  for (const [k, v] of Object.entries(value as Json)) {
    const sub = recordValue ?? props[k];
    const optional = recordValue ? !isNullable(recordValue) : !required.has(k);
    if (v === null && optional && !isNullable(sub)) continue;
    out[k] = stripOptionalNulls(v, sub);
  }
  return out;
}
