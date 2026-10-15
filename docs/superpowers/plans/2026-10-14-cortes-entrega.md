# Cortes e entrega Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois de aprovar a gravação, gerar o vídeo final e um vídeo por corte (9:16) com capa e descrições, e entregar tudo para baixar (incluindo .zip).

**Architecture:** O app (Next) cria um pedido em `jobs`; um worker Node + ffmpeg no Fly.io pega o pedido, monta os vídeos e grava os arquivos no bucket privado `exports`. A tela `/projetos/[id]/entrega` mostra o progresso e os downloads. A IA do usuário (transcrição) fica no Next; o worker a chama por uma rota interna com segredo.

**Tech Stack:** Next 16, Supabase (Postgres, Storage, RLS), ffmpeg/ffprobe via `child_process`, Vitest, Playwright, Fly.io, `jszip` (já instalado).

**Spec:** `docs/superpowers/specs/2026-10-14-cortes-entrega-design.md`

## Global Constraints

- Falar com o usuário em pt-BR; textos da interface em pt-BR, curtos, para leigo.
- Supabase plano gratuito: **máximo de 50 MB por arquivo** (bucket `exports` incluído).
- Saída de vídeo: 1080×1920, 30 fps, H.264 + AAC, `loudnorm`; bitrate alvo de reencode 1,8 Mbps vídeo + 96 kbps áudio.
- Retenção de `exports`: 30 dias (`expires_at`), aviso 5 dias antes.
- Um job ativo (`queued`/`running`) por projeto. Job órfão volta a `queued` após 10 min sem sinal; no máximo 3 tentativas.
- URLs assinadas de download: 5 min.
- Service role e chaves de IA só no servidor (Next e `fly secrets`), nunca no navegador.
- Produção (Supabase `dieciotgdpgmxccxjqsy`, Fly, Vercel): só com o sim do usuário; migração sempre `npx supabase db push --dry-run`, mostrar o SQL, esperar o sim.
- Push, PR e merge só com o sim do usuário; conta GitHub `haniellevi` (`gh` no terminal).
- Nunca commitar `.env.example`, `DESIGN.md`, `PRODUCT.md`, `AGENTS.md`, `.impeccable/*`, `design/marca/identidade.html`, arquivos soltos da raiz; `git add` só por caminho.
- Next 16 tem mudanças: ler `node_modules/next/dist/docs/` antes de escrever páginas/rotas (`params`/`searchParams` assíncronos).
- Docker, Supabase local e e2e rodam fora do sandbox do Bash.

## Review Focus

- Duplo clique em "Gerar vídeos": só um job nasce (índice único + mensagem "Já estamos gerando").
- Bloco do corte sem gravação `ready`: o job falha cedo, listando os blocos, sem gastar ffmpeg.
- Gravação refeita depois de gerar: a tela oferece "Gerar de novo"; os `exports` antigos só são trocados quando o novo job termina.
- Arquivo gerado acima de 50 MB: reencoda com bitrate menor; se ainda passar, falha com mensagem clara.
- Outro usuário tentando ler `jobs`/`exports`/bucket de um projeto alheio: negado por RLS e pela rota de zip.
- Worker morre no meio: o job é reassumido sem duplicar `exports`.
- Script com acentos, números e pontuação: o alinhamento com a fala ignora maiúsculas e acentos.
- Projeto com zero cortes: gera só o vídeo final; o .zip não quebra.

---

## File Structure

- `supabase/migrations/0011_jobs_exports.sql` — tabelas `jobs`, `exports`, `transcripts`, bucket `exports`, funções `claim_job`, `requeue_stale_jobs`, `purge_expired_exports`.
- `src/lib/delivery/rules.ts` — regras puras (estados, expiração, nomes de arquivo, mensagens).
- `src/lib/delivery/db.ts` + `service.ts` + `actions.ts` — mesmo padrão de `src/lib/record/` (interface `DeliveryDb`, serviço testável, ações de servidor).
- `src/lib/delivery/trigger.ts` — liga a máquina do Fly.
- `src/app/(app)/projetos/[id]/entrega/` — `page.tsx`, `JobProgress.tsx`, `CutCard.tsx`, `AdjustCut.tsx`, `zip/route.ts`.
- `src/app/api/internal/transcribe/route.ts` — o worker pede a transcrição com tempos.
- `worker/` — pacote Node separado: `src/main.ts`, `claim.ts`, `ffmpeg.ts`, `plan.ts`, `render.ts`, `covers.ts`, `align.ts`, `storage.ts`, `Dockerfile`, `fly.toml`.
- Testes: `tests/unit/delivery-*.test.ts`, `tests/integration/delivery.test.ts`, `worker/test/*.test.ts`, `e2e/entrega.spec.ts`.

