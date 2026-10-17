import { expect, test } from "@playwright/test";
import { entrarComOnboardingFeito } from "./support";

// Precisa do Supabase local com a migração 0017 aplicada (não rodado na sessão que escreveu: sem Supabase local).
test("projeto vai para a lixeira, dá para desfazer, restaurar e apagar de vez", async ({ page }) => {
  await entrarComOnboardingFeito(page, "lixeira");

  await page.getByRole("link", { name: "Novo projeto" }).click();
  await page.getByLabel("Nome do projeto").fill("Para a lixeira");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page.getByRole("heading", { name: "Para a lixeira" })).toBeVisible();

  // Pelo menu ⋮ da tela inicial: confirmação curta e aviso com "Desfazer".
  await page.getByRole("link", { name: /Seus vídeos/ }).click();
  await page.getByRole("button", { name: "Mais ações: Para a lixeira" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mover para a lixeira" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mover para a lixeira" }).click();
  await expect(page.getByRole("status")).toContainText("foi para a lixeira");
  await expect(page.getByRole("link", { name: /^Para a lixeira/ }).first()).toHaveCount(0);

  // Desfazer traz de volta.
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("link", { name: /^Para a lixeira/ })).toBeVisible();

  // De novo, e agora pela tela /lixeira: restaurar.
  await page.getByRole("button", { name: "Mais ações: Para a lixeira" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mover para a lixeira" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mover para a lixeira" }).click();
  await page.getByRole("link", { name: /Lixeira \(1\)/ }).click();
  await expect(page).toHaveURL(/\/lixeira$/);
  await expect(page.getByText("Faltam 7 dias")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("A lixeira está vazia.")).toBeVisible();

  // Apagar agora pede confirmação forte.
  await page.goto("/projetos");
  await page.getByRole("button", { name: "Mais ações: Para a lixeira" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mover para a lixeira" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mover para a lixeira" }).click();
  await page.goto("/lixeira");
  await page.getByRole("button", { name: "Apagar agora" }).click();
  await expect(page.getByRole("heading", { name: "Apagar de vez?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Apagar para sempre" }).click();
  await expect(page.getByText("A lixeira está vazia.")).toBeVisible();
});
