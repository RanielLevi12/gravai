/** Destino pós-login: só caminhos do próprio site; qualquer outra origem cai em /projetos. */
export function safeNext(next: string | null, origin: string): string {
  const fallback = "/projetos";
  if (!next) return fallback;
  try {
    const dest = new URL(next, origin);
    if (dest.origin !== origin) return fallback;
    return `${dest.pathname}${dest.search}${dest.hash}`;
  } catch {
    return fallback;
  }
}
