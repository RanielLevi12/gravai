-- Gravaí: custo de cada chamada de IA (o OpenRouter devolve `usage.cost` em dólares, cobrado na conta do usuário).
-- Só o servidor grava (service role); o dono só lê as próprias linhas.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('text', 'ocr', 'audio')),
  model text not null,
  cost_usd numeric(12, 6) not null check (cost_usd >= 0),
  prompt_tokens int,
  completion_tokens int,
  created_at timestamptz not null default now()
);

create index on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;
create policy ai_usage_select_own on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
