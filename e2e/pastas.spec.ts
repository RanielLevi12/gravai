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

const PALAVRAS_300 = Array.from({ length: 300 }, (_, i) => `palavra${i + 1}`).join(" ");

test("vídeo novo dentro do projeto: entrevista curta, personalizado e voltar ao padrão", async ({ page }) => {
  await entrarComOnboardingFeito(page, "video-no-projeto");
  await page.goto("/pastas/nova");
  await page.getByLabel("Nome do projeto").fill("Devocional");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page).toHaveURL(/\/pastas\/[0-9a-f-]{36}$/);
  const pastaUrl = page.url();

  // Entrada pela página do projeto.
  await page.getByRole("link", { name: "Novo vídeo neste projeto" }).click();
  await expect(page.getByText("No projeto Devocional.")).toBeVisible();
  await page.getByRole("link", { name: /Colar texto/ }).click();
  await page.getByLabel("Cole seu texto").fill(PALAVRAS_300);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/projetos\/[0-9a-f-]{36}\/fonte$/);
  const id = /\/projetos\/([0-9a-f-]{36})\//.exec(page.url())![1];
  await page.getByRole("button", { name: "Continuar" }).click();

  // Entrevista curta: cai direto no título, com o resumo herdado do projeto.
  await expect(page).toHaveURL(/\/entrevista\/titulos$/);
  await expect(page.getByText("Escolhas do projeto Devocional")).toBeVisible();
  await expect(page.getByText("Reels · vídeo único · 60 s · cortes de 30 s · sem chamada")).toBeVisible();
  await page.getByRole("button", { name: "Próxima" }).click();
  await expect(page).toHaveURL(/\/entrevista\/resumo$/);
  await expect(page.getByText("personalizado")).toHaveCount(0);

  // O vídeo aparece na página do projeto e não entre os soltos.
  await page.goto(pastaUrl);
  await expect(page.getByText("Vídeos deste projeto")).toBeVisible();
  await page.goto("/projetos");
  await expect(page.getByRole("link", { name: /Devocional/ })).toContainText("1 vídeo");

  // Mudar só este vídeo: a resposta ganha "personalizado".
  await page.goto(`/projetos/${id}/entrevista/duracao`);
  await page.getByRole("radio", { name: "30 s" }).check({ force: true });
  await page.getByRole("button", { name: "Próxima" }).click();
  await expect(page).toHaveURL(/\/entrevista\/cortes$/);
  await page.getByRole("radio", { name: "10 s" }).check({ force: true });
  await page.getByRole("button", { name: "Próxima" }).click();
  await expect(page).toHaveURL(/\/entrevista\/resumo$/);
  await expect(page.getByText("personalizado")).toHaveCount(2);

  // Voltar ao padrão do projeto tira a etiqueta.
  await page.getByRole("button", { name: "Voltar ao padrão do projeto" }).first().click();
  await expect(page.getByText("personalizado")).toHaveCount(1);
  await page.getByRole("button", { name: "Voltar ao padrão do projeto" }).click();
  await expect(page.getByText("personalizado")).toHaveCount(0);
  await expect(page.getByText("60 s", { exact: true })).toBeVisible();
});

test("não dá para criar vídeo no projeto de outra pessoa", async ({ page }) => {
  await entrarComOnboardingFeito(page, "projeto-alheio");
  await page.goto("/novo?origem=texto&projeto=00000000-0000-4000-8000-000000000000");
  // Projeto inexistente (ou de outra pessoa): a tela segue como vídeo solto, sem o aviso do projeto.
  await expect(page.getByLabel("Cole seu texto")).toBeVisible();
  const r = await page.request.post("/api/projects", {
    headers: { origin: new URL(page.url()).origin },
    multipart: { kind: "text", text: PALAVRAS_300, folder_id: "00000000-0000-4000-8000-000000000000" },
  });
  expect(r.status()).toBe(422);
});
