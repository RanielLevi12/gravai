-- Conexão da IA de cada usuário (OpenRouter via OAuth PKCE).
-- A chave fica cifrada (AES-256-GCM, formato v1:<iv>:<tag>:<ciphertext>) e só o servidor
-- (service role) grava e lê key_ciphertext. O dono vê provider/key_hint e pode apagar a linha.

create table public.ai_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null check (provider in ('openrouter')),
  key_ciphertext text not null,
  key_hint text not null,
  created_at timestamptz not null default now()
);

alter table public.ai_connections enable row level security;

create policy ai_connections_select_own on public.ai_connections
  for select to authenticated using ((select auth.uid()) = user_id);

create policy ai_connections_delete_own on public.ai_connections
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Sem policy de insert/update: só o service role grava.
-- Privilégios: o Supabase concede tudo em tabelas novas a anon/authenticated por padrão.
-- Um "revoke select (key_ciphertext)" sozinho não basta enquanto existir o grant de tabela,
-- então revogamos tudo e concedemos só as colunas seguras.
revoke all on public.ai_connections from anon, authenticated;
grant select (user_id, provider, key_hint, created_at) on public.ai_connections to authenticated;
grant delete on public.ai_connections to authenticated;
revoke select (key_ciphertext) on public.ai_connections from anon, authenticated;
