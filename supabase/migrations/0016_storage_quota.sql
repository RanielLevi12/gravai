-- Gravaí: vídeos no Cloudflare R2, guardados até o usuário apagar, com cota de espaço por conta.
-- NÃO aplicada em produção ainda: o Raniel aplica depois de revisar.

-- Uso de espaço por usuário (bytes). Mantido por gatilhos em recordings e exports: sobe quando a gravação
-- fica pronta ou o export é criado, desce quando a linha some (apagar vídeo, apagar projeto, cascata do auth).
create table public.storage_quota (
  user_id uuid primary key references auth.users on delete cascade,
  used_bytes bigint not null default 0,
  limit_bytes bigint not null default 5368709120 check (limit_bytes >= 0) -- 5 GB
);

alter table public.storage_quota enable row level security;
create policy storage_quota_read_own on public.storage_quota for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.storage_quota from anon, authenticated;
grant select on public.storage_quota to authenticated;

-- Soma `delta` ao uso do usuário (cria a linha se não existir). Nunca fica abaixo de zero.
create function public.storage_add(p_user uuid, p_delta bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.storage_quota (user_id, used_bytes) values (p_user, greatest(p_delta, 0))
  on conflict (user_id) do update set used_bytes = greatest(public.storage_quota.used_bytes + p_delta, 0);
$$;
revoke all on function public.storage_add(uuid, bigint) from public, anon, authenticated;

create function public.recordings_quota_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old bigint := 0;
  v_new bigint := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'ready' then v_old := old.size_bytes; end if;
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'ready' then v_new := new.size_bytes; end if;
  if tg_op = 'DELETE' then
    perform public.storage_add(old.user_id, v_new - v_old);
  else
    perform public.storage_add(new.user_id, v_new - v_old);
  end if;
  return null;
end;
$$;

create function public.exports_quota_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.storage_add(old.user_id, -old.size_bytes);
  elsif tg_op = 'INSERT' then
    perform public.storage_add(new.user_id, new.size_bytes);
  else
    perform public.storage_add(new.user_id, new.size_bytes - old.size_bytes);
  end if;
  return null;
end;
$$;

create trigger recordings_quota after insert or update of status, size_bytes or delete on public.recordings
  for each row execute function public.recordings_quota_trg();
create trigger exports_quota after insert or update of size_bytes or delete on public.exports
  for each row execute function public.exports_quota_trg();

-- Quem já tem arquivos entra com o uso real.
insert into public.storage_quota (user_id, used_bytes)
select u, sum(b)::bigint from (
  select user_id as u, size_bytes as b from public.recordings where status = 'ready'
  union all
  select user_id, size_bytes from public.exports
) t group by u
on conflict (user_id) do update set used_bytes = excluded.used_bytes;

-- Cabem mais `p_bytes` na cota de quem está logado? (usuário sem linha usa o limite padrão.)
create function public.storage_fits(p_bytes bigint)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select used_bytes + p_bytes <= limit_bytes from public.storage_quota where user_id = (select auth.uid())),
    p_bytes <= 5368709120
  );
$$;
revoke all on function public.storage_fits(bigint) from public, anon;
grant execute on function public.storage_fits(bigint) to authenticated;

-- Os vídeos não vencem mais: a limpeza dos 30 dias vira "não faz nada" (o worker deixou de chamá-la).
create or replace function public.purge_expired_exports()
returns text[]
language sql
security definer
set search_path = ''
as $$
  select '{}'::text[];
$$;
