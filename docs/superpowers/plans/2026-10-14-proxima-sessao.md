# Próxima sessão — Gravaí (retomada)

Cole o bloco abaixo como primeira mensagem da próxima sessão.

```
Continue o Gravaí (pasta Video Facil, branch feat/plano-1, PR https://github.com/RanielLevi12/gravai/pull/2). Fale sempre em pt-BR, curto, para leigo; decisões em botões (AskUserQuestion). Uma tarefa por sessão: faça a TAREFA 1 inteira (com revisão), me mostre, e só então siga.

Produção: a 0006 JÁ foi aplicada pelo Supabase CLI (projeto linkado; histórico reparado, versões 0001–0006 batem com o repositório). Próximas migrações: `npx supabase db push --dry-run`, mostrar, e só então `db push` (com meu sim). O CLI guarda o token no chaveiro: rode sem DBUS_SESSION_BUS_ADDRESS=disabled:.

Estado: o script agora é contínuo (abertura + trechos "body" + fechamento) com botões rápidos (tirar saudação, encurtar, mais simples, mais forte) — commit c8ef177. Migração 0006 (tipo 'body') aplicada no local e em produção. OPENROUTER_DEV_KEY no .env.local vale como conexão só em `next dev`. Leia AGENTS.md (Next.js tem mudanças; consulte node_modules/next/dist/docs/ antes de escrever código).

TAREFA 1 — Sugerir cortes sobre o script contínuo
- Botão "Sugerir cortes" na tela do script: a IA escolhe trechos de blocos consecutivos do MESMO script (usa a duração de corte da entrevista, cutSeconds), cada um com título, prompt de capa e descrição por plataforma (CTA só na descrição, montado no código). Sem saudação própria nem "vídeo novo": o corte é só um recorte.
- Usuário ajusta (mudar início/fim, remover, marcar à mão). Cores/etiquetas "Corte N" voltam só aqui.
- Modelo de dados novo (migração 0007: p.ex. projects.cuts jsonb com blockId inicial/final); não apagar colunas antigas.
- Testes unit + integração + e2e (servidor de teste separado: NEXT_DIST_DIR=.next-e2e AI_MOCK=1 npx next dev -p 3100 e E2E_BASE_URL=http://localhost:3100 npx playwright test; NUNCA rodar e2e contra o servidor da porta 3000, ele usa IA real). Docker/supabase/e2e fora do sandbox; npm_config_cache=$TMPDIR/npm-cache PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright.

TAREFA 2 (sessão seguinte) — Barra de custos
- Faixa fixa no app com saldo do OpenRouter e quanto gastamos (por geração e no mês). Conferir na doc do OpenRouter qual endpoint serve com a chave comum (GET /api/v1/key mostra usage/limit da chave; /api/v1/credits pode exigir management key) e o campo usage.cost das respostas. Guardar custo por chamada no banco (tabela nova, só leitura para o dono).

TAREFA 3 (sessão seguinte) — Usar mais o jev
- Carregar a skill typesafe:typesafe-ai e ler https://docs.typesafe.ai/llms.txt. Hoje o jev faz scoreViral e checkScript (src/lib/ai/typesafe.ts). Candidatos: detectar saudação repetida/vídeo recomeçando, nota de gancho por trecho, escolher melhores cortes. Tudo no servidor (TYPESAFE_API_KEY). Dê timeout (AbortSignal) em cada chamada.

TAREFA 4 — Fechar o projeto
- Pendências: mostrar descrições e capas na tela (adiado do Plano 1), funções sem uso em src/lib/usage.ts (N3), quotaFits devolvendo true em erro (N4), tela Gravar ("Em breve", Plano 2), worker/entrega (Plano 3).
- Antes de qualquer coisa em produção (projeto Supabase dieciotgdpgmxccxjqsy): me mostrar o SQL e esperar meu sim. Produção precisa receber 0006 (e 0007) antes de publicar o código novo. Push também só com meu sim.
- Não mexer em .impeccable/hook.cache.json, PRODUCT.md, AGENTS.md, design/marca/identidade.html; DESIGN.md tem alterações minhas (seção "Marca Gravaí"), nunca commitar. Nunca commitar os device nodes do sandbox na raiz (.bashrc, .gitconfig, .claude/* etc.); git add só por caminho.
```
