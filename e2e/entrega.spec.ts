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
  await expect(page.getByRole("heading", { name: "Suas gravações" })).toBeVisible();
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

// A corrigir: desde a Fase 2 os vídeos finais ficam no Cloudflare R2, e este teste ainda põe os arquivos
// no bucket "exports" do Supabase local; o download por URL do R2 não acha nada. Precisa de um R2 de teste.
test.fixme("entrega pronta: lista vídeo final e cortes, baixa, copia a descrição e não fala mais em vencer", async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const id = await projetoGravado(page, "entrega-pronta");
  const db = adminDb();
  const { data: p } = await db.from("projects").select("user_id").eq("id", id).single();
  const user = p!.user_id as string;
  await db
    .from("projects")
    .update({
      cuts: [
        { id: "c1", start: 1, end: 2, title: "Primeiro", coverPrompt: null, descriptions: { youtube: "Texto do YouTube do corte 1" } },
        { id: "c2", start: 3, end: 3, title: "Segundo", coverPrompt: null, descriptions: {} },
      ],
    })
    .eq("id", id);

  const dias = (n: number) => new Date(Date.now() + n * 86_400_000 + 3_600_000).toISOString();
  const arquivo = async (kind: string, cutId: string | null, mime: string, expires: string) => {
    const path = `${user}/${id}/${crypto.randomUUID()}.${mime === "image/jpeg" ? "jpg" : "mp4"}`;
    const up = await db.storage.from("exports").upload(path, Buffer.from("conteudo de teste"), { contentType: mime });
    expect(up.error).toBeNull();
    const { error } = await db.from("exports").insert({ user_id: user, project_id: id, kind, cut_id: cutId, storage_path: path, mime, size_bytes: 17, duration_seconds: kind === "cover" ? null : 65, expires_at: expires });
    expect(error).toBeNull();
  };
  await arquivo("final", null, "video/mp4", dias(20));
  await arquivo("cut", "c1", "video/mp4", dias(3));
  await arquivo("cover", "c1", "image/jpeg", dias(3));
  await arquivo("cut", "c2", "video/mp4", dias(20));

  await page.goto(`/projetos/${id}/entrega`);
  await expect(page.getByRole("heading", { name: "Seus vídeos estão prontos." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vídeo final" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Corte 1 · Primeiro" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Corte 2 · Segundo" })).toBeVisible();
  await expect(page.getByText("1:05").first()).toBeVisible();
  // Os vídeos ficam guardados até o usuário apagar: não há mais aviso de vencimento.
  await expect(page.getByText(/somem em/)).toHaveCount(0);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("listitem").filter({ hasText: "Corte 1" }).getByRole("button", { name: "Baixar vídeo" }).click()]);
  expect(download.suggestedFilename()).toBe("corte-01.mp4");

  const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar tudo (.zip)" }).click()]);
  expect(zip.suggestedFilename()).toBe("gravai-videos.zip");
  const lido = await zip.createReadStream();
  const partes: Buffer[] = [];
  for await (const c of lido) partes.push(c as Buffer);
  const JSZip = (await import("jszip")).default;
  const conteudo = await JSZip.loadAsync(Buffer.concat(partes));
  expect(Object.keys(conteudo.files).sort()).toEqual(["capa-01.jpg", "corte-01.mp4", "corte-02.mp4", "descricoes.txt", "final.mp4"]);
  expect(await conteudo.file("descricoes.txt")!.async("string")).toContain("Texto do YouTube do corte 1");

  await page.getByRole("button", { name: "Copiar descrição" }).click();
  await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Texto do YouTube do corte 1");

  // Ajustar o corte 1: tempo fora do vídeo é recusado; tempos certos criam um pedido "recut" na fila.
  const card = page.getByRole("listitem").filter({ hasText: "Corte 1" });
  await card.getByText("Ajustar início e fim").click();
  await card.getByLabel("Início (segundos)").fill("1");
  await card.getByLabel("Fim (segundos)").fill("500");
  await card.getByRole("button", { name: "Usar estes tempos" }).click();
  await expect(card.getByRole("alert")).toHaveText("Início e fim do corte não são válidos.");
  expect((await db.from("jobs").select("id").eq("project_id", id)).data ?? []).toHaveLength(0);

  await card.getByLabel("Fim (segundos)").fill("5.5");
  await card.getByRole("button", { name: "Usar estes tempos" }).click();
  await expect(page.getByRole("progressbar", { name: "Andamento" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vídeo final" })).toBeVisible(); // os vídeos continuam na tela
  const { data: jobs } = await db.from("jobs").select("kind, status, payload").eq("project_id", id);
  expect(jobs).toEqual([{ kind: "recut", status: "queued", payload: { cutId: "c1", start: 1, end: 5.5 } }]);

  // Script mudou depois de gerar: avisa, pede confirmação (perde ajustes) e cria um pedido novo.
  await db.from("jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("project_id", id);
  await db.from("projects").update({ script_stale: true }).eq("id", id);
  await page.reload();
  await expect(page.getByText("Suas gravações mudaram.")).toBeVisible();
  await page.getByRole("button", { name: "Gerar de novo" }).click();
  await expect(page.getByText("serão perdidos")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("serão perdidos")).toHaveCount(0);
  await page.getByRole("button", { name: "Gerar de novo" }).click();
  await page.getByRole("button", { name: "Sim, gerar de novo" }).click();
  await expect(page.getByRole("progressbar", { name: "Andamento" })).toBeVisible();
  const { data: again } = await db.from("jobs").select("kind, status").eq("project_id", id).eq("status", "queued");
  expect(again).toEqual([{ kind: "render", status: "queued" }]);
});
