# Plano 1 — Do material ao script (Video Facil) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA onde o usuário entra, cadastra o perfil, cria um projeto a partir de qualquer material, responde a entrevista e recebe um script editável em blocos com cortes, títulos e descrições por plataforma.

**Architecture:** Next.js (App Router, TypeScript) com Supabase (Auth, Postgres com RLS, Storage). Toda chamada de IA roda no servidor, atrás de uma camada `src/lib/ai/` com um provedor falso (`AI_MOCK=1`) usado nos testes e2e. Regras de negócio determinísticas (cortes, durações) ficam em módulos puros testados com Vitest.

**Tech Stack:** Next.js 15, TypeScript, CSS Modules + tokens de `DESIGN.md` em CSS custom properties, `next/font` (Bricolage Grotesque, Hanken Grotesk), `lucide-react`, `@supabase/ssr`, `zod`, `openai`, `@anthropic-ai/sdk`, SDK JS do TypeSafe, `mammoth`, `jszip`, `unpdf`, Vitest, Playwright, Supabase CLI (stack local).

**Spec:** [docs/spec.md](../../spec.md) · fluxo: [docs/ux-flows/UX-FLOWS.md](../../ux-flows/UX-FLOWS.md) · visual: [DESIGN.md](../../../DESIGN.md), referência renderizada [design/telas.html](../../../design/telas.html) · produto: [PRODUCT.md](../../../PRODUCT.md)

**Fora deste plano:** teleprompter/gravação/upload de vídeo (Plano 2); worker ffmpeg, transcrição com timestamps, cortes, capas, pasta, .zip, retenção de 30 dias (Plano 3). O botão "Gravar" do script leva a `/projetos/[id]/gravar`, que neste plano mostra só "Em breve".

## Global Constraints

- Interface 100% em pt-BR; script gerado no idioma do texto-fonte.
- Chaves de API (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) só no servidor; nunca em `NEXT_PUBLIC_*`.
- Modelos: texto = `gpt-6-luna` (OpenAI); OCR = `claude-haiku-5-5` (Anthropic); julgamentos = `jev-latest` (TypeSafe); transcrição = modelo de transcrição da OpenAI lido de `OPENAI_TRANSCRIBE_MODEL` (confirmar nome e preço atuais na doc da OpenAI na Tarefa 5).
- Limite grátis: 5 projetos por mês-calendário e 60 minutos de transcrição por mês, por usuário.
- Ritmo de fala: 150 palavras/minuto.
- Durações do vídeo principal: 30, 60, 180, 300, 600 segundos. Durações de corte: 10, 20, 30, 60 segundos; corte permitido só se `corte ≤ principal / 2`.
- Plataformas: `youtube`, `reels`, `feed_instagram`, `facebook`, `tiktok`, `x`.
- Visual segue `DESIGN.md`: primária `#E11D55` só para a ação principal da tela; cores vivas (tangerina, céu, menta, sol) só codificam cortes, na ordem fixa; texto sobre cor viva em tinta, nunca branco; texto mínimo 12px; tempos com `font-variant-numeric: tabular-nums`; ícones Lucide com traço 2.
- Mobile-first, alvo 390px; alvos de toque ≥ 44px; ação principal no terço inferior.
- Commits terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Foto ilegível (escura, tremida, sem texto):** o OCR retorna pouco ou nada → o usuário vê "Não consegui ler esta foto. Tente com mais luz e a página inteira no quadro." e o projeto não é criado com texto vazio. (Teste na Tarefa 6.)
2. **PDF ou documento enorme (ex.: livro de 300 páginas):** texto extraído acima de 60.000 caracteres → é cortado em 60.000, e a tela de texto-fonte avisa "Usamos só o início do arquivo (60 mil caracteres)". (Teste na Tarefa 6.)
3. **Áudio acima de 25 MB ou acima da cota de minutos:** recusado antes de chamar a OpenAI, com mensagem que diz o limite. (Teste na Tarefa 6.)
4. **Texto-fonte curto para a duração escolhida (ex.: 80 palavras com 10 min):** as opções de duração acima de `palavras / 150 × 60 × 2` segundos ficam desabilitadas, com o motivo "Seu texto rende até ~X". (Teste na Tarefa 4 e e2e na Tarefa 8.)
5. **Toque duplo em "Próxima" / voltar pelo navegador na entrevista:** salvar a resposta é idempotente (PATCH por chave do passo), e o passo atual vem da URL, não de estado em memória. (Teste na Tarefa 8.)

