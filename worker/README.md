# Worker do Gravaí

Pega pedidos da tabela `jobs` e monta os vídeos com ffmpeg. Roda no Fly.io (liga só quando há pedido).

Roda numa VPS com Docker e fica ligado esperando pedidos (a cada 5 s olha a fila). Ao ligar, e depois a cada hora, apaga os arquivos de mais de 30 dias.

Variáveis (arquivo `worker/.env` na VPS, nunca no git): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (acesso total: só vive aqui e no servidor do app), `WORKER_SECRET` (o mesmo valor do app) e `APP_URL` (endereço público do app, para pedir a transcrição). Armazenamento (Cloudflare R2): `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (veja `.env.example`). Opcional: `WORKER_IDLE_EXIT_MS` (padrão 0 = nunca sai).

Na Vercel, o app precisa de `WORKER_SECRET` (o mesmo). Não precisa de nenhuma variável do Fly.

## Publicar na VPS (cada passo mexe em produção)

```bash
git clone <repositório> && cd <pasta>/worker      # ou copie só a pasta worker
nano .env                                         # as 4 variáveis acima
docker compose up -d --build
docker compose logs -f                            # confira que não há erro
```

Atualizar: `git pull && docker compose up -d --build`. Reinicia sozinho se a VPS reiniciar ou o worker cair.

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