---

### Task 1: Migração 0011 e regras puras

**Files:**
- Create: `supabase/migrations/0011_jobs_exports.sql`, `src/lib/delivery/rules.ts`
- Modify: `src/lib/supabase/types.ts` (via `npm run db:types`), `src/lib/project/next-step.ts` (projeto `gravado` → `/entrega` quando houver exports; `pronto` → `/entrega`)
- Test: `tests/unit/delivery-rules.test.ts`, `tests/integration/delivery.test.ts`

**Interfaces:**
- Produces (`rules.ts`):
  - `type JobStatus = "queued" | "running" | "done" | "failed"`; `type ExportKind = "final" | "cut" | "cover"`
  - `EXPORT_TTL_DAYS = 30`, `WARN_DAYS = 5`, `STALE_JOB_MINUTES = 10`, `MAX_ATTEMPTS = 3`
  - `expiresAt(from: Date): Date`
  - `daysLeft(expires: Date, now: Date): number`
  - `exportFileName(kind: ExportKind, cutIndex: number | null, ext: "mp4" | "jpg"): string` → `"final.mp4"`, `"corte-02.mp4"`, `"capa-02.jpg"`
  - `STEP_LABELS: Record<"preparando" | "juntando" | "transcrevendo" | "cortando" | "capas" | "enviando", string>` (pt-BR)

- [ ] **Step 1: Testes unitários que falham** (`delivery-rules.test.ts`): `expiresAt(new Date("2026-10-14T00:00:00Z"))` é `2026-11-13`; `daysLeft` de 4 dias devolve `4` e de data passada devolve `0`; `exportFileName("cut", 2, "mp4") === "corte-02.mp4"`, `exportFileName("final", null, "mp4") === "final.mp4"`, `exportFileName("cover", 12, "jpg") === "capa-12.jpg"`.
- [ ] **Step 2: Rodar** `npx vitest run tests/unit/delivery-rules.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar `rules.ts`** com as assinaturas acima.
- [ ] **Step 4: Rodar** o mesmo teste → PASS.
- [ ] **Step 5: Teste de integração que falha** (`delivery.test.ts`, mesmo padrão de `recordings.test.ts`): (a) dono lê o próprio `jobs`/`exports`, outro usuário não vê nada; (b) dono não consegue `insert` direto em `exports` nem `update` em `jobs` (só service role); (c) segundo `insert` de job `queued` no mesmo projeto falha pelo índice único parcial; (d) `claim_job()` chamado duas vezes em paralelo devolve o job a um só chamador e `null` ao outro; (e) `requeue_stale_jobs()` devolve a `queued` um job `running` com `heartbeat_at` de 11 min atrás e `attempts < 3`, e marca `failed` se `attempts >= 3`; (f) `purge_expired_exports()` devolve os `storage_path` vencidos e apaga as linhas.
- [ ] **Step 6: Escrever a migração.** Colunas conforme o spec; `jobs` ganha `heartbeat_at timestamptz`. Índice único parcial `jobs(project_id) where status in ('queued','running')`. RLS: dono só `select`; escrita só service role (a criação do job vai por função `create_render_job(p_project uuid, p_kind text, p_payload jsonb)` `security definer` que confere dono e status do projeto `gravado`/`pronto`). `claim_job()`: `update ... where id = (select id ... where status='queued' order by created_at for update skip locked limit 1) returning *`, incrementa `attempts`. `purge_expired_exports()` é `security definer`, só service role. Bucket `exports` privado, 50 MB, `video/mp4` e `image/jpeg`, policy de leitura do dono pelo prefixo `{auth.uid()}/`. Agendar `purge_expired_exports` com `pg_cron` apenas se a extensão existir no local; em produção o agendamento é feito na Task 10.
- [ ] **Step 7: Aplicar no Supabase local** (`npx supabase db reset` fora do sandbox), rodar `npm run db:types`, e rodar `npm run test:integration` → PASS.
- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0011_jobs_exports.sql src/lib/delivery/rules.ts src/lib/supabase/types.ts src/lib/project/next-step.ts tests/unit/delivery-rules.test.ts tests/integration/delivery.test.ts
git commit -m "feat(delivery): jobs, exports, transcripts and bucket"
```

