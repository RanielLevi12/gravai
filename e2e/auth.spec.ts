import { expect, test, type Page } from "@playwright/test";

// Mailpit do Supabase local (porta de [local_smtp] em supabase/config.toml).
const MAILPIT = "http://127.0.0.1:58324/api/v1";

type MailpitList = { messages: { ID: string }[] };

/** Espera chegar um e-mail novo para o endereço e devolve o link de acesso dele. */
async function esperarLink(email: string, jaVistos: Set<string>): Promise<{ id: string; link: string }> {
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

async function pedirLink(page: Page, email: string) {
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Entre no Gravaí" })).toBeVisible();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(page.getByText("Enviamos o link para")).toBeVisible();
}

test("magic link, onboarding completo e perfil", async ({ page }) => {
  const email = `onboarding-${Date.now()}@example.com`;
  await pedirLink(page, email);
  const { link } = await esperarLink(email, new Set());
  await page.goto(link);
  await expect(page).toHaveURL(/\/boas-vindas\/nicho$/);

  await page.getByLabel("Seu assunto").fill("finanças pessoais");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas\/tom$/);

  await page.getByText("Descontraído", { exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas\/cta$/);

  await page.getByLabel("WhatsApp").fill("11999990000");
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(page).toHaveURL(/\/projetos$/);

  await page.goto("/perfil");
  await expect(page.getByText("Descontraído")).toBeVisible();
  await expect(page.getByText("CTAs salvos (1)")).toBeVisible();
  await expect(page.getByText("finanças pessoais")).toBeVisible();
});

test("pular o onboarding leva a /projetos e o próximo login não volta a ele", async ({ page }) => {
  const email = `pular-${Date.now()}@example.com`;
  await pedirLink(page, email);
  const primeiro = await esperarLink(email, new Set());
  await page.goto(primeiro.link);
  await expect(page).toHaveURL(/\/boas-vindas\/nicho$/);

  await page.getByRole("button", { name: "Pular por agora" }).click();
  await expect(page).toHaveURL(/\/projetos$/);

  await page.goto("/perfil");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  await pedirLink(page, email);
  const segundo = await esperarLink(email, new Set([primeiro.id]));
  await page.goto(segundo.link);
  await expect(page).toHaveURL(/\/projetos$/);
});

test("sem sessão, rotas do app levam a /entrar", async ({ page }) => {
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/entrar/);
});
