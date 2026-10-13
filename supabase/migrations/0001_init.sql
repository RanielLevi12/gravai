-- Gravaí: schema inicial, RLS e cota mensal de uso.

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  niche text,
  audience text,
  tone text,
  phrases text,
  onboarded boolean not null default false
);

create table public.ctas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('link', 'bio', 'whatsapp', 'phone')),
  label text,
  value text
);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  series_id uuid references public.series on delete set null,
  episode_index int,
  title text not null,
  source_kind text not null,
  source_text text not null,
  source_truncated boolean not null default false,
  interview jsonb not null default '{}',
  status text not null default 'fonte'
    check (status in ('fonte', 'entrevista', 'script', 'gravacao', 'pronto')),
  descriptions jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.script_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  position int not null,
  kind text not null check (kind in ('opening', 'bridge', 'cut', 'closing')),
  text text not null default '',
  cut_index int,
  cut_title text,
  descriptions jsonb not null default '{}',
  cover_prompt text,
  unique (project_id, position)
);

create table public.usage_months (
  user_id uuid not null references auth.users on delete cascade,
  month date not null,
  projects int not null default 0 check (projects >= 0),
  transcription_seconds int not null default 0 check (transcription_seconds >= 0),
  primary key (user_id, month)
);

create index on public.ctas (user_id);
create index on public.series (user_id);
create index on public.projects (user_id, created_at desc);
create index on public.script_blocks (user_id);

alter table public.profiles enable row level security;
alter table public.ctas enable row level security;
alter table public.series enable row level security;
alter table public.projects enable row level security;
alter table public.script_blocks enable row level security;
alter table public.usage_months enable row level security;

create policy profiles_own on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ctas_own on public.ctas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy series_own on public.series for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- series_id e project_id só podem apontar para linhas do próprio usuário.
create policy projects_own on public.projects for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (series_id is null or exists (
      select 1 from public.series s
      where s.id = series_id and s.user_id = (select auth.uid())))
  );
create policy script_blocks_own on public.script_blocks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid()))
  );

-- usage_months: só leitura para o dono; escrita apenas via funções security definer.
create policy usage_months_select on public.usage_months for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.usage_months from anon, authenticated;

-- Storage: bucket privado; objetos em {auth.uid()}/...
insert into storage.buckets (id, name, public) values ('sources', 'sources', false);

create policy sources_own on storage.objects for all to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Cota: 5 projetos e 3600 s de transcrição por mês (UTC). Atômica; false sem alterar nada se estourar.
create function public.consume_usage(p_projects int, p_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_user_out uuid;
begin
  if v_user is null or p_projects is null or p_seconds is null
     or p_projects < 0 or p_seconds < 0 then
    return false;
  end if;

  insert into public.usage_months as u (user_id, month, projects, transcription_seconds)
  select v_user, v_month, p_projects, p_seconds
  where p_projects <= 5 and p_seconds <= 3600
  on conflict (user_id, month) do update
    set projects = u.projects + excluded.projects,
        transcription_seconds = u.transcription_seconds + excluded.transcription_seconds
    where u.projects + excluded.projects <= 5
      and u.transcription_seconds + excluded.transcription_seconds <= 3600
  returning u.user_id into v_user_out;

  return v_user_out is not null;
end;
$$;

-- Estorno (ex.: falha após consumir): só service_role; nunca abaixo de 0.
create function public.refund_usage(p_user uuid, p_projects int, p_seconds int)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usage_months
  set projects = greatest(projects - greatest(p_projects, 0), 0),
      transcription_seconds = greatest(transcription_seconds - greatest(p_seconds, 0), 0)
  where user_id = p_user
    and month = date_trunc('month', now() at time zone 'utc')::date;
$$;

revoke execute on function public.consume_usage(int, int) from public, anon;
grant execute on function public.consume_usage(int, int) to authenticated;
revoke execute on function public.refund_usage(uuid, int, int) from public, anon, authenticated;
grant execute on function public.refund_usage(uuid, int, int) to service_role;
