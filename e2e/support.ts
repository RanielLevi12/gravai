import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

// Mailpit do Supabase local (porta de [local_smtp] em supabase/config.toml).
const MAILPIT = "http://127.0.0.1:58324/api/v1";

type MailpitList = { messages: { ID: string }[] };

/** Espera chegar um e-mail novo para o endereço e devolve o link de acesso dele. */
export async function esperarLink(email: string, jaVistos: Set<string>): Promise<{ id: string; link: string }> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await res.json()) as MailpitList;
    const novo = messages.find((m) => !jaVistos.has(m.ID));
    if (novo) {
      const msg = (await (await fetch(`${MAILPIT}/message/${novo.ID}`)).json()) as { HTML: string };
      const href = /href="([^"]+)"/.exec(msg.HTML)?.[1];
      if (!href) throw new Error("e-mail sem link de acesso");
      return { id: novo.ID, link: href.replaceAll("&amp;", "&") };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`nenhum e-mail novo para ${email}`);
}

/** Espera o e-mail novo e devolve o código numérico de acesso que vem nele. */
export async function esperarCodigo(email: string, jaVistos: Set<string>): Promise<{ id: string; codigo: string }> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await res.json()) as MailpitList;
    const novo = messages.find((m) => !jaVistos.has(m.ID));
    if (novo) {
      const msg = (await (await fetch(`${MAILPIT}/message/${novo.ID}`)).json()) as { Text: string };
      const codigo = /\b(\d{6})\b/.exec(msg.Text)?.[1];
      if (!codigo) throw new Error("e-mail sem código de acesso");
      return { id: novo.ID, codigo };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`nenhum e-mail novo para ${email}`);
}

export async function pedirLink(page: Page, email: string) {
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Entre no Gravaí" })).toBeVisible();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Receber código de acesso" }).click();
  await expect(page.getByText("Enviamos um código para")).toBeVisible();
}

/** Entra com um e-mail novo e pula o onboarding: termina em /projetos. */
export async function entrarComOnboardingFeito(page: Page, prefixo: string) {
  const email = `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await pedirLink(page, email);
  const { link } = await esperarLink(email, new Set());
  await page.goto(link);
  await expect(page).toHaveURL(/\/boas-vindas\/nicho$/);
  await page.getByRole("button", { name: "Pular por agora" }).click();
  await expect(page).toHaveURL(/\/projetos$/);
}

const PALAVRAS_300 = Array.from({ length: 300 }, (_, i) => `palavra${i + 1}`).join(" ");

/** Cria um projeto de texto, responde a entrevista só tocando Próxima e abre a tela do script. */
export async function novoProjetoNoScript(page: Page, prefixo: string): Promise<string> {
  await entrarComOnboardingFeito(page, prefixo);
  await page.goto("/novo?origem=texto");
  await page.getByLabel("Cole seu texto").fill(PALAVRAS_300);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/projetos\/[0-9a-f-]{36}\/fonte$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/entrevista\/plataformas$/);
  const id = /\/projetos\/([0-9a-f-]{36})\//.exec(page.url())![1];
  for (const passo of ["formato", "duracao", "cortes", "cenario", "titulos", "capa", "cta", "resumo"]) {
    await page.getByRole("button", { name: "Próxima" }).click();
    await expect(page).toHaveURL(new RegExp(`/entrevista/${passo}$`));
  }
  await page.getByRole("link", { name: "Gerar script" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/script$`));
  return id;
}

/** Cliente admin do Supabase local, só para preparar e conferir o banco nos testes. */
export function adminDb() {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .map((l) => /^([A-Z_]+)=(.*)$/.exec(l))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
  );
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("e2e só roda contra o Supabase local");
  return createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
