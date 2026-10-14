-- Gravaí: o script principal é contínuo (abertura, trechos de desenvolvimento, fechamento);
-- os cortes passam a ser marcados depois, sobre o mesmo texto. Novo tipo de bloco: 'body'.
alter table public.script_blocks drop constraint script_blocks_kind_check;
alter table public.script_blocks
  add constraint script_blocks_kind_check check (kind in ('opening', 'body', 'bridge', 'cut', 'closing'));
