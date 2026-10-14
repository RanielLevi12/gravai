import { expect, test } from "@playwright/test";
import { entrarComOnboardingFeito } from "./support";

test("criar, ver, editar e apagar um projeto (pasta)", async ({ page }) => {
  await entrarComOnboardingFeito(page, "pastas");
  await expect(page.getByRole("heading", { name: "Projetos" })).toBeVisible();

  // Criar: só o nome é obrigatório; o resto já vem sugerido.
  await page.getByRole("link", { name: "Novo projeto" }).click();
  await expect(page).toHaveURL(/\/pastas\/nova$/);
  await expect(page.getByRole("button", { name: "Criar projeto" })).toBeDisabled();
  await page.getByLabel("Nome do projeto").fill("Devocional");
  await page.getByLabel("Azul").check({ force: true });
  await page.getByLabel("Sobre este projeto").fill("devocional cristão, tom acolhedor");
  await page.getByRole("button", { name: "Criar projeto" }).click();

  // Página do projeto: nome, resumo das configurações e o texto "Sobre".
  await expect(page).toHaveURL(/\/pastas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Devocional" })).toBeVisible();
  await expect(page.getByText("Reels · vídeo único · 60 s · cortes de 30 s · sem chamada")).toBeVisible();
  await expect(page.getByText("devocional cristão, tom acolhedor")).toBeVisible();
  await expect(page.getByText("Este projeto ainda não tem vídeos.")).toBeVisible();

  // Na tela inicial aparece na faixa de projetos.
  await page.getByRole("link", { name: /Seus vídeos/ }).click();
  const card = page.getByRole("link", { name: /Devocional/ });
  await expect(card).toContainText("0 vídeos");

  // Editar: trocar nome, plataforma e duração (o corte que não cabe é ajustado).
  await card.click();
  await page.getByRole("link", { name: "Editar projeto" }).click();
  await page.getByLabel("Nome do projeto").fill("Devocional diário");
  await page.getByLabel("YouTube").check({ force: true });
  await page.getByLabel("Reels").uncheck({ force: true });
  await page.getByLabel("30 s", { exact: true }).first().check({ force: true });
  await page.getByRole("button", { name: "Salvar projeto" }).click();
  await expect(page.getByRole("heading", { name: "Devocional diário" })).toBeVisible();
  await expect(page.getByText(/^YouTube · vídeo único · 30 s · cortes de 10 s/)).toBeVisible();

  // Apagar pede confirmação e volta para a tela inicial sem o projeto.
  await page.getByRole("link", { name: "Editar projeto" }).click();
  await page.getByRole("button", { name: "Apagar projeto" }).click();
  await expect(page.getByRole("heading", { name: "Apagar este projeto?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Apagar projeto" }).click();
  await expect(page).toHaveURL(/\/projetos$/);
  await expect(page.getByRole("link", { name: /Devocional diário/ })).toHaveCount(0);
});

test("projeto de outro usuário não abre", async ({ page, browser }) => {
  await entrarComOnboardingFeito(page, "dona");
  await page.goto("/pastas/nova");
  await page.getByLabel("Nome do projeto").fill("Privado");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page).toHaveURL(/\/pastas\/[0-9a-f-]{36}$/);
  const url = page.url();

  const outro = await browser.newPage();
  await entrarComOnboardingFeito(outro, "intruso");
  const r = await outro.goto(url.replace(/^https?:\/\/[^/]+/, outro.url().match(/^https?:\/\/[^/]+/)![0]));
  expect(r?.status()).toBe(404);
  await outro.close();
});
