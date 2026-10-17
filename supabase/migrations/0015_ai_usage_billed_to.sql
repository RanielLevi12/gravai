-- Gravaí: de quem é a conta que pagou cada chamada de IA.
-- 'user' = chave do próprio usuário (OAuth ou colada). 'app' = chave do servidor (OPENROUTER_API_KEY),
-- que tem limite mensal por usuário. Só as linhas 'app' entram na conta do limite.
-- NÃO aplicada em produção: o Raniel aplica depois de revisar.
alter table public.ai_usage
  add column billed_to text not null default 'user' check (billed_to in ('user', 'app'));

create index on public.ai_usage (user_id, billed_to, created_at desc);
