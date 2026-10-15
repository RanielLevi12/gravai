# Worker do Gravaí

Pega pedidos da tabela `jobs` e monta os vídeos com ffmpeg. Roda no Fly.io (liga só quando há pedido).

Variáveis (no Fly, por `fly secrets set`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (a service role só vive aqui e no servidor do app), `WORKER_SECRET` (o mesmo do app) e `APP_URL` (endereço do app, para pedir a transcrição).

Na Vercel: `FLY_API_TOKEN` (de preferência de deploy só deste app: `fly tokens create deploy -a gravai-worker`), `FLY_APP` (`gravai-worker`), `WORKER_SECRET` e `CRON_SECRET` (qualquer texto longo; o cron diário de `vercel.json` liga o worker, que limpa os arquivos de mais de 30 dias ao ligar).

## Publicar no Fly (cada passo mexe em produção)

```bash
cd worker
fly auth login
fly apps create gravai-worker        # se o nome estiver ocupado, troque em fly.toml e em FLY_APP
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WORKER_SECRET=... APP_URL=...
fly deploy --ha=false
```

O worker sai sozinho após 60 s sem pedidos e a máquina para; o app a liga quando há pedido.

## Testes

Precisa de `ffmpeg` e do Supabase local (`npx supabase start`). Na raiz do repositório:

```bash
eval "$(npx supabase status -o env | sed -n 's/^\(API_URL\|SERVICE_ROLE_KEY\)=/export \1=/p')"
export SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
cd worker && npx vitest run
```

Sem essas variáveis, os testes que usam o banco são pulados.

## Rodar local

```bash
cd worker && npm install && npm start
```
