# Gravaí — plano de evolução (gravação → qualidade/armazenamento → agentes → telas → edição IA → publicação)

## Contexto

O Raniel testou o app e ele funciona, mas não do jeito que ele pensa. Objetivo: menos atrito e diferenciais competitivos.
O diagnóstico no código (17/10/2026) mostrou:

- **Zoom na câmera:** `src/lib/record/capture.ts:17-34` pede à câmera uma imagem em pé (720×1280 / 1080×1920). A câmera é deitada, então o navegador corta uma faixa do meio. O preview corta de novo (`record.module.css:69`, `object-fit: cover`). Já o worker faz `pad` com barras pretas (`worker/src/render.ts:14`), então o vídeo final é diferente do preview.
- **Qualidade ruim:** o worker recomprime tudo a no máximo 1,8 Mbps (`worker/src/plan.ts:4-8,34-37`, `MAX_FILE_BYTES` = 50 MB, `-preset veryfast` com bitrate constante). Os cortes são recomprimidos duas vezes (`render.ts:142-157`, `recut.ts:43`). A qualidade padrão é Normal (720p, aumentado para 1080p).
- **Controles:** 13 opções num só painel (`PrompterSettings.tsx` + `CaptureSettings.tsx`), misturando câmera e texto.
- **Edição:** não existe. Hoje é só ffmpeg: juntar, `loudnorm`, cortar, capa.
- **Publicação:** não existe (só download/zip).
- **IA:** OpenRouter da conta de cada usuário (`src/lib/ai/index.ts:49-70`). O jev revisa os hooks (`src/lib/ai/typesafe.ts`). O CTA é texto fixo.
- **Storage:** Supabase (buckets `recordings`/`exports`), finais apagados em 30 dias.
- **Infra:** worker na VPS Hostinger (1 CPU / 3,8 GB, dividida com o PastorAI; container com 0,6 CPU e 1 GB), um job por vez. **O app nunca foi publicado na Vercel**, e o worker da VPS está desatualizado.

