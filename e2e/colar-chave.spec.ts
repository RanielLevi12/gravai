import { expect, test } from "@playwright/test";
import { entrarComOnboardingFeito } from "./support";

// Rodar com AI_MOCK=1: a chave não é conferida no OpenRouter de verdade.
test("colar a chave do OpenRouter conecta a IA sem mostrar a chave de novo", async ({ page }) => {
  await entrarComOnboardingFeito(page, "colar-chave");
  await page.goto("/perfil");
  await page.getByText("Prefiro colar minha chave").click();

  // Formato errado: recusa antes de qualquer chamada.
  await page.getByLabel("Chave do OpenRouter").fill("minha-senha");
  await page.getByRole("button", { name: "Conectar com esta chave" }).click();
  await expect(page.getByText("começa com sk-or-")).toBeVisible();

  // A chave fica escondida enquanto digita.
  await expect(page.getByLabel("Chave do OpenRouter")).toHaveAttribute("type", "password");

  await page.getByLabel("Chave do OpenRouter").fill("sk-or-v1-" + "a".repeat(30) + "wxyz");
  await page.getByRole("button", { name: "Conectar com esta chave" }).click();
  await expect(page.getByText("Pronto, sua IA está conectada.")).toBeVisible();
  await expect(page.getByText("termina em ••••wxyz")).toBeVisible();
  await expect(page.getByText("sk-or-v1-")).toHaveCount(0);

  // Desconectar volta ao estado inicial, com a opção de colar de novo.
  await page.getByRole("button", { name: "Desconectar" }).click();
  await expect(page.getByText("Prefiro colar minha chave")).toBeVisible();
});
