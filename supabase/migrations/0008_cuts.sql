-- Gravaí: cortes marcados sobre o script contínuo. Lista de
-- { id, start, end, title, coverPrompt, descriptions }, com start/end = posição (1..n) dos blocos do script.
-- Gerar o script de novo apaga a lista (as posições passam a apontar para outro texto).
alter table public.projects
  add column cuts jsonb not null default '[]'::jsonb check (jsonb_typeof(cuts) = 'array');