---

## Estrutura de arquivos

```
src/
  app/
    layout.tsx, globals.css, manifest.ts
    (auth)/entrar/page.tsx, auth/callback/route.ts
    (app)/layout.tsx                      # abas: Projetos · Novo · Perfil
    (app)/projetos/page.tsx
    (app)/perfil/page.tsx
    (app)/boas-vindas/[passo]/page.tsx    # onboarding: nicho | tom | ctas
    (app)/novo/page.tsx
    (app)/projetos/[id]/fonte/page.tsx
    (app)/projetos/[id]/entrevista/[passo]/page.tsx
    (app)/projetos/[id]/script/page.tsx
    (app)/projetos/[id]/gravar/page.tsx   # "Em breve" (Plano 2)
    api/projects/route.ts                 # POST cria projeto + extrai texto
  components/ui/                          # Button, Chip, OptionCard, Sheet, ProgressSteps, Toast
  lib/
    rules/cuts.ts, rules/duration.ts
    ai/index.ts, ai/openai.ts, ai/anthropic.ts, ai/typesafe.ts, ai/mock.ts, ai/schemas.ts
    ingest/{text,docx,pptx,pdf,gdocs,image,audio,index}.ts
    supabase/{server,client,admin}.ts
    usage.ts
    interview/steps.ts, interview/actions.ts
    script/generate.ts, script/actions.ts
supabase/migrations/0001_init.sql
tests/unit/**, tests/fixtures/**, e2e/**
```

---

### Tarefa 1: Scaffold, tokens visuais e PWA

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/manifest.ts`, `src/app/page.tsx`
- Create: `src/components/ui/Button.tsx`, `Button.module.css`
- Test: `tests/unit/sanity.test.ts`, `e2e/smoke.spec.ts`

**Interfaces:**
- Produces: `<Button variant="primary"|"soft" icon?: LucideIcon>`; CSS custom properties com os nomes de token do `DESIGN.md` (`--primary`, `--ink`, `--surface`, `--cut-1`…`--cut-4` = tangerina, céu, menta, sol, `--rec-bg`, raios e sombras); fontes `--display` e `--ui` via `next/font/google` (auto-hospedadas no build).

- [ ] **Step 1:** `git init`; criar app Next.js 15 (TypeScript, App Router, `src/`, sem Tailwind); instalar Vitest e Playwright.
- [ ] **Step 2: Teste e2e que falha** — `e2e/smoke.spec.ts`: abre `/`, espera `document.documentElement.lang === "pt-BR"` e o botão "Começar" com a cor computada `rgb(225, 29, 85)`.
- [ ] **Step 3:** rodar `npx playwright test e2e/smoke.spec.ts` → FAIL.
- [ ] **Step 4:** copiar os tokens do frontmatter de `DESIGN.md` para `globals.css`; `layout.tsx` com `lang="pt-BR"` e as duas fontes; `manifest.ts` (`name: "Video Facil"`, `display: "standalone"`, `theme_color: "#E11D55"`, `background_color: "#FFFFFF"`, ícones 192/512); `page.tsx` com um `<Button variant="primary">Começar</Button>` que linka para `/entrar`.
- [ ] **Step 5:** `npx playwright test e2e/smoke.spec.ts` → PASS; `npx vitest run` → PASS.
- [ ] **Step 6: Commit** `chore: scaffold Next.js PWA with design tokens`

---

### Tarefa 2: Banco, RLS e tipos

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/0001_init.sql`, `src/lib/supabase/{server,client,admin}.ts`, `src/lib/supabase/types.ts` (gerado)
- Test: `tests/integration/rls.test.ts`

