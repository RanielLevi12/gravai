import { z } from "zod";

/** Erro da camada de IA. `userMessage` é genérica e segura para mostrar ao usuário. */
export class AiError extends Error {
  userMessage: string;
  constructor(
    userMessage = "A IA não respondeu como esperado. Tente de novo.",
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "AiError";
    this.userMessage = userMessage;
  }
}

export type OcrImage = { data: Buffer; mediaType: string };
export type Transcription = { text: string; seconds: number };
export type ScriptCheck = { toneOk: number; ctaPresent: number | null };

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
