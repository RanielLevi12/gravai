# Projetos (pastas com configurações) — plano

Decidido em entrevista (grill-me) em 2026-10-14. Esta é a próxima tarefa, antes de "Sugerir cortes" e da barra de custos.

## Vocabulário
- **Projeto** (na tela) = pasta com configurações. No banco: tabela nova `folders`, para não confundir com a tabela atual `public.projects`, que guarda os **vídeos**.
- **Vídeo** (na tela) = linha de `public.projects`. Pode ser solto (`folder_id` nulo) ou estar num projeto.

## Regras fechadas
1. Projeto tem: nome, cor (uma entre poucas da marca), texto opcional "Sobre este projeto" (entra no prompt da IA) e as configurações padrão.
2. Configurações do projeto: onde publicar, único/série, duração, tamanho do corte, cenário, capa, CTA. O **título é sempre do vídeo**.
3. Herança por **cópia na criação**: o vídeo novo copia as configurações do projeto para o seu `interview`. Mudar o projeto depois vale só para vídeos novos. Vídeos antigos não mudam.
4. Vídeo dentro de projeto pode ter configurações editadas. Campos diferentes do projeto ganham a etiqueta "personalizado", com botão "voltar ao padrão do projeto".
5. Entrevista curta dentro de projeto: só pergunta o título e mostra o resumo ("Reels · vídeo único · 60 s · sem chamada") com o link "Mudar para este vídeo". Vídeo solto continua com as 8 perguntas.
6. Mover vídeo entre projetos, ou para fora, muda só a pasta dele, nunca as configurações.
7. Apagar projeto: os vídeos viram soltos (`on delete set null`). Nada é apagado.
8. Prioridade: vídeo > projeto > perfil. O perfil vale para vídeos soltos.
9. Limite do plano: só vídeos contam ("x de 5 vídeos este mês"). Projetos são ilimitados.
10. Vídeos existentes ficam soltos. Sem projeto automático, sem migração de dados.
11. Tela "Seus vídeos": faixa de pastas no topo, vídeos soltos abaixo. Tocar numa pasta mostra só os vídeos dela.
12. Escopo da v1: completo (criar, editar, apagar, herdar, entrevista curta, mover, etiqueta "personalizado").

## Fatos do código (conferidos)
- As respostas da entrevista ficam em `public.projects.interview` (jsonb). Passos em `src/lib/interview/steps.ts`; ações em `actions.ts`; leitura em `db.ts`.
- Criação do vídeo: função `create_project` e `create_episode_projects` (migração 0005, security definer, com cota). Série cria episódios em `series`.
- Já existem: `profiles`, `ctas`, `series`, `projects`, `script_blocks`, `usage_months`, `ai_connections`. Migrações 0001–0006 aplicadas em produção.
- Telas: `src/app/(app)/projetos/page.tsx` (lista), `src/app/(app)/novo/page.tsx` (nova fonte).

## Etapas (uma por sessão, com revisão)
1. **Banco (migração 0007):** tabela `folders` (id, user_id default auth.uid(), name, color, about, settings jsonb, created_at) com RLS só do dono; `projects.folder_id uuid references folders(id) on delete set null`; índice em `folder_id`; ajustar `create_project` para aceitar `folder_id` e copiar `settings` para `interview` quando houver. Testes de integração (RLS, delete set null, cópia na criação).
2. **Criar/editar/apagar projeto:** tela com nome, cor, "Sobre este projeto" e as opções com valores sugeridos numa tela só. Faixa de pastas na tela inicial. Apagar com confirmação.
3. **Criar vídeo dentro do projeto:** entrada pela pasta, entrevista curta (título + resumo + "Mudar para este vídeo"). Herança e etiqueta "personalizado" + "voltar ao padrão".
4. **Mover vídeo** entre projetos/solto. "Sobre este projeto" entra no prompt do script e dos títulos.
5. **e2e + revisão final.** Servidor de teste separado (porta 3100, AI_MOCK=1), nunca a porta 3000.

## Tarefa pequena depois de Projetos
- **Colar a chave do OpenRouter** (decidido em 2026-10-14): em "Sua IA" no perfil, o botão "Conectar" (OAuth) continua principal; acrescentar link discreto "Prefiro colar minha chave". Validar a chave na hora (`GET https://openrouter.ai/api/v1/key`), guardar criptografada em `ai_connections` pelo mesmo caminho do callback, e nunca devolver a chave ao navegador. Teste de integração e e2e (mock).

## Regras de trabalho (mantidas)
- Produção (Supabase `dieciotgdpgmxccxjqsy`): `npx supabase db push --dry-run`, me mostrar, só então `db push` com o sim do usuário. Rodar sem `DBUS_SESSION_BUS_ADDRESS=disabled:` no Supabase CLI.
- Push só com o sim do usuário. `git add` só por caminho. Não commitar `.impeccable/hook.cache.json`, `PRODUCT.md`, `AGENTS.md`, `design/marca/identidade.html`, nem a seção "Marca Gravaí" do `DESIGN.md`.
- Next.js deste repo tem mudanças: consultar `node_modules/next/dist/docs/` antes de escrever código.
- Perguntas ao usuário em botões (AskUserQuestion). Português do Brasil, curto, para leigo.

## Prompt para a próxima sessão
```
Continue o Gravaí (pasta Video Facil). Fale em pt-BR, curto, para leigo; decisões em botões. Uma etapa por sessão.
Leia docs/superpowers/plans/2026-10-14-projetos-pastas.md e faça a ETAPA 1 (migração 0007 + testes), com revisão. Mostre o resultado e só então siga. Produção só com dry-run mostrado e meu sim.
```
