import { expect, test, type Page } from "@playwright/test";
import { entrarComOnboardingFeito } from "./support";

// Rodar com AI_MOCK=1: o script vem de tests/fixtures/ai/generateJson.script_generation.json
// (abertura + 5 cortes + fechamento) e a reescrita de generateJson.block_rewrite.json.

const PALAVRAS_300 = Array.from({ length: 300 }, (_, i) => `palavra${i + 1}`).join(" ");
const TEXTO_REESCRITO = "Texto curto vindo da fixture de reescrita.";

/** Cria um projeto de texto, responde a entrevista só tocando Próxima e abre a tela do script. */
async function novoProjetoNoScript(page: Page, prefixo: string): Promise<string> {
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

const bloco = (page: Page, nome: string) => page.getByRole("region", { name: nome });
const duracaoSegundos = async (b: ReturnType<typeof bloco>) => {
  const [m, s] = (await b.getByText(/^\d+:\d{2}$/).innerText()).split(":").map(Number);
  return m * 60 + s;
};
const total = (page: Page) => page.getByTestId("tempo-total");

test("mostra os cortes coloridos, salva a edição e reescreve um bloco", async ({ page }) => {
  const id = await novoProjetoNoScript(page, "script-fluxo");

  // Etiquetas Corte 1..5, na cor da sequência (tangerina no primeiro)
  for (let n = 1; n <= 5; n++) await expect(page.getByText(`Corte ${n}`, { exact: true })).toBeVisible();
  await expect(page.getByText("Corte 1", { exact: true })).toHaveCSS("background-color", "rgb(255, 122, 0)");
  await expect(page.getByText("5 cortes", { exact: true })).toBeVisible();

  // Edição: autosave e persistência depois de recarregar; o total muda
  const totalAntes = await total(page).innerText();
  const corte1 = bloco(page, "Corte 1");
  await corte1.getByRole("button", { name: "Editar" }).click();
  const editor = corte1.getByRole("textbox", { name: "Texto do Corte 1" });
  await editor.fill("Meu corte um ficou bem curtinho.");
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await expect(total(page)).not.toHaveText(totalAntes);
  await page.reload();
  await expect(bloco(page, "Corte 1")).toContainText("Meu corte um ficou bem curtinho.");

  // Reescrever → Mais curto troca o texto pelo da fixture e a duração cai
  const corte2 = bloco(page, "Corte 2");
  const antes = await duracaoSegundos(corte2);
  await corte2.getByRole("button", { name: "Reescrever" }).click();
  const folha = page.getByRole("dialog", { name: "Reescrever Corte 2" });
  await folha.getByText("Mais curto", { exact: true }).click();
  await folha.getByRole("button", { name: "Reescrever" }).click();
  await expect(corte2).toContainText(TEXTO_REESCRITO);
  expect(await duracaoSegundos(corte2)).toBeLessThan(antes);
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await page.reload();
  await expect(bloco(page, "Corte 2")).toContainText(TEXTO_REESCRITO);

  // Gravar leva à tela provisória
  await page.getByRole("link", { name: "Gravar" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar$`));
  await expect(page.getByRole("heading", { name: "Gravação chega na próxima versão" })).toBeVisible();
});

test("gerar de novo pede confirmação antes de substituir o script", async ({ page }) => {
  await novoProjetoNoScript(page, "script-regerar");
  const corte1 = bloco(page, "Corte 1");
  await corte1.getByRole("button", { name: "Editar" }).click();
  await corte1.getByRole("textbox", { name: "Texto do Corte 1" }).fill("Texto que vai ser substituído.");
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gerar script de novo" }).click();
  const confirmacao = page.getByRole("dialog", { name: "Gerar o script de novo?" });
  await expect(confirmacao.getByText("Isso substitui o script atual. Continuar?")).toBeVisible();
  await confirmacao.getByRole("button", { name: "Cancelar" }).click();
  await expect(bloco(page, "Corte 1")).toContainText("Texto que vai ser substituído.");

  await page.getByRole("button", { name: "Gerar script de novo" }).click();
  await page.getByRole("dialog", { name: "Gerar o script de novo?" }).getByRole("button", { name: "Continuar" }).click();
  await expect(bloco(page, "Corte 1")).not.toContainText("Texto que vai ser substituído.");
  await expect(page.getByText("Corte 5", { exact: true })).toBeVisible();
});
