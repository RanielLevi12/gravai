import { expect, test } from "@playwright/test";
import { esperarCodigo, esperarLink, pedirLink } from "./support";

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

  // Sua IA: sem conexão, oferece conectar pelo OpenRouter (rota do servidor)
  await expect(page.getByRole("heading", { name: "Sua IA" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Conectar sua IA" })).toHaveAttribute("href", "/api/ai/connect");
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

test("código de 6 dígitos entra sem abrir o link (outro navegador)", async ({ page }) => {
  const email = `codigo-${Date.now()}@example.com`;
  await pedirLink(page, email);
  const { codigo } = await esperarCodigo(email, new Set());

  await page.getByLabel("Código do e-mail").fill("000000");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Código errado ou vencido")).toBeVisible();

  await page.getByLabel("Código do e-mail").fill(codigo);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas\/nicho$/);
});

test("sem sessão, rotas do app levam a /entrar", async ({ page }) => {
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/entrar/);
});