---

### Task 2: Gerar vídeos (ação) e tela de progresso

**Files:**
- Create: `src/lib/delivery/db.ts`, `src/lib/delivery/service.ts`, `src/lib/delivery/actions.ts`, `src/lib/delivery/trigger.ts`, `src/app/(app)/projetos/[id]/entrega/page.tsx`, `src/app/(app)/projetos/[id]/entrega/JobProgress.tsx`
- Modify: `src/app/(app)/projetos/[id]/gravar/aprovar/page.tsx` (no estado `gravado`/`pronto`: trocar o texto "Cortes e entrega chegam na próxima versão." por botão "Gerar vídeos" / link "Ver entrega")
- Test: `tests/unit/delivery-service.test.ts`, `e2e/entrega.spec.ts`

**Interfaces:**
- Consumes: `create_render_job` (Task 1), `STEP_LABELS`.
- Produces:
  - `interface DeliveryDb { project(id): Promise<{ id: string; status: string; scriptStale: boolean } | null>; activeJob(projectId): Promise<{ id: string; status: JobStatus; step: string | null; progress: number; error: string | null } | null>; latestJob(projectId): Promise<... | null>; createJob(projectId: string, kind: "render" | "recut", payload: object): Promise<string>; exportsOf(projectId): Promise<ExportRow[]> }`
  - `createRenderJobWith(db: DeliveryDb, projectId: string): Promise<{ jobId: string }>` — lança `MSG_ALREADY_RUNNING = "Já estamos gerando seus vídeos."`, `MSG_NOT_RECORDED = "Aprove a gravação antes de gerar os vídeos."`
  - `createRenderJob(projectId: string): Promise<{ jobId: string } | { error: string }>` (ação de servidor)
  - `wakeWorker(): Promise<void>` — `POST` na API de máquinas do Fly com `FLY_API_TOKEN`/`FLY_APP`; sem variáveis (dev) não faz nada.
  - `getJobStatus(projectId: string): Promise<JobView | null>` (ação de servidor, usada pelo polling a cada 3 s)

- [ ] **Step 1: Testes unitários que falham** (`delivery-service.test.ts`, banco falso em memória): projeto `gravado` cria job; projeto `script` devolve `MSG_NOT_RECORDED`; com job ativo devolve `MSG_ALREADY_RUNNING`; duas chamadas simultâneas criam um job só.
- [ ] **Step 2: Rodar** `npx vitest run tests/unit/delivery-service.test.ts` → FAIL.
- [ ] **Step 3: Implementar** `service.ts`, `db.ts` (sobre o Supabase da sessão, chamando `create_render_job`), `actions.ts` (padrão `failure`/`SAFE` de `record/actions.ts`; chama `wakeWorker()` depois de criar, sem falhar a ação se o Fly estiver fora).
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Página `entrega`** (servidor): sem job nem exports → botão "Gerar vídeos"; job ativo → `JobProgress` (cliente, consulta `getJobStatus` a cada 3 s, mostra `STEP_LABELS[step]` e barra); `failed` → `error` + "Tentar de novo"; fila parada há mais de 10 min → "Na fila" com aviso.
- [ ] **Step 6: E2E que falha** (`e2e/entrega.spec.ts`): projeto gravado em take único → "Gerar vídeos" → aparece "Na fila"; clicar duas vezes seguidas deixa uma linha em `jobs`. Rodar com Supabase local, fora do sandbox → depois de implementar, PASS.
- [ ] **Step 7: Commit**