Pesquisa externa (resumo):
- A Anthropic **proíbe** apps de terceiros usarem o login da assinatura Claude; só com chave de API.
- O "Sign in with ChatGPT" com uso do plano existe desde o DevDay (29/09/2026), mas só para parceiros aprovados, via [formulário](https://openai.com/form/sign-in-with-chatgpt-interest/).
- Claude Code e Codex não editam vídeo sozinhos: eles comandam ffmpeg/Remotion.
- A OpenRouter aceita vídeo como entrada (`video_url`) e transcrição.

## Decisões tomadas (grill de 17/10/2026)

| Tema | Decisão |
|---|---|
| Ordem | Gravação primeiro; **1 fase por sessão** |
| IA | Chave OpenRouter **do app** por padrão, com limite mensal por usuário; a conexão da própria conta continua opcional. Preencher o formulário do Sign in with ChatGPT em paralelo |
| Servidor | **Manter a VPS atual** → edição só com ffmpeg ("leve"), lenta (~5–10 min/min de vídeo) |
| Enquadramento | O que aparece na tela = o vídeo final |
| Configuração | **Automático ligado por padrão**; manual em "Avançado" |
| Motion | Leve: legenda palavra a palavra, zoom de ênfase, título/textos na tela |
| Armazenamento | **Cloudflare R2**, guardado até o usuário apagar, com cota por conta (ex.: 5 GB grátis) |
| Tela inicial | Botão único "Criar vídeo" → "Continue de onde parou" (3) → lista de projetos (+ "Sem projeto" fixo) |
| Publicação | **Zernio** (confirmar preço e OAuth com a marca Gravaí antes de construir) |
| Agentes | Base geral + estilo por projeto; a IA escreve a conclusão + CTA a partir do objetivo salvo; treino = guia + exemplos + nota do jev + bateria de testes; 3 hooks e 3 títulos com nota, o melhor pré-marcado |
| Silêncio | "Natural" (>0,7 s, tira "é…", "tipo…" e repetições), opção "Rápido" (>0,3 s) |
| Prévia | Instantânea no celular (sem render); a VPS só renderiza no "Gerar vídeo final" |
| Cortes | Herdam a edição do principal |
| Pendências antigas | Deploy → Fase 2; CTA dos cortes → Fase 3; botões do script e cards da conferência → Fase 4 |

---

## Fase 1 — Gravação (próxima sessão)

**Meta:** sem zoom, imagem nítida, controles simples, configuração automática. Comprovado com números reais, não "parece melhor".

1. **Pedir a imagem inteira da câmera** (`src/lib/record/capture.ts`)
   - Não pedir mais `width < height`. Ler `track.getCapabilities()`, pedir a maior resolução nativa (até 1920 no lado maior) com `resizeMode: "none"` e `zoom` no mínimo, se houver.
   - Ler o tamanho real com `track.getSettings()`.
   - Se o quadro vier deitado, gravar inteiro e salvar o **retângulo de corte 9:16 central** na gravação (nova coluna `crop` em `recordings`, migração 0013). Se vier em pé (celular), corte nulo.
2. **Preview = final** (`record.module.css`, `TeleprompterScreen.tsx`)
   - Uma moldura 9:16 com `object-fit: cover` faz o mesmo corte central que o worker vai fazer.
   - No worker, trocar `pad` por `crop` com o mesmo retângulo (`worker/src/render.ts:14`).
3. **Configuração automática** (novo `src/lib/record/autoconfig.ts`)
   - Ler as câmeras (`enumerateDevices`), as capacidades, os formatos aceitos (`MediaRecorder.isTypeSupported`, preferir `video/mp4;codecs=avc1,mp4a` e depois `webm;vp9,opus`), `deviceMemory`, `hardwareConcurrency` e a rede (`navigator.connection`).
   - Escolher câmera traseira/frontal, resolução (1080p com ~6–8 Mbps se aguentar, senão 720p com ~4 Mbps), áudio a 128 kbps e o microfone.
   - Guardar o perfil por aparelho (localStorage com try/catch). Selo na tela: "Automático · 1080p".
   - Ajustar `src/lib/record/limits.ts` e `mime.ts`. O tempo máximo é calculado a partir de 500 MB ÷ bitrate.
4. **Áudio:** separar os controles. Supressão de ruído ligada; `autoGainControl` e `echoCancellation` decididos pelo perfil (voz única → eco desligado).
5. **Controles simples**
   - Na tela: Fechar, tempo, Gravar, Virar câmera, Velocidade do texto e Ajustes.
   - O painel ganha 2 abas, **Texto** e **Câmera**. Na aba Câmera, só "Automático (ligado)" e um "Avançado" fechado com os ajustes manuais e uma **"Info técnica"** (resolução real, fps, codec, bitrate). É a prova de que não está mascarado.
6. **Testes**
   - Atualizar `tests/unit/record-capture.test.ts`, `record-recorder.test.ts`, `record-mime.test.ts` e `record-limits.test.ts`, com novos testes de `autoconfig`.
   - Rodar `e2e/gravar.spec.ts`. A câmera falsa não pega o crop: o teste real é no celular do Raniel, comparando a "Info técnica" e um vídeo antes/depois.

## Fase 2 — Qualidade no worker + R2 + deploy

- **Worker**
  - Codificar com `-crf 20 -preset faster` (por causa da CPU fraca), `-maxrate 8M`, áudio 128k.
  - Tirar o teto de 50 MB (`worker/src/plan.ts`).
  - Cortes a partir de um intermediário de alta qualidade, não do `final.mp4`.
  - Upload em stream (`worker/src/storage.ts:20-21` hoje lê tudo na memória).
- **R2**
  - Novo módulo de storage com API S3 (`@aws-sdk/client-s3`): upload multipart com URLs assinadas pelo navegador, no lugar do tus (`src/lib/record/upload.ts`), e download por URL assinada (`src/lib/delivery/service.ts`).
  - Tabela de uso por usuário com a cota mostrada na tela.
  - O `purge.ts` passa a apagar só o que o usuário apagou.
  - **Feito em 17/10:**
    - Bucket `gravai-videos` (conta Cloudflare "Rvstecnologia's Account", privado, Standard) criado.
    - CORS liberado para `http://localhost:3000` e `https://gravai-bice.vercel.app`: GET/PUT/HEAD, cabeçalhos `*`, expõe `ETag`. Ao ganhar um domínio novo, adicionar a origem no CORS.
  - **Variáveis** (no `.env.local` e na Vercel; o código só lê pelos nomes): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=gravai-videos`. Endpoint: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.
  - **Ação do Raniel:** criar o token R2 (Object Read & Write só nesse bucket) e colar as chaves (eu não manuseio as chaves).
- **Deploy:** app na Vercel (`APP_URL` no worker) e worker atualizado na VPS. Cada passo com o "sim" do Raniel.

## Fase 3 — Pesquisa "cérebro do roteiro" + agentes + IA do app

- **Pesquisa profunda** (skill `anthropic-skills:deep-research`) sobre storytelling, estrutura de vídeo curto/longo, tipos de hook (verbal + visual + texto), retenção, escrita sem "slop" (lista de frases e vícios proibidos em pt-BR), títulos, conclusão e CTA. Fontes citadas.
  - Sai em `docs/conhecimento/roteiro.md` e vira o guia carregado pelos prompts.
- **Agentes** em `src/lib/ai/agents/`:
  - `titulos`, `hooks` e `conclusao-cta`: 3 opções de tipos diferentes, com nota do jev (reaproveitar `src/lib/ai/typesafe.ts` e `src/lib/script/review.ts`) e refazer o que vier fraco.
  - O `SCRIPT_SYSTEM` (`src/lib/script/prompts.ts`) passa a usar o guia.
  - O estilo do projeto (tom, público, exemplos) entra em `folders.settings`.
  - **CTA dos cortes** apontando para o vídeo principal ou para outro corte (`src/lib/script/cuts-generate.ts`).
- **Bateria de testes:** `tests/evals/` com ~20 fontes de exemplo, nota média antes/depois.
- **IA do app:** usar a chave do servidor por padrão, com limite mensal em `ai_usage`. A OAuth/chave do usuário fica opcional (`src/lib/ai/index.ts`).

## Fase 4 — Tela inicial e telas pendentes

- `src/app/(app)/projetos/page.tsx` e `projetos.module.css`: botão único "Criar vídeo", que pergunta se o vídeo vai num projeto ou fica solto e depois a origem. Abaixo, "Continue de onde parou" (3 itens com o status) e a lista de projetos com capa, quantidade e "Sem projeto" fixo.
- Pendência 2: botões de edição rápida e "voltar à versão anterior" por trecho, com o nome do trecho destacado na tela do script.
- Pendência 3: na tela de conferência, cards por fase (vídeo × projeto).

## Fase 5 — Edição com IA (leve, ffmpeg)

- **Plano de edição (JSON)** gerado no app a partir da transcrição com tempos por palavra, que já existe (`transcripts`, Whisper via OpenRouter):
  - trechos a remover (silêncio "natural"/"rápido", "é…", repetições detectadas pelo LLM);
  - pontos de zoom de ênfase (LLM);
  - legendas por palavra;
  - textos na tela;
  - ajuste de luz (medido com `signalstats` → `eq`/`curves`);
  - áudio (`highpass` + `afftdn` + `loudnorm`).
- **Tela de edição:** botão "Editar com IA" e interruptores para cada item (Silêncio, Legenda + estilo, Zoom, Luz, Áudio, Textos). A **prévia instantânea** no celular pula os trechos e mostra legenda/zoom por CSS.
- **Render final** em um passo de ffmpeg no worker (legendas ASS com libass; zoom por `crop`/`scale` com tempo), com novo tipo de job `edit` na `jobs`. Os cortes saem do vídeo editado.

## Fase 6 — Publicação (Zernio)

- Antes: confirmar o preço, os limites e o OAuth com a marca Gravaí na documentação do Zernio.
- Conectar contas (YouTube, Instagram, TikTok, Facebook, X), publicar agora ou agendar o principal e os cortes, usando as descrições por plataforma que já existem, e acompanhar o status no app.

---

## Verificação (todas as fases)

- `npm test` (vitest) e os testes do worker (`worker/test/`) passando; e2e Playwright das telas mexidas.
- Fase 1: teste no celular real do Raniel.
  - A "Info técnica" precisa mostrar a resolução nativa (ex.: 1920×1080 → corte 1080×1920, sem zoom).
  - O preview precisa ser igual ao vídeo final.
  - Vídeo antes/depois lado a lado.
- Fase 2: `ffprobe` no arquivo final mostra a resolução, o bitrate e o tamanho esperados.
- Fases 3 e 5: a nota média da bateria de testes sobe; prévia × final conferidos.
- Cada fase termina com commit, a lista do que ficou pronto, o que falta e o prompt da próxima sessão.
