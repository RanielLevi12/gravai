-- Gravaí: histórico de versões de cada trecho do script, para o botão "Voltar à versão anterior".
-- Guarda o texto de ANTES de cada reescrita (o app mantém só as últimas 10 por trecho).
create table public.script_block_versions (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.script_blocks on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null check (char_length(text) <= 6000),
  created_at timestamptz not null default now()
);

create index on public.script_block_versions (block_id, created_at desc);
create index on public.script_block_versions (user_id);

alter table public.script_block_versions enable row level security;
-- O trecho precisa ser do próprio usuário (mesma regra de script_blocks).
create policy script_block_versions_own on public.script_block_versions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.script_blocks b
      where b.id = block_id and b.user_id = (select auth.uid()))
  );
