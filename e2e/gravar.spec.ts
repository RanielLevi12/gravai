import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync, truncateSync } from "node:fs";
import { novoProjetoNoScript } from "./support";

/** Espera o script aparecer inteiro: a tela gera os blocos ao abrir. */
async function projetoComScript(page: Page, prefixo: string) {
  const id = await novoProjetoNoScript(page, prefixo);
  await expect(page.getByText("Fechamento", { exact: true })).toBeVisible({ timeout: 30_000 });
  return id;
}

// Rodar com AI_MOCK=1 (script de mentirinha: abertura + 5 trechos + fechamento = 7 blocos), Supabase local
// e câmera falsa (ver playwright.config.ts).

const BLOCOS = 7;

/** Cliente admin do Supabase local, só para conferir o banco e mudar a duração do vídeo. */
function admin() {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .map((l) => /^([A-Z_]+)=(.*)$/.exec(l))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
  );
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("e2e só roda contra o Supabase local");
  return createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/** Começa a gravar, espera a contagem, deixa gravar `segundos` e para. Termina na prévia. */
async function gravar(page: Page, segundos: number) {
  const botao = page.getByRole("button", { name: "Começar a gravar" });
  await expect(botao).toBeEnabled({ timeout: 15_000 });
  await botao.click();
  const parar = page.getByRole("button", { name: "Parar gravação" });
  await expect(parar).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(segundos * 1000);
  await parar.click();
  await expect(page).toHaveURL(/\/gravar\/aprovar\?gravacao=/);
  await expect(page.locator("video")).toBeVisible();
}

test("take único: grava, vê a prévia, usa e aprova", async ({ page }) => {
  test.setTimeout(120_000);
  const id = await projetoComScript(page, "gravar-take");
  // Nada pulado: a conferência de trecho pulado tem teste próprio logo abaixo.
  await page.route("**/api/record/skipped*", (route) => route.fulfill({ json: { skipped: [] } }));
  await page.goto(`/projetos/${id}/gravar`);
  await page.getByText("Tudo de uma vez").click();
  await page.getByRole("link", { name: "Gravar tudo de uma vez" }).click();
  await expect(page).toHaveURL(/teleprompter\?modo=take/);

  await gravar(page, 3);
  await page.getByRole("button", { name: "Usar este" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar/aprovar$`));
  await page.getByRole("button", { name: "Aprovar e guardar" }).click();
  await expect(page.getByRole("heading", { name: "Suas gravações" })).toBeVisible();
  // Conferência em duas fases: o vídeo e o projeto (aqui, vídeo solto)
  await expect(page.getByRole("heading", { name: "Este vídeo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sem projeto" })).toBeVisible();

  await page.goto("/projetos");
  await expect(page.getByText("Gravado", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Ver" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar/aprovar$`));
  const video = page.getByLabel("Gravação: Vídeo inteiro");
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15_000 }).toBeGreaterThan(0);

  const { data } = await admin().from("recordings").select("kind, status").eq("project_id", id);
  expect(data).toEqual([{ kind: "take", status: "ready" }]);
});