```bash
git add src/lib/delivery "src/app/(app)/projetos/[id]/entrega" "src/app/(app)/projetos/[id]/gravar/aprovar/page.tsx" tests/unit/delivery-service.test.ts e2e/entrega.spec.ts
git commit -m "feat(delivery): generate videos action and progress screen"
```

---

### Task 3: Worker — esqueleto, fila e ffmpeg

**Files:**
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/vitest.config.ts`, `worker/src/main.ts`, `worker/src/claim.ts`, `worker/src/ffmpeg.ts`, `worker/src/storage.ts`, `worker/Dockerfile`, `worker/README.md`
- Test: `worker/test/ffmpeg.test.ts`, `worker/test/claim.test.ts`

**Interfaces:**
- Produces:
  - `probe(file: string): Promise<{ duration: number; width: number; height: number; hasAudio: boolean }>` (`ffprobe -print_format json`)
  - `run(args: string[]): Promise<void>` — `spawn("ffmpeg", ...)`, falha com as últimas linhas do stderr.
  - `claimJob(db): Promise<Job | null>`; `heartbeat(db, jobId): Promise<void>` a cada 30 s; `progress(db, jobId, step, pct): Promise<void>`; `finish(db, jobId, ok: true | { error: string }): Promise<void>`
  - `download(db, bucket, path, dest): Promise<void>`; `upload(db, path, file, mime): Promise<{ sizeBytes: number }>`
  - Laço principal: pega job → processa → repete; sem job por 60 s o processo sai (a máquina do Fly desliga).

- [ ] **Step 1: Teste que falha** (`ffmpeg.test.ts`): gerar com `ffmpeg -f lavfi -i testsrc=duration=2:size=640x360 -f lavfi -i sine=duration=2 ...` um arquivo em `os.tmpdir()`; `probe` devolve `duration≈2` (±0,1), `width=640`, `hasAudio=true`.
- [ ] **Step 2: Rodar** `cd worker && npx vitest run` → FAIL.
- [ ] **Step 3: Implementar** `ffmpeg.ts`; dependências do worker: `@supabase/supabase-js`, `vitest`, `typescript`, `tsx` (sem biblioteca de ffmpeg).
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Teste de `claim.test.ts`** (Supabase local): dois `claimJob` simultâneos, um recebe o job e o outro `null`. Implementar `claim.ts` chamando a função `claim_job` e `heartbeat`/`progress`/`finish` sobre `jobs`.
- [ ] **Step 6: `main.ts`** com o laço acima e o `Dockerfile` (imagem `node:22-slim` + `apt-get install -y ffmpeg`).
- [ ] **Step 7: Commit**

```bash
git add worker
git commit -m "feat(worker): job queue loop and ffmpeg helpers"
```

---

### Task 4: Worker — render por blocos (final, cortes, capas)

**Files:**
- Create: `worker/src/plan.ts`, `worker/src/render.ts`, `worker/src/covers.ts`
- Modify: `worker/src/main.ts` (job `render` chama `renderProject`)
- Test: `worker/test/plan.test.ts`, `worker/test/render.test.ts`

**Interfaces:**
- Consumes: Task 3 (`probe`, `run`, `download`, `upload`, `progress`, `finish`); `projects.cuts` (`{ id, start, end, title, ... }`, posições 1..n) e `script_blocks(position)`.
- Produces (`plan.ts`, funções puras):
  - `type Range = { startSeconds: number; endSeconds: number }`
  - `blockRanges(durations: number[]): Range[]` — duração real de cada bloco acumulada.
  - `cutRange(ranges: Range[], cut: { start: number; end: number }): Range` — do início do bloco `start` ao fim do bloco `end` (1-based).
  - `missingBlocks(blockIds: string[], recorded: Set<string>): string[]`
  - `targetBitrates(durationSeconds: number, maxBytes: number): { videoKbps: number; audioKbps: 96 }` — reduz o vídeo até caber em `maxBytes`; devolve `videoKbps: 1800` quando já cabe.
- Produces (`render.ts`): `renderProject(ctx: { db; job: Job; workdir: string }): Promise<void>`.

- [ ] **Step 1: Testes de `plan.test.ts` que falham**: `blockRanges([3, 2, 5])` → `[{0,3},{3,5},{5,10}]`; `cutRange(ranges, {start:2,end:3})` → `{3,10}`; `missingBlocks(["a","b"], new Set(["a"]))` → `["b"]`; `targetBitrates(60, 50e6).videoKbps === 1800` e `targetBitrates(400, 50e6).videoKbps < 1800` com `(videoKbps+96)*400/8*1000 <= 50e6`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3:** implementar `plan.ts`. **Step 4:** rodar → PASS.
- [ ] **Step 5: Teste de `render.test.ts` que falha**: com três clipes sintéticos (2 s, 3 s, 2 s, cores diferentes, tons diferentes) e dois cortes (`1–2` e `3–3`), `renderProject` contra o Supabase local gera `exports` `final` (7 s, 1080×1920), `cut` #1 (≈5 s) e #2 (≈2 s), duas `cover` (JPEG 1080×1920), todos ≤ 50 MB; o job termina `done` e o projeto fica `pronto`. Um segundo teste: bloco sem gravação → job `failed` com os ids dos blocos no `error`, sem ffmpeg rodado.
- [ ] **Step 6: Implementar `renderProject`** na ordem: conferir `missingBlocks` → baixar → normalizar cada gravação (`scale`+`pad` para 1080×1920, `fps=30`, `loudnorm`, libx264 `-preset veryfast`, aac) → concatenar (demuxer `concat`) → `final.mp4` → um corte por `cutRange` (reencodar para cortar exato) → capa por corte (`ffmpeg -ss <início+1s> -frames:v 1`, título com `drawtext`; fonte do repositório em `worker/assets/`) → conferir tamanho com `targetBitrates` e reencodar se passar de 50 MB → subir → gravar `exports` (`expires_at = expiresAt(now)`), substituindo as linhas anteriores e apagando os arquivos antigos só no fim → projeto `pronto`. Chamar `progress` em cada etapa com os rótulos de `STEP_LABELS`.
- [ ] **Step 7: Rodar** `cd worker && npx vitest run` fora do sandbox → PASS.
- [ ] **Step 8: Commit**

```bash
git add worker/src worker/test worker/assets
git commit -m "feat(worker): render final video, cuts and covers from block recordings"
```

---

### Task 5: Tela de entrega — vídeos, downloads e descrições

**Files:**
- Create: `src/app/(app)/projetos/[id]/entrega/CutCard.tsx`, `src/app/(app)/projetos/[id]/entrega/actions.ts`
- Modify: `src/app/(app)/projetos/[id]/entrega/page.tsx`, `src/lib/delivery/db.ts`
- Test: `tests/unit/delivery-urls.test.ts`, `e2e/entrega.spec.ts`

**Interfaces:**
- Consumes: `DeliveryDb.exportsOf`, `daysLeft`, `projects.cuts`.
- Produces: `signedUrl(projectId: string, exportId: string): Promise<{ url: string } | { error: string }>` (ação de servidor; 5 min; só se o `export` for do usuário e do projeto); `CutCard` com player, **Baixar**, **Copiar descrição** por plataforma (`Descriptions` de `src/lib/script/cuts.ts`) e aviso "Some em N dias" quando `daysLeft <= WARN_DAYS`.

- [ ] **Step 1: Teste que falha** (`delivery-urls.test.ts`, fakes): `signedUrl` com `exportId` de outro usuário devolve `{ error: "Arquivo não encontrado." }`; com o certo devolve URL com expiração de 300 s.
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar ação e `CutCard`; a página lista final + cortes na ordem de `cuts`, com capa. **Step 4:** rodar → PASS.
- [ ] **Step 5: E2E** (extensão de `entrega.spec.ts`, `exports` inseridos pelo teste com arquivos pequenos): vê o vídeo final e 2 cortes; "Copiar descrição" coloca o texto no clipboard; projeto com `expires_at` em 3 dias mostra o aviso.
- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/projetos/[id]/entrega" src/lib/delivery tests/unit/delivery-urls.test.ts e2e/entrega.spec.ts
git commit -m "feat(delivery): delivery screen with downloads and descriptions"
```

