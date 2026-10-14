import { expect, test } from "@playwright/test";
import { entrarComOnboardingFeito } from "./support";

// Rodar com AI_MOCK=1: cada chamada do mock "custa" US$ 0,0123 (MOCK_COST_USD em src/lib/ai/index.ts).
const PALAVRAS_300 = Array.from({ length: 300 }, (_, i) => `palavra${i + 1}`).join(" ");

test("a barra de custos mostra a última ação e o mês depois de usar a IA", async ({ page }) => {
  test.setTimeout(90_000);
  await entrarComOnboardingFeito(page, "custos");

  const barra = page.getByRole("complementary", { name: "Custos da sua IA" });
  await expect(barra).toContainText("Neste mês");
  await expect(barra).not.toContainText("Última ação");

  await page.goto("/novo?origem=texto");
  await page.getByLabel("Cole seu texto").fill(PALAVRAS_300);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/fonte$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  // A entrevista pede a sugestão da IA: já houve chamadas.
  await expect(page).toHaveURL(/\/entrevista\/plataformas$/);
  await expect(barra).toContainText("Última ação");
  await expect(barra).toContainText("US$ 0,0123");
  await expect(barra).not.toContainText("US$ 0,00 ");
});