test("por blocos: refaz o 1º, grava todos e fica uma gravação pronta por bloco", async ({ page }) => {
  test.setTimeout(240_000);
  const id = await projetoComScript(page, "gravar-blocos");
  await page.goto(`/projetos/${id}/gravar`);
  await page.getByRole("link", { name: "Gravar por blocos" }).click();
  await expect(page).toHaveURL(/teleprompter\?modo=blocos/);
  await expect(page.getByText(`bloco 1 de ${BLOCOS}`)).toBeVisible();

  // 1º bloco: grava, refaz e grava de novo
  await gravar(page, 2);
  await page.getByRole("button", { name: "Refazer" }).click();
  await expect(page).toHaveURL(/teleprompter\?modo=blocos&bloco=/);
  await gravar(page, 2);
  await page.getByRole("button", { name: "Usar este" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar/aprovar\\?feito=`));
  // Lembrete: segue para a próxima parte e avisa quais faltam
  await expect(page.getByRole("heading", { name: "Gravar a próxima: Trecho 1" })).toBeVisible();
  await expect(page.getByRole("alert", { name: "Partes que faltam" })).toContainText("Trecho 1");
  await expect(page.getByRole("button", { name: "Aprovar e guardar" })).toBeDisabled();
  await page.getByRole("link", { name: "Gravar Trecho 1" }).click();
  await expect(page).toHaveURL(/teleprompter\?modo=blocos&bloco=/);
  await expect(page.getByText(`bloco 2 de ${BLOCOS}`)).toBeVisible();
  await gravar(page, 2);
  await page.getByRole("button", { name: "Usar este" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar/aprovar\\?feito=`));

  // Demais blocos, um por um, pela lista
  for (let n = 3; n <= BLOCOS; n++) {
    await page.getByRole("link", { name: "Gravar", exact: true }).first().click();
    await expect(page.getByText(`bloco ${n} de ${BLOCOS}`)).toBeVisible();
    await gravar(page, 2);
    await page.getByRole("button", { name: "Usar este" }).click();
    await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar/aprovar\\?feito=`));
  }

  await page.getByRole("button", { name: "Aprovar e guardar" }).click();
  await expect(page.getByRole("heading", { name: "Suas gravações" })).toBeVisible();

  const { data } = await admin().from("recordings").select("block_id, status").eq("project_id", id);
  expect(data).toHaveLength(BLOCOS);
  expect(data!.every((r) => r.status === "ready")).toBe(true);
  expect(new Set(data!.map((r) => r.block_id)).size).toBe(BLOCOS);
});

test("tela inicial mostra 'Faltam N partes' quando o vídeo está sendo gravado por blocos", async ({ page }) => {
  test.setTimeout(120_000);
  const id = await projetoComScript(page, "gravar-faltam");
  await page.goto(`/projetos/${id}/gravar`);
  await page.getByRole("link", { name: "Gravar por blocos" }).click();
  await gravar(page, 2);
  await page.getByRole("button", { name: "Usar este" }).click();
  await expect(page).toHaveURL(/\/aprovar\?feito=/);
  await page.goto("/projetos");
  await expect(page.getByText(`Faltam ${BLOCOS - 1} partes para gravar`)).toBeVisible();
});

test("take único: aviso de trecho pulado, com 'Seguir mesmo assim' (precisa AI_MOCK=1)", async ({ page }) => {
  test.setTimeout(120_000);
  const id = await projetoComScript(page, "gravar-pulou");
  await page.route("**/api/record/skipped*", async (route) => {
    // A detecção em si é testada em tests/unit/record-skipped.test.ts; aqui só a tela do aviso.
    await route.fulfill({ json: { skipped: [{ id: "x", label: "Trecho 2", coverage: 0 }] } });
  });
  await page.goto(`/projetos/${id}/gravar`);
  await page.getByText("Tudo de uma vez").click();
  await page.getByRole("link", { name: "Gravar tudo de uma vez" }).click();
  await gravar(page, 3);
  await page.getByRole("button", { name: "Usar este" }).click();
  await expect(page.getByText("Parece que você pulou o Trecho 2.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gravar de novo" })).toBeVisible();
  await page.getByRole("button", { name: "Seguir mesmo assim" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar/aprovar$`));
});

test("vídeo de fora: aceita um pequeno e recusa um de 501 MB", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const id = await projetoComScript(page, "gravar-fora");
  await page.goto(`/projetos/${id}/gravar`);
  await page.getByText("Já gravei").click();
  const arquivo = page.getByLabel("Escolher vídeo");

  // O Playwright não aceita buffer acima de 50 MB: o arquivo grande vai por caminho (esparso, quase sem disco).
  const grande = testInfo.outputPath("grande.webm");
  writeFileSync(grande, "");
  truncateSync(grande, 501 * 1024 * 1024);
  await arquivo.setInputFiles(grande);
  await expect(page.getByText("Este vídeo passa de 500 MB. Grave por blocos no app ou reduza o tamanho antes de enviar.")).toBeVisible();

  await arquivo.setInputFiles({ name: "pequeno.webm", mimeType: "video/webm", buffer: Buffer.alloc(200 * 1024, 1) });
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar/aprovar$`));
  await page.getByRole("button", { name: "Aprovar e guardar" }).click();
  await expect(page.getByRole("heading", { name: "Suas gravações" })).toBeVisible();

  const { data } = await admin().from("recordings").select("kind, status").eq("project_id", id);
  expect(data).toEqual([{ kind: "external", status: "ready" }]);
});

test("vídeo de 5 min: 'Tudo de uma vez' fica desabilitado com o motivo", async ({ page }) => {
  test.setTimeout(60_000);
  const id = await projetoComScript(page, "gravar-5min");
  const db = admin();
  const { data: p } = await db.from("projects").select("interview").eq("id", id).single();
  await db.from("projects").update({ interview: { ...(p!.interview as object), mainSeconds: 300 } }).eq("id", id);

  await page.goto(`/projetos/${id}/gravar`);
  await expect(page.getByRole("radio", { name: /Tudo de uma vez/ })).toBeDisabled();
  await expect(page.getByText("Vídeo de 5 min: grave por blocos.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Por partes/ })).toBeEnabled();
});

test("câmera negada: explica como liberar e continua oferecendo vídeo de fora", async ({ page }) => {
  test.setTimeout(60_000);
  const id = await projetoComScript(page, "gravar-negada");
  // A janela de permissão é automática por causa da câmera falsa; aqui o navegador "nega" de verdade.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("negado", "NotAllowedError"));
  });
  await page.goto(`/projetos/${id}/gravar/teleprompter?modo=take`);
  await expect(page.getByRole("heading", { name: "Preciso da câmera e do microfone" })).toBeVisible();
  await expect(page.getByText(/Toque no cadeado/)).toBeVisible();
  await page.getByRole("link", { name: "Enviar vídeo feito fora" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar$`));
});