---

### Task 6: Take único — transcrição com tempos e alinhamento

**Files:**
- Create: `worker/src/align.ts`, `src/app/api/internal/transcribe/route.ts`
- Modify: `src/lib/ai/index.ts` e `src/lib/ai/openrouter.ts` (novo `transcribeWords`), `src/lib/ai/mock.ts`, `worker/src/render.ts`
- Test: `worker/test/align.test.ts`, `tests/unit/transcribe-route.test.ts`

**Interfaces:**
- Produces:
  - `UserAi.transcribeWords(file: Buffer, filename: string): Promise<{ words: { w: string; s: number; e: number }[]; seconds: number }>`
  - `POST /api/internal/transcribe` — corpo `{ jobId }`, cabeçalho `Authorization: Bearer ${WORKER_SECRET}`; o servidor lê o áudio do bucket, usa `withUserAi(job.user_id)`, grava em `transcripts` e devolve `{ words }`; reaproveita `transcripts` se já existir para a gravação.
  - `alignBlocks(blockTexts: string[], words: { w: string; s: number; e: number }[]): { ranges: Range[]; confidence: number }` — normaliza (minúsculas, sem acentos e sem pontuação), alinha por programação dinâmica (distância de edição por palavra, tolerando palavras faltando/sobrando) e devolve início/fim de cada bloco; `confidence` = fração de palavras do script encontradas.

