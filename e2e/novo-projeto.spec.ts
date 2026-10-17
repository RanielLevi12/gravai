import path from "node:path";
import { expect, test } from "@playwright/test";
import { entrarComOnboardingFeito } from "./support";

// Rodar com AI_MOCK=1 (texto e docx nem chamam a IA, mas o servidor fica previsível).

const PALAVRAS_300 = Array.from({ length: 300 }, (_, i) => `palavra${i + 1}`).join(" ");

test("texto colado: projetos vazio → fonte → entrevista, e a linha mostra Continuar", async ({ page }) => {
  await entrarComOnboardingFeito(page, "novo-texto");

  // Tela vazia: um botão grande "Criar vídeo"; sem projetos, ele já pergunta a origem
  await expect(page.getByRole("heading", { name: "Seus vídeos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Continue de onde parou" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sem projeto" })).toBeVisible();
  await page.getByRole("button", { name: "Criar vídeo" }).click();
  const folha = page.getByRole("dialog", { name: "Criar vídeo" });
  await expect(folha.getByText("De onde vem o conteúdo?")).toBeVisible();
  await folha.getByRole("link", { name: "Texto" }).click();
  await expect(page).toHaveURL(/\/novo\?origem=texto$/);
  await page.getByLabel("Cole seu texto").fill(PALAVRAS_300);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page).toHaveURL(/\/projetos\/[0-9a-f-]{36}\/fonte$/);
  const id = /\/projetos\/([0-9a-f-]{36})\/fonte$/.exec(page.url())![1];
  await expect(page.getByText("300 palavras")).toBeVisible();
  await expect(page.getByText("dá até ~4 min de vídeo")).toBeVisible();

  // Edita: a contagem acompanha
  const texto = page.getByLabel("Texto do vídeo");
  await texto.fill(`${PALAVRAS_300} mais duas`);
  await expect(page.getByText("302 palavras")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/entrevista/plataformas$`));

  await page.goto("/projetos");
  await expect(page.getByRole("heading", { name: "Continue de onde parou" })).toBeVisible();
  // "Continue de onde parou": o vídeo com o status legível e o link da etapa em que parou
  const cartao = page.getByRole("link", { name: /palavra1/ }).first();
  await expect(cartao).toContainText("Editar");
  await expect(cartao).toHaveAttribute("href", `/projetos/${id}/entrevista/plataformas`);
  // O vídeo solto também aparece em "Sem projeto"
  await expect(page.getByRole("heading", { name: /Sem projeto/ })).toContainText("1 vídeo");
});

test("Criar vídeo pergunta o projeto e leva a origem escolhida com o projeto", async ({ page }) => {
  await entrarComOnboardingFeito(page, "criar-video");
  await page.getByRole("link", { name: "Novo projeto" }).click();
  await page.getByLabel("Nome do projeto").fill("Devocional");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page).toHaveURL(/\/pastas\/([0-9a-f-]{36})$/);
  const pastaId = /\/pastas\/([0-9a-f-]{36})$/.exec(page.url())![1];
  await page.goto("/projetos");

  await page.getByRole("button", { name: "Criar vídeo" }).click();
  const folha = page.getByRole("dialog", { name: "Criar vídeo" });
  await expect(folha.getByText("Em qual projeto vai este vídeo?")).toBeVisible();
  await expect(folha.getByRole("button", { name: "Sem projeto" })).toBeVisible();
  await folha.getByRole("button", { name: "Devocional" }).click();
  await expect(folha.getByText("Projeto: Devocional")).toBeVisible();
  await folha.getByRole("link", { name: "Texto" }).click();
  await expect(page).toHaveURL(new RegExp(`/novo\\?origem=texto&projeto=${pastaId}$`));

  // O "+ novo" do projeto também leva o projeto
  await page.goto("/projetos");
  await expect(page.getByRole("link", { name: "Novo vídeo em Devocional" })).toHaveAttribute("href", `/novo?projeto=${pastaId}`);
});

test("upload de docx cria o projeto com o texto do arquivo", async ({ page }) => {
  await entrarComOnboardingFeito(page, "novo-docx");
  await page.goto("/novo");
  await expect(page.getByRole("heading", { name: "Novo vídeo" })).toBeVisible();
  await page.getByRole("link", { name: /Enviar arquivo/ }).click();
  await expect(page).toHaveURL(/\/novo\?origem=arquivo$/);

  await page.getByLabel("Escolher arquivo").setInputFiles(path.join(__dirname, "../tests/fixtures/ingest/sample.docx"));
  await expect(page.getByText("sample.docx")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page).toHaveURL(/\/projetos\/[0-9a-f-]{36}\/fonte$/);
  await expect(page.getByLabel("Texto do vídeo")).toHaveValue(/Marcador docx 123/);
});
