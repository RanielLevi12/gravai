import { expect, test } from "@playwright/test";

test("home em pt-BR com botão primário na cor da marca", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("pt-BR");
  const botao = page.getByRole("link", { name: "Começar" });
  await expect(botao).toBeVisible();
  await expect(botao).toHaveCSS("background-color", "rgb(225, 29, 85)");
});
