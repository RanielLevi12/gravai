# Cortes e entrega (Plano 3) — desenho

Status: rascunho para revisão. Sem código ainda.

## Objetivo
Depois de aprovar a gravação, o app gera o vídeo final e um vídeo por corte (vertical 9:16), com capa e descrição por plataforma, prontos para baixar. Sucesso: a pessoa aprova, espera alguns minutos e baixa tudo sem sair do app.

## Decisões já tomadas
- Processar em **servidor próprio com ffmpeg**, hospedado no **Fly.io** (liga só quando há pedido).
- Escopo: tudo numa entrega — modo por blocos, take único (com transcrição), capas, descrições, .zip, ajuste manual de início/fim. Implementação em etapas que funcionam sozinhas (ver "Ordem de construção").
- Supabase continua no plano gratuito: **50 MB por arquivo**. O .zip não é guardado; é montado na hora.
- Os cortes já existem como texto: `projects.cuts` (migração 0008): `{ id, start, end, title, coverPrompt, descriptions }`, com `start/end` = posição (1..n) dos blocos do script.
- Fora do escopo: edição criativa (legendas, trilha, efeitos), publicar direto nas redes, vários usuários por projeto.

## Fluxo
1. Tela `/projetos/[id]/gravar/aprovar` (status `gravado`): botão **Gerar vídeos**.
2. Ação de servidor cria um `jobs` (`queued`) e chama a API do Fly para ligar o servidor.
3. Tela `/projetos/[id]/entrega` mostra o progresso (consulta a cada 3 s): "Preparando", "Juntando", "Cortando", "Capas", "Pronto".
4. Pronto: projeto vira `pronto`; a tela mostra o vídeo final e cada corte com **Baixar**, **Copiar descrição** (por plataforma) e **Ajustar início/fim**; botão **Baixar tudo (.zip)**.
5. Falhou: mensagem em português e botão **Tentar de novo** (novo job; sobras do anterior são apagadas).

## Dados
Migração `0011_jobs_exports.sql` (produção só após `db push --dry-run` + sim do usuário):
- `jobs`: `id`, `user_id`, `project_id`, `kind` (`render` | `recut`), `payload jsonb` (p.ex. `{ cutId, start, end }` no ajuste manual), `status` (`queued` | `running` | `done` | `failed`), `step text`, `progress int`, `error text`, `attempts int`, `created_at`, `started_at`, `finished_at`. RLS: dono lê; escrita só pelo servidor (service role) e pela ação de criar. Um job ativo (`queued`/`running`) por projeto.
- `exports`: `id`, `user_id`, `project_id`, `kind` (`final` | `cut` | `cover`), `cut_id` (nulo no final), `storage_path`, `mime`, `duration_seconds`, `size_bytes`, `start_seconds`, `end_seconds`, `expires_at` (+30 dias), `created_at`. Uma linha ativa por (`project_id`, `kind`, `cut_id`); refazer substitui e apaga o arquivo antigo. RLS: dono lê.
- `transcripts`: `project_id`, `recording_id`, `words jsonb` (`[{ w, s, e }]`), para não pagar a transcrição duas vezes.
- Bucket privado `exports`, 50 MB por arquivo, `video/mp4` e `image/jpeg`; caminho `{user_id}/{project_id}/{export_id}.{ext}`. Policy de leitura do dono.
- Função de limpeza diária (cron do Supabase) apaga `exports` vencidos, arquivos incluídos; aviso na tela 5 dias antes.

