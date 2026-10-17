#!/usr/bin/env bash
# Monta o comando que atualiza o worker na VPS e copia para a área de transferência.
# Os valores vêm do .env.producao (nunca aparecem na tela).
# Uso: bash scripts/preparar-vps.sh            (copia)
#      bash scripts/preparar-vps.sh --mostrar  (só para teste com arquivo falso)
set -euo pipefail
cd "$(dirname "$0")/.."
ARQ="${ENV_ARQ:-.env.producao}"
NOMES='WORKER_SECRET|R2_ACCOUNT_ID|R2_BUCKET|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY'

linhas=""
for n in WORKER_SECRET R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  l=$(grep -E "^$n=.+" "$ARQ" | tail -1 | tr -d '\r')
  [ -z "$l" ] && { echo "Falta $n em $ARQ" >&2; exit 1; }
  linhas+=" '$l'"
done

# Começa com espaço: o bash da VPS não guarda no histórico.
cmd=" cd /opt/gravai/worker && cp .env .env.bak-\$(date +%s) && sed -i -E '/^(APP_URL|$NOMES)=/d' .env && printf '%s\n' 'APP_URL=https://gravai-bice.vercel.app'$linhas >> .env && cd /opt/gravai && git fetch origin && git checkout feat/cortes-entrega && git pull && cd worker && docker compose up -d --build && clear && docker compose logs --tail=30"

if [ "${1:-}" = "--mostrar" ]; then printf '%s\n' "$cmd"; exit 0; fi
printf '%s' "$cmd" | xclip -selection clipboard
echo "COPIADO. Agora cole no console da VPS (Ctrl+Shift+V) e aperte Enter."
