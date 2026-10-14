-- Prompt de capa do vídeo principal (o de cada corte fica em script_blocks.cover_prompt).
alter table public.projects add column cover_prompt text;