**Interfaces:**
- Produces (tabelas, todas com `user_id uuid references auth.users` e RLS `user_id = auth.uid()` para select/insert/update/delete):
  - `profiles(user_id pk, niche text, audience text, tone text, phrases text, onboarded boolean default false)`
  - `ctas(id, user_id, kind text check in ('link','bio','whatsapp','phone'), label text, value text)`
  - `series(id, user_id, title text, created_at)`
  - `projects(id, user_id, series_id null, episode_index int null, title text, source_kind text, source_text text, source_truncated boolean default false, interview jsonb default '{}', status text check in ('fonte','entrevista','script','gravacao','pronto') default 'fonte', descriptions jsonb default '{}', created_at)`
  - `script_blocks(id, project_id fk on delete cascade, user_id, position int, kind text check in ('opening','bridge','cut','closing'), text text, cut_index int null, cut_title text null, descriptions jsonb default '{}', cover_prompt text null, unique(project_id, position))`
  - `usage_months(user_id, month date, projects int default 0, transcription_seconds int default 0, primary key(user_id, month))`
  - Bucket de storage `sources` privado; política: objeto em `{auth.uid()}/...`.
  - Função `consume_usage(p_projects int, p_seconds int) returns boolean` (security definer, `user_id = auth.uid()`): incrementa `usage_months` do mês corrente só se o resultado ficar ≤ 5 projetos e ≤ 3600 s; retorna `false` sem alterar nada caso contrário. Atômica (`insert … on conflict … do update … where`).
- `createServerClient()` (cookies, `@supabase/ssr`), `createBrowserClient()`, `createAdminClient()` (service role, só servidor).

- [ ] **Step 1: Teste que falha** — `rls.test.ts` (contra `supabase start` local): usuário A cria projeto; usuário B não o vê em `select` e falha em `update`; `consume_usage(1,0)` retorna `true` 5 vezes e `false` na 6ª, com `usage_months.projects = 5`.
- [ ] **Step 2:** `npx vitest run tests/integration/rls.test.ts` → FAIL.
- [ ] **Step 3:** escrever `0001_init.sql`; `supabase db reset`; gerar `types.ts` com `supabase gen types typescript --local`.
- [ ] **Step 4:** teste → PASS.
- [ ] **Step 5: Commit** `feat(db): schema, RLS and monthly usage quota`

---

### Tarefa 3: Login, onboarding e perfil

**Files:**
- Create: `src/app/(auth)/entrar/page.tsx`, `src/app/auth/callback/route.ts`, `src/middleware.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/boas-vindas/[passo]/page.tsx`, `src/app/(app)/perfil/page.tsx`, `src/lib/profile/actions.ts`
- Create: `src/components/ui/{Chip,TabBar}.tsx` (+ `.module.css`)
- Test: `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: clientes da Tarefa 2.
- Produces: `saveProfile(input: { niche?: string; audience?: string; tone?: Tone; phrases?: string; onboarded?: boolean }): Promise<void>`; `saveCtas(ctas: { kind: CtaKind; label: string; value: string }[]): Promise<void>`; `type Tone = 'serio'|'descontraido'|'pastoral'|'tecnico'|'motivacional'|'didatico'`; `type CtaKind = 'link'|'bio'|'whatsapp'|'phone'`. Middleware: rotas de `(app)` exigem sessão (sem sessão → `/entrar`); perfil com `onboarded=false` → `/boas-vindas/nicho`.

- [ ] **Step 1: Teste e2e que falha** — `auth.spec.ts`: em `/entrar`, digita e-mail, clica "Receber link de acesso"; o teste lê o link no Mailpit local (`http://127.0.0.1:54324/api/v1/messages`), abre o link e cai em `/boas-vindas/nicho`; preenche nicho → "Continuar"; escolhe tom "Descontraído" → "Continuar"; WhatsApp `11999990000` → "Concluir" → `/projetos`. Em `/perfil` aparecem "Descontraído" e "CTAs salvos (1)". Segundo caso: "Pular por agora" no passo 1 leva a `/projetos` e o próximo login não volta ao onboarding.
- [ ] **Step 2:** `npx playwright test e2e/auth.spec.ts` → FAIL.
- [ ] **Step 3:** implementar as telas seguindo `docs/ux-flows/wireframes/{boas-vindas,onboarding-*,perfil}.html` no visual do `DESIGN.md`; o botão Google chama `signInWithOAuth({ provider: 'google' })` (exercitado só manualmente; o provedor Google fica configurado no painel do Supabase); a TabBar de 3 abas segue `design/telas.html`.
- [ ] **Step 4:** teste → PASS.
- [ ] **Step 5: Commit** `feat(auth): magic link, onboarding and profile`

---

### Tarefa 4: Regras de duração e cortes

**Files:**
- Create: `src/lib/rules/duration.ts`, `src/lib/rules/cuts.ts`
- Test: `tests/unit/rules.test.ts`

