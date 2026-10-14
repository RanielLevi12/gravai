# Worker do Gravaí

Pega pedidos da tabela `jobs` e monta os vídeos com ffmpeg. Roda no Fly.io (liga só quando há pedido).

Variáveis: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (a service role só vive aqui e no servidor do app).

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
