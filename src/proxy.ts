import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/** Rotas abertas; todo o resto exige sessão. */
function isPublic(path: string) {
  return path === "/" || path === "/entrar" || path.startsWith("/auth/");
}

export async function proxy(request: NextRequest) {
  const { supabase, user, getResponse, redirectTo } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (isPublic(path)) {
    if (user && path === "/entrar") return redirectTo(new URL("/projetos", request.url));
    return getResponse();
  }

  if (!user) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return redirectTo(new URL("/entrar", request.url));
  }

  // Quem ainda não concluiu (nem pulou) o onboarding começa por ele.
  if (!path.startsWith("/boas-vindas") && !path.startsWith("/api/")) {
    const { data: profile } = await supabase.from("profiles").select("onboarded").eq("user_id", user.id).maybeSingle();
    if (!profile?.onboarded) return redirectTo(new URL("/boas-vindas/nicho", request.url));
  }

  return getResponse();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|marca/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|txt|woff2?)$).*)",
  ],
};