**Interfaces:**
- Produces:
  - `WORDS_PER_MINUTE = 150`; `MAIN_DURATIONS = [30, 60, 180, 300, 600] as const`; `CUT_DURATIONS = [10, 20, 30, 60] as const`
  - `estimateSeconds(text: string): number` → `Math.round(palavras / 150 * 60)`
  - `targetWords(seconds: number): number` → `Math.round(seconds * 150 / 60)`
  - `maxMainSecondsForSource(sourceText: string): number` → `estimateSeconds(sourceText) * 2`
  - `mainDurationOptions(sourceText: string): { seconds: number; enabled: boolean; reason?: string }[]`
  - `allowedCutDurations(mainSeconds: number): number[]` → filtra `CUT_DURATIONS` com `d ≤ mainSeconds / 2`
  - `estimateCutCount(mainSeconds: number, cutSeconds: number): number` → `Math.max(1, Math.floor(mainSeconds * 0.85 / cutSeconds))`
  - `suggestCutDuration(mainSeconds: number, platforms: Platform[]): number | null` → 30 se permitido e alguma plataforma ∈ {reels, tiktok, feed_instagram}; senão o maior permitido; `null` se nenhum.
  - `type Platform = 'youtube'|'reels'|'feed_instagram'|'facebook'|'tiktok'|'x'`

- [ ] **Step 1: Teste que falha** — `rules.test.ts`:
  - `allowedCutDurations(60)` → `[10, 20, 30]`; `allowedCutDurations(30)` → `[10]`; `allowedCutDurations(180)` → `[10, 20, 30, 60]`
  - `estimateSeconds("palavra ".repeat(150))` → `60`; `targetWords(180)` → `450`
  - `estimateCutCount(180, 30)` → `5`; `estimateCutCount(180, 10)` → `15`
  - `suggestCutDuration(180, ['tiktok'])` → `30`; `suggestCutDuration(180, ['youtube'])` → `60`; `suggestCutDuration(30, ['youtube'])` → `10`
  - Review Focus 4: `mainDurationOptions("palavra ".repeat(80))` → itens com 30 e 60 `enabled`, 180/300/600 `enabled: false` com `reason` contendo `"~1 min"`.
- [ ] **Step 2:** `npx vitest run tests/unit/rules.test.ts` → FAIL.
- [ ] **Step 3:** implementar. `reason` = `"Seu texto rende até ~" + minutos arredondados + " min"`.
- [ ] **Step 4:** teste → PASS.
- [ ] **Step 5: Commit** `feat(rules): duration and cut-length rules`

---

### Tarefa 5: Camada de IA com provedor falso

**Files:**
- Create: `src/lib/ai/{index,schemas,openai,anthropic,typesafe,mock}.ts`
- Test: `tests/unit/ai.test.ts`

**Interfaces:**
- Produces (todas `async`, servidor apenas, escolhem `mock.ts` quando `process.env.AI_MOCK === '1'`):
  - `ocrImages(images: { data: Buffer; mediaType: string }[]): Promise<string>` — `claude-haiku-5-5`; uma chamada com todas as imagens em ordem; instrução: transcrever o texto da página fielmente, sem comentar; retornar `""` se não houver texto legível.
  - `ocrPdf(pdf: Buffer): Promise<string>` — `claude-haiku-5-5` com bloco de documento PDF.
  - `transcribeAudio(file: Buffer, filename: string): Promise<{ text: string; seconds: number }>` — modelo de `OPENAI_TRANSCRIBE_MODEL`.
  - `generateJson<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T>` — `gpt-6-luna` com saída estruturada (JSON Schema derivado do zod); valida com zod; uma nova tentativa se a validação falhar, depois lança `AiError`.
  - `scoreViral(titles: string[], context: string): Promise<number[]>` — jev, uma pergunta `Score` por título, em paralelo; retorna nota 0..1 na mesma ordem.
  - `checkScript(text: string, opts: { tone: string; cta?: string }): Promise<{ toneOk: number; ctaPresent: number | null }>` — jev, perguntas `Noul`; `ctaPresent` é `null` quando não há CTA.
  - `class AiError extends Error { userMessage: string }`
- Antes de escrever `typesafe.ts`, carregar a skill `typesafe:typesafe-ai` e ler `https://docs.typesafe.ai/sdk/javascript/api` para o nome do pacote npm e as formas de `Score`/`Noul`. Antes de `transcribeAudio`, confirmar na doc da OpenAI o nome atual do modelo de transcrição com timestamps por palavra (o Plano 3 precisa disso) e gravar em `.env.example`.

