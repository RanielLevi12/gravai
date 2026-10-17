import { expect, test, type Page } from "@playwright/test";
import { entrarComOnboardingFeito } from "./support";

// Rodar com AI_MOCK=1: a sugestão vem de tests/fixtures/ai/generateJson.interview_suggestion.json
// (Reels + TikTok, vídeo único, 60 s) e os títulos de generateJson.agent_titles.json.

const PALAVRAS_300 = Array.from({ length: 300 }, (_, i) => `palavra${i + 1}`).join(" ");

/** Cria um projeto de texto e chega à 1ª pergunta da entrevista. Devolve o id. */
async function novoProjetoNaEntrevista(page: Page, prefixo: string): Promise<string> {
  await entrarComOnboardingFeito(page, prefixo);
  await page.goto("/novo?origem=texto");
  await page.getByLabel("Cole seu texto").fill(PALAVRAS_300);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/projetos\/[0-9a-f-]{36}\/fonte$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/entrevista\/plataformas$/);
  return /\/projetos\/([0-9a-f-]{36})\//.exec(page.url())![1];
}

const proxima = (page: Page) => page.getByRole("button", { name: "Próxima" });

async function avancar(page: Page, passo: string, contagem: string) {
  await proxima(page).click();
  await expect(page).toHaveURL(new RegExp(`/entrevista/${passo}$`));
  await expect(page.getByText(contagem, { exact: true })).toBeVisible();
}

test("percorre as 8 perguntas só tocando Próxima e chega ao resumo", async ({ page }) => {
  const id = await novoProjetoNaEntrevista(page, "entrevista-fluxo");

  // 1. Plataformas: sugestão já marcada, com selo
  await expect(page.getByText("1/8", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Reels" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "TikTok" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "YouTube" })).not.toBeChecked();
  await expect(page.getByText("Sugerido").first()).toBeVisible();

  // Toque duplo em "Próxima" avança um passo só
  await proxima(page).dblclick();
  await expect(page).toHaveURL(/\/entrevista\/formato$/);
  await expect(page.getByText("2/8", { exact: true })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/entrevista\/formato$/);
  await expect(page.getByRole("radio", { name: "Vídeo único" })).toBeChecked();

  // 3. Duração: 300 palavras rendem ~4 min → 5 e 10 min desabilitadas com o motivo
  await avancar(page, "duracao", "3/8");
  await expect(page.getByRole("radio", { name: "60 s" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "5 min" })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "10 min" })).toBeDisabled();
  await expect(page.getByText("Seu texto rende até ~4 min").first()).toBeVisible();

  // 4. Cortes: vídeo de 60 s → corte de 60 s desabilitado; 30 s sugerido (Reels/TikTok)
  await avancar(page, "cortes", "4/8");
  await expect(page.getByRole("radio", { name: "60 s" })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "30 s" })).toBeChecked();

  await avancar(page, "cenario", "5/8");
  await expect(page.getByRole("radio", { name: "Cenário natural" })).toBeChecked();

  await avancar(page, "titulos", "6/8");
  await expect(page.getByRole("radio").first()).toBeChecked();

  await avancar(page, "capa", "7/8");
  await avancar(page, "cta", "8/8");
  await expect(page.getByRole("radio", { name: "Sem chamada" })).toBeChecked();

  await proxima(page).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/entrevista/resumo$`));
  await expect(page.getByRole("heading", { name: "Tudo certo?" })).toBeVisible();
  const linhas = page.getByRole("list", { name: "Suas respostas" }).getByRole("link");
  await expect(linhas).toHaveCount(8);
  await expect(linhas.nth(0)).toContainText("Reels, TikTok");
  await expect(linhas.nth(2)).toContainText("60 s");
  await expect(linhas.nth(3)).toContainText("1 corte de 30 s");

  // Cada linha leva de volta ao passo
  await linhas.nth(3).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/entrevista/cortes$`));
});

test("voltar pelo navegador mostra a resposta salva marcada", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await novoProjetoNaEntrevista(page, "entrevista-voltar");

  await avancar(page, "formato", "2/8");
  await avancar(page, "duracao", "3/8");
  await avancar(page, "cortes", "4/8");

  // Troca a sugestão (30 s) por 20 s e segue para o passo 5
  await page.getByText("20 s", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "20 s" })).toBeChecked();
  await avancar(page, "cenario", "5/8");

  await page.goBack();
  await expect(page).toHaveURL(/\/entrevista\/cortes$/);
  await expect(page.getByRole("radio", { name: "20 s" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "30 s" })).not.toBeChecked();

  // Cenário com IA: copiar o prompt mostra o aviso
  await avancar(page, "cenario", "5/8");
  await page.getByText("Fundo criado com IA", { exact: true }).click();
  await page.getByRole("button", { name: "Copiar prompt" }).click();
  await expect(page.getByText("Prompt copiado")).toBeVisible();
});
