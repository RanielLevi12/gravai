import path from "node:path";
import { expect, test } from "@playwright/test";
import { entrarComOnboardingFeito } from "./support";

// Rodar com AI_MOCK=1 (texto e docx nem chamam a IA, mas o servidor fica previsível).

const PALAVRAS_300 = Array.from({ length: 300 }, (_, i) => `palavra${i + 1}`).join(" ");

test("texto colado: projetos vazio → fonte → entrevista, e a linha mostra Continuar", async ({ page }) => {
  await entrarComOnboardingFeito(page, "novo-texto");

  // Projetos vazio: painel de novo vídeo com os atalhos de origem
  await expect(page.getByRole("heading", { name: "Seus vídeos" })).toBeVisible();
  const painel = page.getByRole("region", { name: "Novo vídeo" });
  await expect(painel).toBeVisible();
  await expect(page.getByRole("heading", { name: "Continue de onde parou" })).toHaveCount(0);

  await painel.getByRole("link", { name: "Texto" }).click();
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
  const linha = page.getByRole("article").filter({ hasText: "palavra1" });
  await expect(linha.getByRole("link", { name: "Continuar" })).toHaveAttribute("href", `/projetos/${id}/entrevista/plataformas`);
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