test("teleprompter: arrastar com o dedo move o texto e segura enquanto o dedo está na tela", async ({ page }) => {
  test.setTimeout(60_000);
  const id = await projetoComScript(page, "gravar-arrastar");
  await page.goto(`/projetos/${id}/gravar/teleprompter?modo=take`);
  const texto = page.getByRole("button", { name: /Pausar texto|Continuar texto/ });
  await expect(texto).toBeVisible();
  const caixa = (await texto.boundingBox())!;
  const x = caixa.x + caixa.width / 2;
  const topo = () => texto.evaluate((el) => el.scrollTop);

  // Arrastar para cima leva o texto para cima (rola para frente).
  await page.mouse.move(x, caixa.y + caixa.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(x, caixa.y + caixa.height * 0.3, { steps: 8 });
  const durante = await topo();
  expect(durante).toBeGreaterThan(50);
  await page.waitForTimeout(500);
  expect(await topo()).toBe(durante); // dedo parado: texto parado
  await page.mouse.up();

  // Arrastar para baixo puxa o texto de volta.
  await page.mouse.move(x, caixa.y + caixa.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(x, caixa.y + caixa.height * 0.6, { steps: 8 });
  expect(await topo()).toBeLessThan(durante);
  await page.mouse.up();

  // Arrastar não pausa; um toque pausa.
  await expect(texto).toHaveAccessibleName("Pausar texto");
  await texto.click();
  await expect(texto).toHaveAccessibleName("Continuar texto");
});

test("ajustes de câmera: automático ligado, câmeras com nome, 1080p, Info técnica real, guarda e fecha ao tocar fora", async ({ page }) => {
  test.setTimeout(90_000);
  const id = await projetoComScript(page, "gravar-camera");
  await page.goto(`/projetos/${id}/gravar/teleprompter?modo=take`);
  await expect(page.getByRole("button", { name: "Começar a gravar" })).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByTestId("selo-automatico")).toHaveText(/Automático · (1080|720)p/);

  // Na tela só ficam os controles essenciais.
  for (const nome of ["Fechar", "Ajustes", "Virar câmera", "Mais devagar", "Mais rápido", "Começar a gravar"]) {
    await expect(page.getByRole("button", { name: nome }).or(page.getByRole("link", { name: nome }))).toBeVisible();
  }

  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("tab", { name: "Câmera" }).click();
  // Câmera em uso com nome e tamanho real da imagem.
  await expect(page.getByTestId("camera-em-uso")).toContainText(/Imagem de \d+×\d+/);
  await page.getByText("Avançado", { exact: true }).click();
  const primeira = page.getByRole("group", { name: "Câmera", exact: true }).getByRole("button").first();
  await primeira.click();
  await expect(primeira).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "1080p", exact: true }).click();
  // A câmera aberta é a escolhida (o id dela está no track de verdade).
  const usada = () => page.locator("video").first().evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream | null)?.getVideoTracks()[0]?.getSettings().deviceId ?? "");
  await expect.poll(usada, { timeout: 10_000 }).not.toBe("");

  // Info técnica: números lidos da câmera, nunca um quadro em pé pedido pelo app.
  await page.getByText("Info técnica", { exact: true }).click();
  await expect(page.getByTestId("info-tecnica")).toContainText(/\d+×\d+/);
  await page.getByRole("button", { name: "Pronto" }).click();

  await page.reload();
  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("tab", { name: "Câmera" }).click();
  await page.getByText("Avançado", { exact: true }).click();
  await expect(page.getByRole("button", { name: "1080p", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Câmera", exact: true }).getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
  // Tocar fora do painel fecha.
  await page.getByTestId("fundo-ajustes").click({ position: { x: 30, y: 120 } });
  await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeHidden();

  await gravar(page, 2);
});