- [ ] **Step 1: Teste que falha** — `ai.test.ts` com `AI_MOCK=1`: `generateJson(z.object({ a: z.number() }), "s", "u")` devolve o objeto do fixture do mock; `scoreViral(["a","b"], "c")` devolve um array com 2 números entre 0 e 1; com o mock forçado a devolver JSON inválido duas vezes, `generateJson` lança `AiError`.
- [ ] **Step 2:** `npx vitest run tests/unit/ai.test.ts` → FAIL.
- [ ] **Step 3:** implementar; o mock lê respostas de `tests/fixtures/ai/*.json` indexadas pelo nome da função.
- [ ] **Step 4:** teste → PASS. Rodar uma chamada real de cada função uma vez, manualmente, com as chaves reais (`npx tsx scripts/ai-smoke.ts`), e anotar no PR que passou.
- [ ] **Step 5: Commit** `feat(ai): provider layer with mock`

---

### Tarefa 6: Ingestão de material e criação de projeto

**Files:**
- Create: `src/lib/ingest/{index,text,docx,pptx,pdf,gdocs,image,audio}.ts`, `src/lib/usage.ts`, `src/app/api/projects/route.ts`
- Create fixtures: `tests/fixtures/ingest/{sample.docx,sample.pptx,sample-text.pdf,sample-scanned.pdf,page.jpg,blank.jpg,ideia.mp3}`
- Test: `tests/unit/ingest.test.ts`, `tests/integration/create-project.test.ts`

**Interfaces:**
- Consumes: `ocrImages`, `ocrPdf`, `transcribeAudio` (Tarefa 5); `consume_usage` (Tarefa 2).
- Produces:
  - `type SourceKind = 'text'|'images'|'pdf'|'docx'|'pptx'|'txt'|'gdocs'|'audio'`
  - `extractText(input: { kind: SourceKind; files?: File[]; text?: string; url?: string }): Promise<{ text: string; truncated: boolean; audioSeconds?: number }>`
  - `MAX_SOURCE_CHARS = 60_000`; `MAX_AUDIO_BYTES = 25 * 1024 * 1024`
  - `POST /api/projects` (multipart: `kind`, `files[]`, `text`, `url`) → `201 { id }` | `402 { error }` (cota) | `422 { error }` (extração). Ordem: validar tamanho → `consume_usage(1, audioSeconds?)` → extrair → inserir `projects` com `status='fonte'`. Se a extração falhar depois do consumo, devolver a cota (`consume_usage(-1, -seconds)`).
- Regras por tipo: `docx` → `mammoth.extractRawText`; `pptx` → `jszip`, ler `ppt/slides/slide{n}.xml` em ordem numérica e juntar os `<a:t>`; `pdf` → `unpdf`; se der < 200 caracteres por página em média → `ocrPdf`; `gdocs` → extrair o id de `docs.google.com/document/d/{id}` e buscar `https://docs.google.com/document/d/{id}/export?format=txt`; resposta não-200 ou HTML de login → erro "Esse documento não está público. No Google Docs, use Compartilhar → Qualquer pessoa com o link."; `images` → `ocrImages`; resultado com < 20 caracteres → erro de foto ilegível (Review Focus 1).

- [ ] **Step 1: Testes que falham** — `ingest.test.ts` (com `AI_MOCK=1`):
  - docx/pptx/pdf de texto: o texto extraído contém a frase marcadora de cada fixture (`"Marcador docx 123"` etc.); os slides do pptx saem na ordem 1, 2, 10 (não 1, 10, 2).
  - pdf escaneado chama `ocrPdf` (espião do mock).
  - Review Focus 1: `blank.jpg` (mock devolve `""`) → rejeita com mensagem `"Não consegui ler esta foto. Tente com mais luz e a página inteira no quadro."`
  - Review Focus 2: texto de 70.000 caracteres → `text.length === 60000` e `truncated === true`.
  - Review Focus 3: áudio de 26 MB → rejeita com `"Áudio acima de 25 MB"` sem chamar `transcribeAudio`.
  - URL do gdocs sem id → erro "Link do Google Docs inválido".
  - `create-project.test.ts`: 6º POST no mês → `402`; uma extração que falha não consome cota (`usage_months.projects` inalterado).
