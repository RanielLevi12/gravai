-- Gravaí: "Projetos" (pastas com configurações padrão). Na tela é "Projeto"; no banco é `folders`,
-- porque `public.projects` guarda os vídeos. Vídeo solto = folder_id nulo.

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null check (btrim(name) <> '' and char_length(name) <= 80),
  -- A paleta é validada no app; aqui só um limite de tamanho, para não exigir migração a cada cor nova.
  color text not null default 'rosa' check (char_length(color) between 1 and 20),
  about text check (about is null or char_length(about) <= 1000),
  -- Mesmo formato de projects.interview; é copiado para o vídeo quando ele nasce na pasta.
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index on public.folders (user_id, created_at desc);

alter table public.folders enable row level security;
create policy folders_own on public.folders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Apagar a pasta solta os vídeos; nunca apaga vídeo.
alter table public.projects add column folder_id uuid references public.folders on delete set null;
create index on public.projects (user_id, folder_id, created_at desc);

-- folder_id só pode apontar para pasta do próprio usuário (inclusive ao mover o vídeo).
drop policy projects_own on public.projects;
create policy projects_own on public.projects for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (series_id is null or exists (
      select 1 from public.series s
      where s.id = series_id and s.user_id = (select auth.uid())))
    and (folder_id is null or exists (
      select 1 from public.folders f
      where f.id = folder_id and f.user_id = (select auth.uid())))
  );

-- create_project ganha p_folder_id (opcional). Na pasta, o vídeo copia folder.settings para interview.
drop function public.create_project(text, text, text, boolean, int);
create function public.create_project(
  p_title text,
  p_source_kind text,
  p_source_text text,
  p_source_truncated boolean default false,
  p_seconds int default 0,
  p_folder_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_settings jsonb := '{}'::jsonb;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_source_text), '') = '' then
    raise exception 'invalid_project' using errcode = '22023';
  end if;
  if p_folder_id is not null then
    select f.settings into v_settings
    from public.folders f where f.id = p_folder_id and f.user_id = v_user;
    if not found then
      raise exception 'invalid_folder' using errcode = '42501';
    end if;
  end if;
  if not public.consume_usage(1, coalesce(p_seconds, 0)) then
    return null;
  end if;
  insert into public.projects (user_id, folder_id, title, source_kind, source_text, source_truncated, status, interview)
  values (v_user, p_folder_id, p_title, p_source_kind, p_source_text, coalesce(p_source_truncated, false), 'fonte', v_settings)
  returning id into v_id;
  return v_id;
end;
$$;

-- Episódios também aceitam folder_id por linha; sem interview na linha, herdam folder.settings.
create or replace function public.create_episode_projects(p_rows jsonb)
returns table (project_id uuid, ep_index int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_rows' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_rows);
  if v_count = 0 then
    return;
  end if;
  -- Toda linha precisa apontar para uma série do próprio usuário.
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(series_id uuid)
    where r.series_id is null
       or not exists (select 1 from public.series s where s.id = r.series_id and s.user_id = v_user)
  ) then
    raise exception 'invalid_series' using errcode = '42501';
  end if;
  -- folder_id, quando vier, precisa ser pasta do próprio usuário.
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(folder_id uuid)
    where r.folder_id is not null
      and not exists (select 1 from public.folders f where f.id = r.folder_id and f.user_id = v_user)
  ) then
    raise exception 'invalid_folder' using errcode = '42501';
  end if;
  if not public.consume_usage(v_count, 0) then
    return;
  end if;
  return query
    insert into public.projects as p
      (user_id, folder_id, series_id, episode_index, title, source_kind, source_text, source_truncated, status, interview)
    select v_user, r.folder_id, r.series_id, r.episode_index, r.title, r.source_kind, r.source_text,
           coalesce(r.source_truncated, false), coalesce(r.status, 'entrevista'),
           coalesce(r.interview, (select f.settings from public.folders f where f.id = r.folder_id), '{}'::jsonb)
    from jsonb_to_recordset(p_rows) as r(
      folder_id uuid, series_id uuid, episode_index int, title text, source_kind text, source_text text,
      source_truncated boolean, status text, interview jsonb)
    returning p.id, p.episode_index;
end;
$$;

revoke all on function public.create_project(text, text, text, boolean, int, uuid) from public, anon;
grant execute on function public.create_project(text, text, text, boolean, int, uuid) to authenticated;
-- create_episode_projects manteve a assinatura: os grants da 0005 continuam valendo.
