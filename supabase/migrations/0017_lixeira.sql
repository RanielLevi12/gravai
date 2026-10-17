-- Gravaí: lixeira de 7 dias para vídeos (projects) e projetos (folders).
-- NÃO aplicada em produção ainda: o Raniel aplica depois de revisar.
--
-- Como funciona:
--  * `deleted_at` preenchido = item na lixeira. Nulo = item normal.
--  * Os itens na lixeira ficam escondidos das telas pelas consultas do app (`deleted_at is null`).
--    A RLS NÃO esconde de propósito: a própria tela /lixeira precisa enxergar e restaurar esses itens.
--  * Mandar um projeto (pasta) para a lixeira leva junto os vídeos dele, com o MESMO `deleted_at`.
--    Assim, ao restaurar o projeto, voltam só os vídeos que foram junto (não os que já estavam
--    na lixeira por conta própria).
--  * A cota (storage_quota) só muda quando a linha é apagada de vez (gatilhos da 0016): lixeira não libera espaço.
--  * Depois de 7 dias o worker (worker/src/purge.ts) apaga de vez: arquivos no R2 e linhas.

alter table public.projects add column deleted_at timestamptz;
alter table public.folders add column deleted_at timestamptz;

-- Só os itens na lixeira entram nestes índices (a lixeira é pequena; a lista normal não paga nada).
create index projects_trash_idx on public.projects (user_id, deleted_at) where deleted_at is not null;
create index folders_trash_idx on public.folders (user_id, deleted_at) where deleted_at is not null;

-- Manda o projeto e os vídeos dele para a lixeira, de uma vez só. `security invoker`: vale a RLS de quem chama.
-- Devolve false se o projeto não existe, não é da pessoa ou já está na lixeira.
create function public.trash_folder(p_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now(); -- igual dentro da transação: projeto e vídeos recebem o mesmo instante
begin
  update public.folders set deleted_at = v_now where id = p_id and deleted_at is null;
  if not found then
    return false;
  end if;
  update public.projects set deleted_at = v_now where folder_id = p_id and deleted_at is null;
  return true;
end;
$$;

-- Tira o projeto da lixeira e traz de volta os vídeos que foram junto com ele.
create function public.restore_folder(p_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  select deleted_at into v_at from public.folders where id = p_id and deleted_at is not null;
  if not found then
    return false;
  end if;
  update public.projects set deleted_at = null where folder_id = p_id and deleted_at = v_at;
  update public.folders set deleted_at = null where id = p_id;
  return true;
end;
$$;

revoke all on function public.trash_folder(uuid), public.restore_folder(uuid) from public, anon;
grant execute on function public.trash_folder(uuid), public.restore_folder(uuid) to authenticated;
