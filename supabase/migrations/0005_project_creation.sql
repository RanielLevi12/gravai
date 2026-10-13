-- Gravaí: projetos só nascem por funções que consomem a cota na mesma transação;
-- e o script ganha o marcador "desatualizado" (respostas ou texto mudaram depois da geração).

-- Sem INSERT direto: o limite de 5 projetos/mês não pode ser contornado pelo navegador.
revoke insert on public.projects from anon, authenticated;

-- not valid: vale para linhas novas e editadas, sem reprovar linhas antigas.
alter table public.projects
  add constraint projects_source_kind_check
  check (source_kind in ('text', 'images', 'pdf', 'docx', 'pptx', 'txt', 'gdocs', 'audio')) not valid;

alter table public.projects add column script_stale boolean not null default false;

-- Cria um projeto do usuário logado e consome 1 projeto (+ segundos de áudio) da cota.
-- Devolve null, sem criar nada, se a cota não couber.
create function public.create_project(
  p_title text,
  p_source_kind text,
  p_source_text text,
  p_source_truncated boolean default false,
  p_seconds int default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_source_text), '') = '' then
    raise exception 'invalid_project' using errcode = '22023';
  end if;
  if not public.consume_usage(1, coalesce(p_seconds, 0)) then
    return null;
  end if;
  insert into public.projects (user_id, title, source_kind, source_text, source_truncated, status)
  values (v_user, p_title, p_source_kind, p_source_text, coalesce(p_source_truncated, false), 'fonte')
  returning id into v_id;
  return v_id;
end;
$$;

-- Cria os episódios novos de uma série do usuário logado e consome 1 projeto por episódio.
-- Sem linhas na resposta = cota insuficiente (nada foi criado).
create function public.create_episode_projects(p_rows jsonb)
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
  if not public.consume_usage(v_count, 0) then
    return;
  end if;
  return query
    insert into public.projects as p
      (user_id, series_id, episode_index, title, source_kind, source_text, source_truncated, status, interview)
    select v_user, r.series_id, r.episode_index, r.title, r.source_kind, r.source_text,
           coalesce(r.source_truncated, false), coalesce(r.status, 'entrevista'), coalesce(r.interview, '{}'::jsonb)
    from jsonb_to_recordset(p_rows) as r(
      series_id uuid, episode_index int, title text, source_kind text, source_text text,
      source_truncated boolean, status text, interview jsonb)
    returning p.id, p.episode_index;
end;
$$;

revoke all on function public.create_project(text, text, text, boolean, int) from public, anon;
revoke all on function public.create_episode_projects(jsonb) from public, anon;
grant execute on function public.create_project(text, text, text, boolean, int) to authenticated;
grant execute on function public.create_episode_projects(jsonb) to authenticated;
