-- Gravaí: gravações de até 500 MB (qualidade Alta e vídeos feitos fora). Exige o plano Pro do Supabase
-- e o "Upload file size limit" do projeto (Storage → Settings) em 500 MB ou mais.

update storage.buckets set file_size_limit = 524288000 where id = 'recordings';
