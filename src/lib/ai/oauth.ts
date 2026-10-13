import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { signValue, verifySigned } from "./keys";

// Doc: https://openrouter.ai/docs/use-cases/oauth-pkce
export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
export const OPENROUTER_KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";

export const OAUTH_COOKIE = "gravai_ai_oauth";
const COOKIE_PATH = "/api/ai";
const COOKIE_MAX_AGE = 10 * 60; // o código do OpenRouter também expira em 10 min

/** PKCE S256: verifier aleatório, challenge = base64url(sha256(verifier)); state contra CSRF. */
export function createPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(24).toString("base64url");
  return { verifier, challenge, state };
}

/** Cookie assinado `<userId>.<verifier>.<state>.<hmac>`: amarra state e verifier ao usuário que iniciou o fluxo. */
export function setOAuthCookie(res: NextResponse, userId: string, verifier: string, state: string) {
  res.cookies.set(OAUTH_COOKIE, signValue(`${userId}.${verifier}.${state}`), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearOAuthCookie(res: NextResponse) {
  res.cookies.set(OAUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 0,
  });
}

export function readOAuthCookie(value: string | undefined): { userId: string; verifier: string; state: string } | null {
  if (!value) return null;
  let payload: string | null;
  try {
    payload = verifySigned(value);
  } catch {
    return null;
  }
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 3 || parts.some((p) => !p)) return null;
  const [userId, verifier, state] = parts;
  return { userId, verifier, state };
}

export function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
