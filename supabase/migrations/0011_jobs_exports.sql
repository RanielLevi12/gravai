-- Gravaí: cortes e entrega. Fila de pedidos para o worker (jobs), arquivos gerados (exports),
-- transcrições em cache (transcripts) e bucket privado 'exports'. Só o dono lê; quem escreve é o worker (service role).

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  kind text not null check (kind in ('render', 'recut')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  step text,
  progress int not null default 0 check (progress between 0 and 100),
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz
);

-- Um pedido ativo por projeto: duplo clique em "Gerar vídeos" não cria dois.
create unique index jobs_one_active on public.jobs (project_id) where status in ('queued', 'running');
create index on public.jobs (user_id);
create index on public.jobs (status, created_at);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  kind text not null check (kind in ('final', 'cut', 'cover')),
  cut_id text,
  storage_path text not null,
  mime text not null,
  duration_seconds numeric(8, 2),
  size_bytes bigint not null check (size_bytes >= 0),
  start_seconds numeric(8, 2),
  end_seconds numeric(8, 2),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((kind = 'final') = (cut_id is null))
);

-- Uma linha ativa por (projeto, tipo, corte); gerar de novo substitui.
create unique index exports_one_active
  on public.exports (project_id, kind, coalesce(cut_id, ''));
create index on public.exports (user_id);
create index on public.exports (expires_at);

create table public.transcripts (
  recording_id uuid primary key references public.recordings on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  words jsonb not null check (jsonb_typeof(words) = 'array'),
  created_at timestamptz not null default now()
);
create index on public.transcripts (user_id);

alter table public.jobs enable row level security;
alter table public.exports enable row level security;
alter table public.transcripts enable row level security;

create policy jobs_read_own on public.jobs for select to authenticated using (user_id = (select auth.uid()));
create policy exports_read_own on public.exports for select to authenticated using (user_id = (select auth.uid()));
create policy transcripts_read_own on public.transcripts for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.jobs, public.exports, public.transcripts from anon, authenticated;
grant select on public.jobs, public.exports, public.transcripts to authenticated;

-- O usuário cria o pedido por esta função (não por insert direto): ela confere que o projeto é dele e já foi gravado.
create function public.create_render_job(p_project uuid, p_kind text, p_payload jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_kind not in ('render', 'recut') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  select status into v_status from public.projects where id = p_project and user_id = v_user;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  if v_status not in ('gravado', 'pronto') then
    raise exception 'not_recorded' using errcode = '22023';
  end if;
  begin
    insert into public.jobs (user_id, project_id, kind, payload)
    values (v_user, p_project, p_kind, coalesce(p_payload, '{}'::jsonb))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'job_already_active' using errcode = '55000';
  end;
  return v_id;
end;
$$;

revoke all on function public.create_render_job(uuid, text, jsonb) from public, anon;
grant execute on function public.create_render_job(uuid, text, jsonb) to authenticated;

-- Worker: pega o pedido mais antigo da fila. skip locked evita que dois workers peguem o mesmo.
create function public.claim_job()
returns setof public.jobs
language sql
security definer
set search_path = ''
as $$
  update public.jobs j
     set status = 'running', started_at = now(), heartbeat_at = now(), attempts = j.attempts + 1,
         step = 'preparando', progress = 0, error = null
   where j.id = (
     select id from public.jobs where status = 'queued' order by created_at for update skip locked limit 1
   )
  returning j.*;
$$;

-- Pedido "running" sem sinal de vida há mais de 10 min: volta para a fila (ou falha na 3ª tentativa).
create function public.requeue_stale_jobs()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  with stale as (
    update public.jobs
       set status = case when attempts >= 3 then 'failed' else 'queued' end,
           error = case when attempts >= 3 then 'Não foi possível gerar os vídeos. Tente de novo.' else error end,
           finished_at = case when attempts >= 3 then now() else finished_at end
     where status = 'running' and heartbeat_at < now() - interval '10 minutes'
    returning 1
  )
  select count(*) into v_count from stale;
  return v_count;
end;
$$;

-- Apaga as linhas vencidas e devolve os caminhos (o worker apaga os arquivos do bucket).
create function public.purge_expired_exports()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paths text[];
begin
  with del as (delete from public.exports where expires_at < now() returning storage_path)
  select coalesce(array_agg(storage_path), '{}') into v_paths from del;
  return v_paths;
end;
$$;

revoke all on function public.claim_job() from public, anon, authenticated;
revoke all on function public.requeue_stale_jobs() from public, anon, authenticated;
revoke all on function public.purge_expired_exports() from public, anon, authenticated;
grant execute on function public.claim_job() to service_role;
grant execute on function public.requeue_stale_jobs() to service_role;
grant execute on function public.purge_expired_exports() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exports', 'exports', false, 52428800, '{video/mp4,image/jpeg}');

-- O dono só lê (e baixa por URL assinada); gravar no bucket é do worker.
create policy exports_read_own on storage.objects for select to authenticated
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = (select auth.uid())::text);
