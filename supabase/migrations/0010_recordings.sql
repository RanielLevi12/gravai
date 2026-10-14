-- Gravaí: tela Gravar. Gravações do usuário (bucket privado + tabela) e novo status de projeto 'gravado'.

alter table public.projects drop constraint projects_status_check;
alter table public.projects
  add constraint projects_status_check
  check (status in ('fonte', 'entrevista', 'script', 'gravacao', 'gravado', 'pronto'));

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  kind text not null check (kind in ('take', 'block', 'external')),
  block_id uuid references public.script_blocks on delete cascade,
  storage_path text not null,
  mime text not null,
  duration_seconds numeric(8, 2),
  size_bytes bigint not null check (size_bytes >= 0),
  status text not null default 'uploading' check (status in ('uploading', 'ready')),
  created_at timestamptz not null default now()
);

-- No máximo 1 gravação pronta por (projeto, bloco); bloco nulo conta como um só.
create unique index recordings_one_ready
  on public.recordings (project_id, coalesce(block_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'ready';
create index on public.recordings (user_id);
create index on public.recordings (project_id);

alter table public.recordings enable row level security;
create policy recordings_own on public.recordings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    -- o arquivo tem de morar na pasta do próprio dono (o servidor apaga/assina por este caminho).
    and (storage.foldername(storage_path))[1] = (select auth.uid())::text
    -- a FK não passa pela RLS: sem isto, daria para ligar uma gravação ao projeto/bloco de outra pessoa.
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
    and (block_id is null or exists (
      select 1 from public.script_blocks b
       where b.id = block_id and b.project_id = recordings.project_id and b.user_id = (select auth.uid())))
  );

revoke all on public.recordings from anon;
grant select, insert, update, delete on public.recordings to authenticated;

-- Marca a gravação como pronta e apaga a pronta anterior do mesmo (projeto, bloco), na mesma transação.
-- Devolve os storage_path das linhas substituídas (o servidor apaga os arquivos). Só age em linhas do usuário logado.
create function public.finish_recording(p_id uuid, p_size_bytes bigint, p_duration numeric)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rec public.recordings%rowtype;
  v_paths text[];
begin
  select * into v_rec from public.recordings
   where id = p_id and user_id = (select auth.uid()) for update;
  if not found then
    raise exception 'recording_not_found' using errcode = 'P0002';
  end if;

  with del as (
    delete from public.recordings
     where project_id = v_rec.project_id
       and block_id is not distinct from v_rec.block_id
       and status = 'ready'
       and id <> v_rec.id
       and user_id = (select auth.uid())
    returning storage_path
  )
  select coalesce(array_agg(storage_path), '{}') into v_paths from del;

  update public.recordings
     set status = 'ready', size_bytes = p_size_bytes, duration_seconds = p_duration
   where id = v_rec.id;

  return v_paths;
end;
$$;

revoke all on function public.finish_recording(uuid, bigint, numeric) from public, anon;
grant execute on function public.finish_recording(uuid, bigint, numeric) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 52428800, '{video/mp4,video/webm}');

create policy recordings_own on storage.objects for all to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
