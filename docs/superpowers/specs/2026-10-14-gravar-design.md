# Tela Gravar (Plano 2) — desenho

Status: rascunho para revisão. Sem código ainda.

## Objetivo
A pessoa lê o script no teleprompter sobre a câmera frontal, grava em vertical 9:16, revisa, refaz o que errou e aprova. O vídeo fica guardado e pronto para o worker do Plano 3 (cortes, capas, entrega). Sucesso: gravar e guardar sem sair do app, no celular.

## Decisões já tomadas
- Escopo: tudo do Plano 2 numa entrega (take único, por blocos, vídeo de fora, aprovar).
- Velocidade do teleprompter: botões fixos (tartaruga/coelho) no rodapé; sem gesto.
- Ao aprovar: vídeo guardado, projeto vira "Gravado", aviso "cortes e entrega chegam na próxima versão". O processamento é do Plano 3.
- Supabase é **plano gratuito**: máximo de **50 MB por arquivo**. Isso limita duração e qualidade (ver "Limite de tamanho").
- Fora do escopo: rolagem que segue a voz (fase 2), worker, transcrição, cortes, capas, zip.

## Fluxo
1. `/projetos/[id]/gravar` — escolher: **Gravar tudo de uma vez**, **Gravar por blocos**, **Enviar vídeo feito fora** (wireframe `gravar-modo`).
2. `/projetos/[id]/gravar/teleprompter?modo=take|blocos` — tela `rec-bg` (escura), câmera frontal, texto rolando (wireframes `teleprompter`, `teleprompter-ajustes`). Contagem 3-2-1, pausar/retomar por toque, REC com timecode, ajustes (fonte, tamanho, cor, opacidade do fundo, margem, posição topo/meio, espelhar).
3. Prévia — assistir, **Refazer** ou **Usar este** (wireframe `gravacao-previa`). Por blocos: "Próximo bloco" até acabar; lista de blocos permite refazer só um.
4. **Aprovar** (wireframe `aprovar`) — confirma, marca o projeto como gravado, mostra o aviso.

Por blocos: cada bloco do script (abertura, trechos, fechamento) é uma gravação separada. Take único: uma gravação do script inteiro.

## Dados
Migration `0010_recordings.sql` (aplicada em produção só após dry-run + sim do usuário):
- Bucket privado `recordings`, `file_size_limit` 50 MB, tipos `video/mp4` e `video/webm`; objetos em `{auth.uid()}/{project_id}/{recording_id}.{ext}`; policy própria como a do bucket `sources`.
- Tabela `recordings`: `id`, `user_id`, `project_id`, `kind` (`take` | `block` | `external`), `block_id` (nulo exceto em `block`), `storage_path`, `mime`, `duration_seconds`, `size_bytes`, `status` (`uploading` | `ready`), `created_at`. RLS: dono lê e escreve as próprias linhas. Uma linha `ready` ativa por (`project_id`, `block_id`) — refazer substitui a anterior (apaga o arquivo antigo).
- `projects.status`: novo valor `gravado` (a rota `/gravar` continua sendo a próxima etapa até aprovar). `nextStepHref` e a lista de Projetos passam a mostrar "Gravado".
- Aprovar = ação de servidor que confere se há gravação `ready` para o modo (take único; ou todos os blocos) e muda o status.

## Gravação no navegador
- `getUserMedia` frontal, vertical, 720×1280 ideal, áudio com cancelamento de eco desligado.
- `MediaRecorder` com escolha de formato por `isTypeSupported`: `video/mp4` (Safari/iOS) → `video/webm;codecs=vp9,opus` → `video/webm`. Bitrate fixo: vídeo 1,8 Mbps + áudio 96 kbps.
- Blocos de dados (`timeslice` 1 s) vão também para o IndexedDB; se a aba fechar ou o envio falhar, a gravação é recuperada e reenviada.
- Teleprompter: rolagem por `requestAnimationFrame` com velocidade em palavras/min (cálculo puro, testável); contagem; pausa não pausa a gravação, só o texto. Ajustes em `localStorage`.

## Envio
- Upload resumível (tus, `tus-js-client`) direto para o endpoint do Supabase Storage com o token da sessão; progresso e nova tentativa automática.
- Linha em `recordings` nasce `uploading` e vira `ready` ao fim do envio.
- Vídeo de fora: mesmo caminho, `kind=external`; lê duração com um elemento `<video>`; recusa acima de 50 MB com mensagem clara ("Este vídeo passa de 50 MB. Grave por blocos no app ou reduza o tamanho antes de enviar.").

## Limite de tamanho (plano gratuito)
Com 1,8 Mbps + 96 kbps, 50 MB cabem ~200 s. Regras:
- Take único só para vídeos de até **3 min**; o limite é aplicado cortando a gravação em 200 s com aviso aos 180 s.
- Vídeo de 5 min: só por blocos (cada bloco é curto). Os cards de escolha mostram o porquê.
- Se o projeto passar para o plano Pro, o limite sobe numa migration (bucket) e a regra é uma constante.

## Erros e casos de borda
- Sem permissão de câmera/microfone: tela explicando como liberar, sem travar o app.
- Navegador sem `MediaRecorder`: oferece só "Enviar vídeo feito fora".
- Sem rede: a gravação continua e fica no aparelho; envio retoma quando voltar.
- Script mudou depois de gravar (`script_stale`): aviso na tela Gravar; gravações existentes não são apagadas.
- Sessão expirada no meio do envio: renova o token e retoma.

## Testes
- Unit: escolha de formato, cálculo de rolagem, limite de duração por bitrate, regras de aprovação (take completo / todos os blocos), validação de arquivo externo.
- Integration (Supabase local): RLS de `recordings` e do bucket (dono lê/grava; outro usuário não), refazer substitui.
- E2E (Playwright, Chromium com câmera falsa `--use-fake-device-for-media-stream`): gravar 3 s em take único, ver prévia, enviar, aprovar; por blocos refazendo um bloco; subir arquivo pequeno de fora; recusar arquivo > 50 MB.
- Manual (usuário, celular de verdade): iPhone/Safari e Android/Chrome, gravar 1–2 min com a internet oscilando.

## Estrutura de arquivos (prevista)
```
src/app/(app)/projetos/[id]/gravar/{page.tsx,teleprompter/page.tsx,aprovar/page.tsx}
src/components/record/{ModeCards,Prompter,PrompterSettings,Preview,BlockList,UploadStatus}.tsx (+css)
src/lib/record/{mime.ts,limits.ts,scroll.ts,store.ts (IndexedDB),upload.ts (tus),actions.ts}
supabase/migrations/0010_recordings.sql
tests/unit/record-*.test.ts, tests/integration/recordings.test.ts, e2e/gravar.spec.ts
```
Visual: `DESIGN.md` (Teleprompter, Regra do Vidro no Estúdio, `rec-bg`, `sun`, `rec-red`).

## Pontos em aberto
- Confirmar no celular real a qualidade a 1,8 Mbps; se ficar fraca, a saída é subir de plano (e o bitrate), não mexer na arquitetura.
- Descartar gravações antigas (retenção de 30 dias) fica para o Plano 3.