- [ ] **Step 2:** `npx vitest run tests/unit/ingest.test.ts tests/integration/create-project.test.ts` → FAIL.
- [ ] **Step 3:** implementar. Áudio acima da cota de minutos (com a duração lida do arquivo antes de transcrever) → `402` com "Você usou seus 60 minutos de transcrição deste mês."
- [ ] **Step 4:** testes → PASS.
- [ ] **Step 5: Commit** `feat(ingest): extract text from any source with quota`

---

### Tarefa 7: Telas Projetos, Novo e Texto-fonte

**Files:**
- Create: `src/app/(app)/projetos/page.tsx`, `src/app/(app)/novo/page.tsx`, `src/app/(app)/projetos/[id]/fonte/page.tsx`, `src/components/project/{ProjectRow,SourcePicker}.tsx` (+ css)
- Test: `e2e/novo-projeto.spec.ts`

**Interfaces:**
- Consumes: `POST /api/projects` (Tarefa 6).
- Produces: `nextStepHref(project): string` em `src/lib/project/next-step.ts`, mapeando `status` para a rota da etapa (`fonte` → `/projetos/{id}/fonte`, `entrevista` → `/projetos/{id}/entrevista/{interview.current ?? 'plataformas'}`, `script` → `/projetos/{id}/script`, `gravacao` → `/projetos/{id}/gravar`). A próxima ação de cada linha em Projetos usa essa função.
- Câmera: `<input type="file" accept="image/*" capture="environment" multiple>` (abre a câmera nativa no celular); várias fotos = várias páginas, em ordem, com miniaturas e "Pronto (N páginas)".
- Visual: primeira tela de `design/telas.html` (título "Seus vídeos", painel coral "Novo vídeo" com 5 atalhos, "Continue de onde parou", capa só quando existe, senão placeholder tracejado com o ícone da origem); `Novo` = `docs/ux-flows/wireframes/novo-entrada.html`; `fonte` = textarea editável com contagem de palavras e "dá até ~X min de vídeo" (de `maxMainSecondsForSource`), aviso de truncamento quando `source_truncated`, botão "Continuar" → `status='entrevista'`.

- [ ] **Step 1: Teste e2e que falha** — `novo-projeto.spec.ts` (`AI_MOCK=1`, usuário logado com onboarding feito): Projetos vazio mostra o painel "Novo vídeo"; toca "Texto", cola 300 palavras, "Continuar" → em `/fonte` aparece "300 palavras" e "dá até ~4 min"; edita e "Continuar" → URL `/entrevista/plataformas`; volta a `/projetos` e a linha do projeto mostra "Continuar" apontando para a entrevista. Segundo caso: upload de `sample.docx` cria projeto com o marcador no texto.
- [ ] **Step 2:** `npx playwright test e2e/novo-projeto.spec.ts` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** teste → PASS; captura em 390px comparada visualmente com `design/telas.html` (tela Projetos).
- [ ] **Step 5: Commit** `feat(app): projects list, new project and source review`

---

### Tarefa 8: Entrevista

**Files:**
- Create: `src/lib/interview/steps.ts`, `src/lib/interview/actions.ts`, `src/lib/interview/suggest.ts`, `src/app/(app)/projetos/[id]/entrevista/[passo]/page.tsx`, `src/components/ui/{OptionCard,ProgressSteps}.tsx` (+ css)
- Test: `tests/unit/interview.test.ts`, `e2e/entrevista.spec.ts`