## Servidor (worker)
Projeto novo `worker/` no repositório (Node + ffmpeg, imagem Docker). Roda no Fly com `auto_stop_machines`; escala a zero.
- Pega o job com `update ... where status='queued' ... returning` (um por vez, sem corrida). Usa a service role (fica só como segredo do Fly).
- Se morrer no meio, o job volta para `queued` após 10 min sem sinal de vida (`attempts` < 3).
- Passos de `render`:
  1. Baixa as gravações `ready` do projeto.
  2. Normaliza cada uma: 1080×1920, 30 fps, H.264 + AAC, loudness uniforme (`loudnorm`).
  3. **Por blocos:** concatena na ordem do script; o tempo de cada bloco é a duração real da sua gravação, então os cortes são exatos. **Take único:** transcreve o áudio (OpenAI, com tempo por palavra), alinha o texto do script às palavras faladas (programação dinâmica, tolerando erros de fala) e obtém início/fim de cada bloco.
  4. Gera `final.mp4` e um `cut-N.mp4` por corte (recorte do vídeo final de `start` do primeiro bloco ao `end` do último).
  5. Capa: frame do primeiro segundo do corte com o título por cima (modelo fixo da marca); `coverPrompt` fica guardado para uso futuro com IA de imagem.
  6. Sobe tudo para `exports` e grava as linhas; marca `done` e o projeto `pronto`.
- `recut`: refaz só um corte com início/fim ajustados, a partir do final já guardado.
- Se algum arquivo passar de 50 MB: reencoda com bitrate menor (alvo 1,8 Mbps como na gravação); se ainda passar, falha com mensagem clara.

## Entrega no app
- Páginas novas: `/projetos/[id]/entrega` (lista e progresso).
- Download: URLs assinadas curtas (5 min) geradas no servidor do Next.
- `.zip`: rota `GET /projetos/[id]/entrega/zip` que lê os arquivos por streaming e monta o zip na hora (sem biblioteca pesada; formato "store", vídeo já é comprimido). Inclui vídeos, capas e um `descricoes.txt` por plataforma.
- Ajuste manual: tela do corte com o vídeo final e dois controles de início/fim (passo de 0,1 s); salvar cria job `recut`.
- Copiar descrição: botão por plataforma (CTA já montado em `descriptions`).

## Erros e casos de borda
- Gravação que mudou depois de gerar: o botão vira "Gerar de novo" (marca `script_stale` / gravação mais nova que os `exports`).
- Corte que aponta para bloco sem gravação: o job falha antes de começar, listando os blocos.
- Transcrição ruim (alinhamento com baixa confiança): usa os tempos estimados e mostra aviso "Confira o início e o fim dos cortes".
- Fly fora do ar ou sem cota: job fica `queued`; tela mostra "Na fila" e o botão de tentar de novo após 10 min.
- Cota/custos: a transcrição entra no controle de uso existente (`ai_usage`, migração 0009).

## Segredos e segurança
- Service role e chave de transcrição só no Fly (`fly secrets`) e no `.env.local`; nunca no navegador.
- O servidor só lê/escreve caminhos do `user_id` do job; confere `project_id` antes de qualquer arquivo.
- Token do Fly para ligar a máquina fica só no servidor do Next (variável de ambiente da Vercel).

## Testes
- Unit: alinhamento script↔palavras, cálculo de recortes por bloco, nomes de arquivo, regras de expiração, escolha de bitrate para caber em 50 MB.
- Integração (Supabase local): RLS de `jobs`/`exports`/`transcripts` e do bucket; pegar job sem corrida (dois workers); expirar arquivos.
- Worker: teste com vídeos curtos gerados pelo próprio ffmpeg (cores + tom), conferindo duração e resolução da saída (modo blocos e take).
- E2E (Playwright, worker local): aprovar → gerar → ver "Pronto" → baixar um corte → baixar .zip → ajustar um corte.
- Manual (usuário): Fly de verdade com uma gravação feita no celular.

## Ordem de construção (cada etapa funciona sozinha)
1. Migração 0011 + tela de progresso + job que só marca "pronto" (esqueleto de ponta a ponta, worker local).
2. Worker: blocos → final + cortes + capas. Entrega com download.
3. Take único com transcrição e alinhamento.
4. .zip e descrições.
5. Ajuste manual de início/fim (`recut`).
6. Deploy no Fly + limpeza de 30 dias + avisos.

## Custos e riscos
- Fly: poucos dólares/mês com escala a zero. Conta e cartão do usuário (a configurar na etapa 6).
- Transcrição: custo por minuto, só no take único, uma vez por gravação (cache em `transcripts`).
- Risco maior: alinhamento no take único. Mitigação: aviso e ajuste manual.
- Limite de 50 MB: vídeos longos podem não caber; ver reencode acima.
