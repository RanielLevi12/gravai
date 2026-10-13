#!/usr/bin/env bash
# Roda os testes de integração contra o Supabase local (`npx supabase start`).
set -euo pipefail
eval "$(npx supabase status -o env | sed -n 's/^\(API_URL\|ANON_KEY\|SERVICE_ROLE_KEY\)=/export \1=/p')"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
npx vitest run --config vitest.integration.config.mts "$@"
