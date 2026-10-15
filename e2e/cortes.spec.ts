import { expect, test, type Page } from "@playwright/test";
import { entrarComOnboardingFeito } from "./support";

// Rodar com AI_MOCK=1: os cortes vêm de tests/fixtures/ai/generateJson.cuts_suggestion.json
// (trechos 2, 3 e 5 do script da fixture; corte de 30 s).

const PALAVRAS_300 = Array.from({ length: 300 }, (_, i) => `palavra${i + 1}`).join(" ");

async function novoProjetoNoScript(page: Page, prefixo: string): Promise<string> {
  await entrarComOnboardingFeito(page, prefixo);
  await page.goto("/novo?origem=texto");
  await page.getByLabel("Cole seu texto").fill(PALAVRAS_300);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/fonte$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/entrevista\/plataformas$/);
  const id = /\/projetos\/([0-9a-f-]{36})\//.exec(page.url())![1];
  for (const passo of ["formato", "duracao", "cortes", "cenario", "titulos", "capa", "cta", "resumo"]) {
    // Vídeo de 3 min: cabem até 5 cortes de 30 s (em 60 s caberia só 1).
    if (passo === "cortes") await page.getByRole("radio", { name: "3 min" }).check({ force: true });
    await page.getByRole("button", { name: "Próxima" }).click();
    await expect(page).toHaveURL(new RegExp(`/entrevista/${passo}$`));
  }
  await page.getByRole("link", { name: "Gerar script" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/script$`));
  return id;
}

test("sugerir cortes, ajustar começo e fim, marcar à mão, remover e manter ao recarregar", async ({ page }) => {
  test.setTimeout(90_000);
  await novoProjetoNoScript(page, "cortes-fluxo");

  await expect(page.getByRole("heading", { name: "Cortes" })).toBeVisible();
  await expect(page.getByText("Corte 1", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Sugerir cortes" }).click();
  await expect(page.getByText("Corte 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Corte 3", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Título do corte 1")).toHaveValue("O pensamento que muda tudo");
  await expect(page.getByRole("group", { name: "Começa em, corte 1" })).toContainText("Trecho 1");

  // Os blocos dentro de um corte mostram a etiqueta.
  await expect(page.getByRole("region", { name: "Trecho 1" })).toContainText("Corte 1");
  await expect(page.getByRole("region", { name: "Abertura" })).not.toContainText("Corte");

  // Ajustar o fim do corte 1 até o Trecho 3 não pode invadir o corte 2: o botão fica desligado.
  await expect(page.getByRole("button", { name: "Termina em, corte 1: um trecho depois" })).toBeDisabled();

  // Remover o corte 2 libera o Trecho 2 e o corte 1 pode ir até lá.
  await page.getByRole("button", { name: "Remover o corte 2" }).click();
  await expect(page.getByText("Corte 3", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Termina em, corte 1: um trecho depois" }).click();
  await expect(page.getByRole("group", { name: "Termina em, corte 1" })).toContainText("Trecho 2");

  // Marcar à mão usa o primeiro trecho livre (a abertura) e aceita um título.
  await page.getByRole("button", { name: "Marcar à mão" }).click();
  await expect(page.getByText("Corte 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar à mão" })).toBeEnabled();
  await page.getByLabel("Título do corte 1").fill("Minha abertura");
  const salvou = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByLabel("Título do corte 1").blur();
  await salvou;
  await expect(page.getByRole("button", { name: "Marcar à mão" })).toBeEnabled();

  // Tudo continua depois de recarregar.
  await page.reload();
  await expect(page.getByLabel("Título do corte 1")).toHaveValue("Minha abertura");
  await expect(page.getByLabel("Título do corte 2")).toHaveValue("O pensamento que muda tudo");
  await expect(page.getByRole("group", { name: "Termina em, corte 2" })).toContainText("Trecho 2");
});

test("sugerir de novo pede confirmação e gerar o script de novo limpa os cortes", async ({ page }) => {
  test.setTimeout(120_000);
  await novoProjetoNoScript(page, "cortes-troca");
  await page.getByRole("button", { name: "Sugerir cortes" }).click();
  await expect(page.getByText("Corte 1", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sugerir cortes" }).click();
  await expect(page.getByRole("heading", { name: "Sugerir cortes de novo?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("Corte 1", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gerar script de novo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Corte 1", { exact: true })).toHaveCount(0);
});