- [ ] **Step 1: Verificar antes de codar** na documentação do provedor (OpenRouter/OpenAI) se a transcrição devolve tempo por palavra (`timestamp_granularities=["word"]`, formato `verbose_json`). Se **não** houver, parar e perguntar ao usuário: alternativa é alinhar por pausas do áudio (`silencedetect`) distribuindo pelo tamanho do texto, com menos precisão. Registrar a decisão no spec.
- [ ] **Step 2: Testes de `align.test.ts` que falham**: dois blocos "Olá, mundo!" e "Tudo bem com você?" com palavras faladas idênticas → `ranges` batem com os tempos e `confidence = 1`; fala com uma palavra a menos e uma a mais ainda alinha (`confidence > 0.8`); acentos e maiúsculas diferentes ("OLA mundo") alinham; texto totalmente diferente → `confidence < 0.3`.
- [ ] **Step 3:** rodar → FAIL; implementar `align.ts`; rodar → PASS.
- [ ] **Step 4: Teste da rota** (`transcribe-route.test.ts`): sem o segredo → 401; com `jobId` de job inexistente → 404; `AI_MOCK=1` devolve palavras do mock e grava `transcripts`; segunda chamada não chama a IA de novo.
- [ ] **Step 5: Implementar a rota e `transcribeWords`** (mock devolve tempos fixos; a chamada real entra na conta do usuário como a transcrição atual e é registrada em `ai_usage`).
- [ ] **Step 6: Ligar em `render.ts`:** quando a gravação é `take`, extrair o áudio (mp3 mono 32 kbps, ≤ 25 MB), chamar a rota, usar `alignBlocks` no lugar de `blockRanges`; `confidence < 0.7` grava aviso `"Confira o início e o fim dos cortes."` em `jobs.error` com status `done`, e a tela mostra o aviso. Teste de render com take sintético e transcrição falsa injetada → cortes nos tempos esperados.
- [ ] **Step 7: Commit**

```bash
git add worker/src worker/test src/lib/ai src/app/api/internal/transcribe tests/unit/transcribe-route.test.ts
git commit -m "feat(delivery): take transcription and script alignment"
```

---

### Task 7: .zip e descrições

**Files:**
- Create: `src/app/(app)/projetos/[id]/entrega/zip/route.ts`, `src/lib/delivery/zip.ts`
- Modify: `CutCard.tsx` / `page.tsx` (botão "Baixar tudo (.zip)")
- Test: `tests/unit/delivery-zip.test.ts`

**Interfaces:**
- Produces: `descriptionsText(cuts: Cut[], platforms: Platform[]): string` (um bloco por corte e por plataforma, título e descrição); `buildZip(files: { name: string; data: Uint8Array }[], descriptions: string): Promise<Uint8Array>` com `jszip` (`compression: "STORE"`); `GET /projetos/[id]/entrega/zip` → `application/zip`, 401/404 para projeto alheio.

