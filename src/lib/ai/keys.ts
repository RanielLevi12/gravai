import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AiError } from "./schemas";

const VERSION = "v1";

/** Segredo de AI_KEY_ENCRYPTION_SECRET: 32 bytes em base64. Lança sem expor o valor. */
function secret(): Buffer {
  const raw = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!raw) throw new Error("AI_KEY_ENCRYPTION_SECRET ausente");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("AI_KEY_ENCRYPTION_SECRET precisa ter 32 bytes em base64");
  return key;
}

/** Subchave separada para assinar cookies (não reaproveita a chave do AES). */
function signingKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", secret(), Buffer.alloc(0), "gravai/oauth-cookie/v1", 32));
}

/** AES-256-GCM com IV aleatório de 12 bytes. Formato: v1:<iv>:<tag>:<ciphertext> (base64url). */
export function encryptKey(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(":");
}

/** Inverso de encryptKey. Lança se o formato, o segredo ou o texto cifrado não baterem. */
export function decryptKey(cipherText: string): string {
  const parts = cipherText.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("formato de chave cifrada inválido");
  const [, ivB64, tagB64, ctB64] = parts;
  const b64url = /^[A-Za-z0-9_-]+$/;
  if (![ivB64, tagB64, ctB64].every((p) => b64url.test(p))) throw new Error("formato de chave cifrada inválido");
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("formato de chave cifrada inválido");
  const decipher = createDecipheriv("aes-256-gcm", secret(), iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

function mac(value: string): Buffer {
  return createHmac("sha256", signingKey()).update(value).digest();
}

/** `<valor>.<hmac>`; o valor não pode conter nada que dependa do último ponto. */
export function signValue(value: string): string {
  return `${value}.${mac(value).toString("base64url")}`;
}

/** Devolve o valor se a assinatura bater; senão null. */
export function verifySigned(signed: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const given = Buffer.from(signed.slice(i + 1), "base64url");
  const expected = mac(value);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return value;
}

/** Chave OpenRouter do usuário, decifrada. null se não houver conexão (ou se ela não abrir mais). */
export async function getUserAiKey(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("ai_connections")
    .select("key_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new AiError("A IA está indisponível no momento. Tente mais tarde.", { code: "provider" });
  if (!data) return null;
  try {
    return decryptKey(data.key_ciphertext);
  } catch {
    // Segredo trocado ou linha corrompida: trata como desconectado para o usuário reconectar.
    console.warn("[ai] conexão de IA ilegível; tratando como desconectada");
    return null;
  }
}
