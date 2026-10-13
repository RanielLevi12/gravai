import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

/**
 * Renova a sessão do Supabase dentro do proxy (padrão do guia do @supabase/ssr):
 * os cookies novos vão para a requisição e para a resposta.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items, headers) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** Redireciona levando junto os cookies de sessão renovados. */
  function redirectTo(url: URL) {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    response.headers.forEach((v, k) => {
      if (k.toLowerCase().startsWith("cache-control")) redirect.headers.set(k, v);
    });
    return redirect;
  }

  return { supabase, user, getResponse: () => response, redirectTo };
}
