import { expect, test, type Page } from "@playwright/test";
import { adminDb, novoProjetoNoScript } from "./support";

/** Espera o script aparecer inteiro (a tela gera os blocos ao abrir) e marca o projeto como gravado. */
async function projetoGravado(page: Page, prefixo: string) {
  const id = await novoProjetoNoScript(page, prefixo);
  await expect(page.getByText("Fechamento", { exact: true })).toBeVisible({ timeout: 30_000 });
  await adminDb().from("projects").update({ status: "gravado" }).eq("id", id);
  return id;
}

// Rodar com AI_MOCK=1 e Supabase local (ver playwright.config.ts). O worker não roda aqui: o pedido fica na fila.

test("gerar vídeos: cria um pedido só, mesmo com duplo clique, e mostra a fila", async ({ page }) => {
  test.setTimeout(90_000);
  const id = await projetoGravado(page, "entrega-gerar");
  const db = adminDb();

  await page.goto(`/projetos/${id}/gravar/aprovar`);
  await expect(page.getByText("Seu vídeo está guardado")).toBeVisible();
  await page.getByRole("link", { name: "Gerar vídeos" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/entrega$`));

  await page.getByRole("button", { name: "Gerar vídeos" }).dblclick();
  await expect(page.getByText(/Na fila/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("progressbar", { name: "Andamento" })).toBeVisible();

  const { data } = await db.from("jobs").select("kind, status").eq("project_id", id);
  expect(data).toEqual([{ kind: "render", status: "queued" }]);
});

test("pedido que falhou mostra o motivo e deixa tentar de novo", async ({ page }) => {
  test.setTimeout(90_000);
  const id = await projetoGravado(page, "entrega-falha");
  const db = adminDb();
  const { data: p } = await db.from("projects").select("user_id").eq("id", id).single();
  await db.from("jobs").insert({ user_id: p!.user_id, project_id: id, kind: "render", status: "failed", error: "Faltam gravações nos blocos: 2." });

  await page.goto(`/projetos/${id}/entrega`);
  await expect(page.getByRole("alert").filter({ hasText: "Faltam gravações nos blocos: 2." })).toBeVisible();
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByText(/Na fila/)).toBeVisible({ timeout: 15_000 });
});

test("projeto que ainda não foi gravado volta para a tela Gravar", async ({ page }) => {
  test.setTimeout(60_000);
  const id = await novoProjetoNoScript(page, "entrega-cedo");
  await page.goto(`/projetos/${id}/entrega`);
  await expect(page).toHaveURL(new RegExp(`/projetos/${id}/gravar$`));
});
