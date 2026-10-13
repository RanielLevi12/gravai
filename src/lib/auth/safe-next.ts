/**
 * Destino pós-login como URL absoluta já validada: precisa ser da mesma origem e o
 * caminho final não pode começar com `//` ou `/\` (o navegador leria como outro site).
 * Quem redireciona deve usar esta URL direto, sem reanalisar texto.
 */
export function safeNext(next: string | null, origin: string): URL {
  const fallback = new URL("/projetos", origin);
  if (!next) return fallback;
  try {
    const dest = new URL(next, origin);
    if (dest.origin !== origin) return fallback;
    if (dest.pathname.startsWith("//") || dest.pathname.startsWith("/\\")) return fallback;
    return dest;
  } catch {
    return fallback;
  }
}