**Interfaces:**
- Consumes: `generateJson`, `scoreViral` (Tarefa 5); regras (Tarefa 4); CTAs (Tarefa 3).
- Produces:
  - `STEPS = ['plataformas','formato','duracao','cortes','cenario','titulos','capa','cta','resumo'] as const` (8 perguntas + resumo; `formato` com série abre a subtela `episodios` antes de `duracao`).
  - `type Interview = { current?: Step; platforms?: Platform[]; format?: 'single'|'series'; episodes?: { title: string; summary: string }[]; mainSeconds?: number; cutSeconds?: number | null; scenery?: { mode: 'natural'|'ai'; natural: string; aiPrompt: string }; titles?: { options: { text: string; score: number }[]; chosen: string }; cover?: 'frame'|'ai'; ctaId?: string | null }`
  - `saveAnswer(projectId: string, step: Step, value: Interview[Step]): Promise<{ next: string }>` — `update projects set interview = interview || {step: value, current: next}`; idempotente: reenviar o mesmo passo com o mesmo valor não muda nada além disso; zera `cutSeconds` se a nova `mainSeconds` o tornar inválido.
  - `suggestInterview(projectId): Promise<InterviewSuggestion>` — uma chamada `generateJson` após o texto-fonte, salva em `interview.suggestion`; sugere plataformas, formato (com episódios se a série fizer sentido), duração (só entre as habilitadas), cenário natural + prompt de IA e capa. A sugestão de corte vem de `suggestCutDuration`, não da IA.
  - `suggestTitles(projectId): Promise<{ text: string; score: number }[]>` — 6 títulos do luna, ranqueados por `scoreViral`, do maior para o menor.
  - `confirmSeries(projectId, episodes): Promise<string[]>` — cria `series` e um projeto por episódio (`episode_index` 1..N, mesmo `source_text`, mesmas respostas até ali); o projeto original vira o episódio 1; consome 1 cota por episódio novo e recusa se não couber, avisando quantos cabem.
- Visual: tela 2 de `design/telas.html` (barra de 8 segmentos + "4/8", pergunta grande, opções em grade com a sugerida já marcada e selo "Sugerido", faixa colorida de cortes por opção, caixa "por quê", "Próxima" fixa embaixo). Opções inválidas aparecem desabilitadas com o motivo. Resumo = `docs/ux-flows/wireframes/entrevista-resumo.html`, cada linha leva de volta ao passo. "Copiar prompt" no cenário usa `navigator.clipboard.writeText` e mostra o toast "Prompt copiado".

- [ ] **Step 1: Testes que falham** — `interview.test.ts`: `saveAnswer` duas vezes com o mesmo valor gera estado idêntico (Review Focus 5); mudar `mainSeconds` de 180 para 30 com `cutSeconds=30` zera `cutSeconds`; `confirmSeries` com 5 episódios e cota restante 2 recusa com "Cabem só 2 episódios este mês". `e2e/entrevista.spec.ts` (`AI_MOCK=1`): percorre os 8 passos só tocando "Próxima" (sugestões aceitas) e chega ao resumo com 8 linhas; no passo `cortes` com vídeo de 60 s, a opção "60 s" está desabilitada; voltar pelo navegador do passo 5 para o 4 mostra a resposta salva marcada; duplo clique em "Próxima" avança só um passo.
- [ ] **Step 2:** rodar os dois → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** testes → PASS.
- [ ] **Step 5: Commit** `feat(interview): guided interview with preselected suggestions`

---

### Tarefa 9: Geração do script e das descrições

**Files:**
- Create: `src/lib/script/generate.ts`, `src/lib/script/prompts.ts`
- Test: `tests/unit/script-generate.test.ts`

**Interfaces:**
- Consumes: `generateJson`, `checkScript` (Tarefa 5); regras (Tarefa 4); `Interview` (Tarefa 8); perfil e CTA.
- Produces:
  - `ScriptSchema` (zod): `{ blocks: { kind: 'opening'|'bridge'|'cut'|'closing'; text: string; cutTitle?: string; descriptions?: Partial<Record<Platform, string>>; coverPrompt?: string }[]; mainDescriptions: Partial<Record<Platform, string>>; mainCoverPrompt: string }`
  - `generateScript(projectId: string): Promise<void>` — monta o prompt com o texto-fonte, o perfil (nicho, público, tom, frases), as respostas e `targetWords(mainSeconds)`; pede `estimateCutCount` blocos `cut` com gancho próprio que funcionem sozinhos; grava `script_blocks` (substituindo os existentes) com `cut_index` 1..N, `projects.descriptions`, `status='script'`.
  - Validação determinística após gerar: cada bloco `cut` com `estimateSeconds(text) ≤ cutSeconds * 1.2`, e total entre 0,8× e 1,2× `mainSeconds`. Se falhar, uma regeneração com o erro no prompt; se falhar de novo, grava assim mesmo e marca `interview.scriptWarning` com o texto do problema.
  - Descrições: uma por plataforma escolhida, para o vídeo principal e para cada corte; com CTA, a última linha da descrição é o CTA formatado (`whatsapp` → `"Chama no WhatsApp: https://wa.me/55{número}"`, `bio` → `"Link na bio: @{valor}"`, `link` → `"{rótulo}: {url}"`, `phone` → `"Ligue: {número}"`), anexado no código, não pela IA.
  - `checkScript` roda no fim; `toneOk < 0.5` ou `ctaPresent < 0.5` viram avisos em `interview.scriptChecks`.

