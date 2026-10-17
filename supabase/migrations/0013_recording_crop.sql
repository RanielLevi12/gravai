-- Gravaí: retângulo de corte 9:16 da gravação (x, y, w, h em pixels do vídeo gravado).
-- Nulo = vídeo já em pé (ou de fora): o worker corta o centro 9:16 do jeito que o preview mostra.
alter table public.recordings add column crop jsonb;