- [ ] **Step 1: Testes que falham**: `buildZip` com 2 arquivos e descrições contém `final.mp4`, `corte-01.mp4` e `descricoes.txt` (abrir o resultado com `JSZip.loadAsync`); com **zero cortes** devolve só `final.mp4` e `descricoes.txt` (vazio com aviso "Sem cortes").
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar. Nota de memória: o zip é montado em memória (poucos vídeos de até 50 MB); se passar de 4 arquivos grandes, o botão vira lista de downloads individuais e a rota devolve 413 com mensagem.
- [ ] **Step 4:** rodar → PASS. **Step 5: Teste da rota** com dois usuários: o dono baixa o zip; o outro recebe 404.
- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/projetos/[id]/entrega" src/lib/delivery/zip.ts tests/unit/delivery-zip.test.ts
git commit -m "feat(delivery): zip download with descriptions"
```

**Registro (feito):** `zip.ts` (`descriptionsText`, `buildZip`, `zipFor`), `DeliveryDb.download`, rota `entrega/zip/route.ts` (resposta em stream; 401 sem login, 404 projeto alheio, 413 acima de 200 MB), `ZipButton` na página. Testes: `delivery-zip.test.ts` (unit), integração com dois usuários (RLS real), e2e baixa o .zip e confere o conteúdo. Corrigido o flaky de `e2e/cortes.spec.ts` (espera "Marcar à mão" habilitado antes do título). `e2e/entrevista.spec.ts:29`: 13/13 passes em servidor de teste limpo; a causa provável era um `next start` velho na porta 3100 (sem `AI_MOCK`) — não reproduzido. **A confirmar na Vercel:** resposta em stream passa do teto de 4,5 MB; testar com arquivo real na Task 10.

---

### Task 8: Ajustar início e fim de um corte (`recut`)

**Files:**
- Create: `src/app/(app)/projetos/[id]/entrega/AdjustCut.tsx`, `worker/src/recut.ts`
- Modify: `src/lib/delivery/actions.ts`, `src/lib/delivery/service.ts`, `worker/src/main.ts`
- Test: `tests/unit/delivery-recut.test.ts`, `worker/test/recut.test.ts`, `e2e/entrega.spec.ts`

**Interfaces:**
- Produces: `recutWith(db, projectId, cutId, startSeconds, endSeconds): Promise<{ jobId: string }>` — valida `0 <= start < end <= duração do final`, corte mínimo de 1 s e máximo de 180 s, passo de 0,1 s (`MSG_BAD_RANGE = "Início e fim do corte não são válidos."`); `recutCut(ctx): Promise<void>` no worker (refaz `cut` e `cover` daquele corte a partir de `final.mp4`; guarda `start_seconds`/`end_seconds` no `exports`).

- [ ] **Step 1: Testes que falham**: `recutWith` recusa `start >= end`, `end` acima da duração, corte de 0,5 s; aceita 12,3–40,0. No worker, `recutCut` sobre um `final.mp4` sintético de 10 s com 2–6 s gera `cut` de 4 s (±0,1).
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar. **Step 4:** rodar → PASS.
- [ ] **Step 5: UI `AdjustCut`:** player do vídeo final com dois campos (início/fim em segundos, passo 0,1), botão "Usar estes tempos" → cria o job `recut`; enquanto roda, o card mostra o progresso.
- [ ] **Step 6: E2E:** ajusta o corte 1 e vê o job `recut` na fila.
- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/projetos/[id]/entrega" src/lib/delivery worker/src worker/test tests/unit/delivery-recut.test.ts e2e/entrega.spec.ts
git commit -m "feat(delivery): manual cut adjustment"
```

**Registro (feito):** `recutWith` (service), ação `recutCut`, `worker/src/recut.ts` (refaz `cut` e `cover` a partir do `final.mp4`, grava `start_seconds`/`end_seconds`, troca só os arquivos daquele corte), `AdjustCut` dentro do `CutCard`. `JobView` ganhou `kind`; `ExportRow` ganhou `startSeconds`/`endSeconds` (opcionais). Durante um `recut` a tela mantém os vídeos e mostra o andamento; recut que falha mostra o erro. Testes: `delivery-recut.test.ts`, `worker/test/recut.test.ts` (final sintético de 10 s, 2–6 s → corte de 4 s), e2e (tempo inválido recusado; tempos certos criam o pedido `recut`). **Para a Task 9:** "Gerar de novo" refaz tudo e **perde os ajustes manuais** dos cortes (os tempos só ficam em `exports`, não em `projects.cuts`) — avisar o usuário na tela antes de confirmar.