- [ ] **Step 1: Teste que falha** — `script-generate.test.ts` (`AI_MOCK=1`, fixture de script com 5 cortes): `generateScript` grava 5 blocos `cut` com `cut_index` 1..5 e posições contíguas; a descrição de `reels` do corte 2 termina com `"Chama no WhatsApp: https://wa.me/5511999990000"`; com a fixture "corte longo demais" (um corte de 140 palavras para `cutSeconds=30`), chama o mock duas vezes e grava `scriptWarning`; regenerar substitui os blocos sem duplicar (`count = 7`).
- [ ] **Step 2:** `npx vitest run tests/unit/script-generate.test.ts` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** teste → PASS.
- [ ] **Step 5: Commit** `feat(script): generate script blocks and platform descriptions`

---

### Tarefa 10: Tela do script — editar e reescrever

**Files:**
- Create: `src/app/(app)/projetos/[id]/script/page.tsx`, `src/lib/script/actions.ts`, `src/components/script/{ScriptBlock,RewriteSheet}.tsx`, `src/components/ui/{Sheet,Toast}.tsx` (+ css), `src/app/(app)/projetos/[id]/gravar/page.tsx`
- Test: `e2e/script.spec.ts`

**Interfaces:**
- Consumes: `generateScript` (Tarefa 9), `generateJson` (Tarefa 5), `estimateSeconds` (Tarefa 4).
- Produces:
  - `updateBlockText(blockId: string, text: string): Promise<void>` — autosave com debounce de 800 ms no cliente; o chip "Salvo" mostra "Salvando…" enquanto pendente.
  - `rewriteBlock(blockId: string, mode: 'shorter'|'direct'|'emotional'|'hook'|'simpler'|{ custom: string }): Promise<{ text: string }>` — luna reescreve só aquele bloco, mantendo idioma e tom, com o texto vizinho como contexto; para `cut`, respeita `cutSeconds`.
  - `regenerateScript(projectId)` = `generateScript`, com confirmação "Isso substitui o script atual. Continuar?".
- Visual: tela 3 de `design/telas.html` (título, chips de tempo total, cortes e salvo; blocos de corte com borda e etiqueta na cor da sequência `--cut-{(cut_index-1)%4+1}`, duração do bloco calculada ao vivo; "Reescrever" abre o sheet de `docs/ux-flows/wireframes/script-reescrever.html`; "Gravar" fixo embaixo → `/projetos/{id}/gravar`, que mostra "Gravação chega na próxima versão"). Avisos de `scriptWarning` e `scriptChecks` aparecem numa faixa `sky-tint` no topo, com texto em linguagem simples.

- [ ] **Step 1: Teste e2e que falha** — `script.spec.ts` (`AI_MOCK=1`): após a entrevista, `/script` mostra 5 etiquetas "Corte 1"…"Corte 5", e "Corte 1" com fundo `rgb(255, 122, 0)`; editar o texto do Corte 1 e recarregar a página mantém a edição; "Reescrever" → "Mais curto" troca o texto pelo da fixture e a duração do bloco diminui; o total no chip de tempo muda depois da edição.
- [ ] **Step 2:** `npx playwright test e2e/script.spec.ts` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** teste → PASS; rodar a suíte inteira (`npx vitest run && npx playwright test`) → tudo PASS.
- [ ] **Step 5: Commit** `feat(script): edit, autosave and rewrite blocks`

---

## Próximos planos (escritos depois deste executado)

- **Plano 2 — Gravação:** teleprompter (velocidade, fonte, tamanho, cor, opacidade, posição, margem, espelhar, contagem 3-2-1, toque para pausar), take único ou por blocos, `MediaRecorder` com fallback de formato no Safari, upload resumível (tus) para o Storage, prévia e refazer, upload de vídeo externo, tela "Aprovar".
- **Plano 3 — Worker e entrega:** container ffmpeg com fila `jobs`, juntar blocos e normalizar para 9:16, transcrição com timestamps, alinhamento texto↔fala para os cortes no take único, ajuste manual de início e fim, capas (frame + título por plataforma), pasta do projeto, cópia de descrições, .zip, retenção de 30 dias com aviso.
