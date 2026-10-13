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

export async function pedirLink(page: Page, email: string) {
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Entre no Gravaí" })).toBeVisible();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(page.getByText("Enviamos o link para")).toBeVisible();
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