---

### Task 9: Gerar de novo e limpeza de 30 dias

**Files:**
- Modify: `src/app/(app)/projetos/[id]/entrega/page.tsx`, `src/lib/delivery/service.ts`, `supabase/migrations/0011_jobs_exports.sql` (só se a Task 1 ainda não foi aplicada em produção; senão, criar `0012_delivery_cleanup.sql`)
- Create: `worker/src/purge.ts`
- Test: `tests/unit/delivery-service.test.ts`, `tests/integration/delivery.test.ts`

**Interfaces:**
- Produces: `needsRegeneration(lastExportAt: Date | null, recordingsMaxAt: Date | null, scriptStale: boolean): boolean`; `purgeExpired(db): Promise<number>` (chama `purge_expired_exports`, apaga os arquivos do bucket, devolve quantos).

- [ ] **Step 1: Testes que falham**: `needsRegeneration` é `true` quando a gravação mais nova é depois do último export ou o script está desatualizado, `false` caso contrário; integração: `purgeExpired` com um export vencido e um válido apaga só o vencido e o arquivo.
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar; a página mostra "Suas gravações mudaram. Gerar de novo" no lugar do botão normal.
- [ ] **Step 4:** rodar → PASS. **Step 5:** `purgeExpired` roda no começo de cada ciclo do worker (uma vez por hora no máximo).
- [ ] **Step 6: Commit**

```bash
git add src/lib/delivery "src/app/(app)/projetos/[id]/entrega" worker/src tests
git commit -m "feat(delivery): regenerate and 30-day cleanup"
```

---

### Task 10: Fly.io, produção e teste real

**Files:**
- Create: `worker/fly.toml`
- Modify: `worker/README.md`, `.env.example` **não** (documentar variáveis só no README do worker)

**Interfaces:**
- Consumes: tudo acima. Variáveis: no Fly `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_SECRET`, `APP_URL`; na Vercel `FLY_API_TOKEN`, `FLY_APP`, `WORKER_SECRET`.

- [ ] **Step 1: Pedir ao usuário** (botões): criar a conta no Fly, instalar `flyctl`, rodar `fly auth login` e `fly apps create`. Não fazer nada na conta dele sem o sim.
- [ ] **Step 2: `fly.toml`:** `auto_stop_machines = "stop"`, `auto_start_machines = true`, `min_machines_running = 0`, máquina `shared-cpu-2x` com 1 GB; sem porta pública (o worker só faz chamadas de saída).
- [ ] **Step 3: Migração em produção:** `npx supabase db push --dry-run`, mostrar o SQL ao usuário, esperar o sim, só então `db push`. Depois agendar `purge_expired_exports` (diário) pelo painel/`pg_cron` com o sim.
- [ ] **Step 4: Deploy do worker** (`fly deploy`, `fly secrets set ...`) com o sim; variáveis na Vercel com o sim.
- [ ] **Step 5: Teste real com o usuário:** gravar por blocos no celular, aprovar, "Gerar vídeos", baixar um corte e o zip; repetir com take único e conferir o aviso de alinhamento.
- [ ] **Step 6: Commit**

```bash
git add worker/fly.toml worker/README.md
git commit -m "chore(worker): fly.toml and deploy notes"
```

---

## Self-review

- **Cobertura do spec:** fluxo (T2), dados e limpeza (T1, T9), worker por blocos (T3–T4), take com transcrição (T6), entrega e downloads (T5), zip (T7), ajuste manual (T8), Fly/custos/segredos (T10), erros de borda (Review Focus + T4, T9).
- **Desvio do spec:** o zip usa `jszip` (já instalado) em vez de montar à mão; a rota de transcrição interna é nova porque as chaves de IA do usuário vivem no Next.
- **Risco aberto:** tempos por palavra na transcrição (T6 passo 1 decide antes de codar).
