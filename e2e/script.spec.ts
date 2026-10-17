import { expect, test, type Page } from "@playwright/test";
import { novoProjetoNoScript } from "./support";

// Rodar com AI_MOCK=1: o script vem de tests/fixtures/ai/generateJson.script_generation.json
// (abertura + 5 trechos + fechamento) e a reescrita de generateJson.block_rewrite.json.

const TEXTO_REESCRITO = "Texto curto vindo da fixture de reescrita.";

const bloco = (page: Page, nome: string) => page.getByRole("region", { name: nome });
const duracaoSegundos = async (b: ReturnType<typeof bloco>) => {
  const [m, s] = (await b.getByText(/^\d+:\d{2}$/).innerText()).split(":").map(Number);
  return m * 60 + s;
};
const total = (page: Page) => page.getByTestId("tempo-total");

test("mostra o script contínuo, ajusta com botão rápido, salva a edição e reescreve um bloco", async ({ page }) => {
  test.setTimeout(60_000);
  const id = await novoProjetoNoScript(page, "script-fluxo");

  // Um vídeo só: abertura, Trecho 1..5 e fechamento; nada de "Corte N" nem contagem de cortes
  await expect(page.getByText("Abertura", { exact: true })).toBeVisible();
  for (let n = 1; n <= 5; n++) await expect(page.getByText(`Trecho ${n}`, { exact: true })).toBeVisible();
  await expect(page.getByText("Fechamento", { exact: true })).toBeVisible();
  await expect(page.getByText(/Corte \d/)).toHaveCount(0);
  await expect(page.getByText(/\d cortes?$/)).toHaveCount(0);

  // Capa e descrições do vídeo principal aparecem prontas para copiar
  await expect(page.getByRole("heading", { name: "Capa e descrições" })).toBeVisible();
  await expect(page.getByText("Capa do vídeo principal")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Copiar: Descrição/ }).first()).toBeVisible();

  // Botão rápido ao lado do texto: "Tirar saudação" age na hora e tem Desfazer
  const abertura = bloco(page, "Abertura");
  await expect(abertura).toContainText("Fala, pessoal");
  await abertura.getByRole("button", { name: "Tirar saudação" }).click();
  await expect(abertura).toContainText(TEXTO_REESCRITO);
  await expect(abertura).not.toContainText("Fala, pessoal");
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(abertura).toContainText("Fala, pessoal");

  // Botões coloridos ao lado do texto e "Voltar à versão anterior" guardado por trecho
  const voltar = abertura.getByRole("button", { name: "Voltar à versão anterior" });
  await expect(voltar).toBeDisabled();
  await abertura.getByRole("button", { name: "Encurtar" }).click();
  await expect(abertura).toContainText(TEXTO_REESCRITO);
  await expect(voltar).toBeEnabled();
  await voltar.click();
  await expect(abertura).toContainText("Fala, pessoal");
  await expect(voltar).toBeDisabled();

  // Edição: autosave e persistência depois de recarregar; o total muda
  const totalAntes = await total(page).innerText();
  const trecho1 = bloco(page, "Trecho 1");
  await trecho1.getByRole("button", { name: "Editar" }).click();
  const editor = trecho1.getByRole("textbox", { name: "Texto do Trecho 1" });
  await editor.fill("Meu corte um ficou bem curtinho.");
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await expect(total(page)).not.toHaveText(totalAntes);
  await page.reload();
  await expect(bloco(page, "Trecho 1")).toContainText("Meu corte um ficou bem curtinho.");

  // Reescrever → Mais curto troca o texto pelo da fixture e a duração cai
  const trecho2 = bloco(page, "Trecho 2");
  const antes = await duracaoSegundos(trecho2);
  await trecho2.getByRole("button", { name: "Reescrever" }).click();
  const folha = page.getByRole("dialog", { name: "Reescrever Trecho 2" });
  await folha.getByText("Mais curto", { exact: true }).click();
  await folha.getByRole("button", { name: "Reescrever" }).click();
  await expect(trecho2).toContainText(TEXTO_REESCRITO);
  expect(await duracaoSegundos(trecho2)).toBeLessThan(antes);
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await page.reload();
  await expect(bloco(page, "Trecho 2")).toContainText(TEXTO_REESCRITO);

  // Gravar leva à tela provisória
  await page.getByRole("link", { name: "Gravar" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar$`));
  await expect(page.getByText("Como quer gravar?")).toBeVisible();
});

test("gerar de novo pede confirmação antes de substituir o script", async ({ page }) => {
  await novoProjetoNoScript(page, "script-regerar");
  const trecho1 = bloco(page, "Trecho 1");
  await trecho1.getByRole("button", { name: "Editar" }).click();
  await trecho1.getByRole("textbox", { name: "Texto do Trecho 1" }).fill("Texto que vai ser substituído.");
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gerar script de novo" }).click();
  const confirmacao = page.getByRole("dialog", { name: "Gerar o script de novo?" });
  await expect(confirmacao.getByText("Isso substitui o script atual. Continuar?")).toBeVisible();
  await confirmacao.getByRole("button", { name: "Cancelar" }).click();
  await expect(bloco(page, "Trecho 1")).toContainText("Texto que vai ser substituído.");

  await page.getByRole("button", { name: "Gerar script de novo" }).click();
  await page.getByRole("dialog", { name: "Gerar o script de novo?" }).getByRole("button", { name: "Continuar" }).click();
  await expect(bloco(page, "Trecho 1")).not.toContainText("Texto que vai ser substituído.");
  await expect(page.getByText("Trecho 5", { exact: true })).toBeVisible();
});

test("um refresh do servidor não apaga o que o usuário está digitando", async ({ page }) => {
  await novoProjetoNoScript(page, "script-refresh");
  const trecho1 = bloco(page, "Trecho 1");
  await trecho1.getByRole("button", { name: "Editar" }).click();
  const editor = trecho1.getByRole("textbox", { name: "Texto do Trecho 1" });
  await editor.fill("Digitando antes do refresh.");
  // Mesmo efeito de um refresh de sessão: a página do servidor chega de novo com o texto antigo.
  await page.evaluate(() => (window as unknown as { next: { router: { refresh(): void } } }).next.router.refresh());
  await page.waitForTimeout(1500);
  await expect(editor).toHaveValue("Digitando antes do refresh.");
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
});

test("se gerar de novo falhar, a edição continua na tela e no banco", async ({ page }) => {
  await novoProjetoNoScript(page, "script-falha");
  const trecho1 = bloco(page, "Trecho 1");
  await trecho1.getByRole("button", { name: "Editar" }).click();
  await trecho1.getByRole("textbox", { name: "Texto do Trecho 1" }).fill("Edição que não pode se perder.");
  // O 1º POST (gravar a edição) passa; o 2º (gerar o script) cai.
  let posts = 0;
  await page.route(/\/script$/, (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return ++posts === 1 ? route.continue() : route.abort();
  });
  await page.getByRole("button", { name: "Gerar script de novo" }).click();
  await page.getByRole("dialog", { name: "Gerar o script de novo?" }).getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível gerar agora" })).toBeVisible();
  await page.unroute(/\/script$/);
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(bloco(page, "Trecho 1")).toContainText("Edição que não pode se perder.");
  await page.reload();
  await expect(bloco(page, "Trecho 1")).toContainText("Edição que não pode se perder.");
});

test("durante a geração Esc não fecha a confirmação e o Desfazer não sobrevive ao script novo", async ({ page }) => {
  await novoProjetoNoScript(page, "script-esc");
  const trecho1 = bloco(page, "Trecho 1");
  const original = (await trecho1.locator("p").first().innerText()).trim();

  await trecho1.getByRole("button", { name: "Reescrever" }).click();
  const folha = page.getByRole("dialog", { name: "Reescrever Trecho 1" });
  await folha.getByText("Mais curto", { exact: true }).click();
  await folha.getByRole("button", { name: "Reescrever" }).click();
  await expect(trecho1).toContainText(TEXTO_REESCRITO);
  await expect(page.getByRole("button", { name: "Desfazer" })).toBeVisible();

  await page.route(/\/script$/, async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.getByRole("button", { name: "Gerar script de novo" }).click();
  const confirmacao = page.getByRole("dialog", { name: "Gerar o script de novo?" });
  await confirmacao.getByRole("button", { name: "Continuar" }).click();
  await expect(confirmacao.getByRole("button", { name: "Gerando…" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirmacao).toBeVisible();

  await expect(confirmacao).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Desfazer" })).toHaveCount(0);
  await expect(bloco(page, "Trecho 1")).toContainText(original);
});

test("voltar de /gravar reabre o script com a edição salva", async ({ page }) => {
  const id = await novoProjetoNoScript(page, "script-voltar");
  const trecho1 = bloco(page, "Trecho 1");
  await trecho1.getByRole("button", { name: "Editar" }).click();
  await trecho1.getByRole("textbox", { name: "Texto do Trecho 1" }).fill("Edição que precisa sobreviver ao voltar.");
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Gravar" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/script$`));
  await expect(bloco(page, "Trecho 1")).toContainText("Edição que precisa sobreviver ao voltar.");
});

test("mudar uma resposta depois do script mostra a faixa de script desatualizado", async ({ page }) => {
  const id = await novoProjetoNoScript(page, "script-velho");
  await expect(page.getByText("Suas respostas mudaram desde este script")).toHaveCount(0);

  await page.goto(`/projetos/${id}/entrevista/duracao`);
  await page.getByRole("radiogroup", { name: "Duração do vídeo" }).getByRole("radio").first().check({ force: true });
  await page.getByRole("button", { name: "Próxima" }).click();
  await expect(page).toHaveURL(/\/entrevista\/cortes$/);

  await page.goto(`/projetos/${id}/script`);
  await expect(page.getByText("Suas respostas mudaram desde este script")).toBeVisible();
  await page.getByRole("button", { name: "Gerar de novo", exact: true }).click();
  await page.getByRole("dialog", { name: "Gerar o script de novo?" }).getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Suas respostas mudaram desde este script")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Suas respostas mudaram desde este script")).toHaveCount(0);
});
