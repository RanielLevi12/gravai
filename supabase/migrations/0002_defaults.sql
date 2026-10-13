-- Gravaí: user_id preenchido pelo próprio banco e cota mensal no fuso de Brasília.

alter table public.profiles alter column user_id set default auth.uid();
alter table public.ctas alter column user_id set default auth.uid();
alter table public.series alter column user_id set default auth.uid();
alter table public.projects alter column user_id set default auth.uid();
alter table public.script_blocks alter column user_id set default auth.uid();

-- Cota: 5 projetos e 3600 s de transcrição por mês-calendário de America/Sao_Paulo.
create or replace function public.consume_usage(p_projects int, p_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_month date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
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

create or replace function public.refund_usage(p_user uuid, p_projects int, p_seconds int)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usage_months
  set projects = greatest(projects - greatest(p_projects, 0), 0),
      transcription_seconds = greatest(transcription_seconds - greatest(p_seconds, 0), 0)
  where user_id = p_user
    and month = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
$$;
