# Video Facil — Especificação do MVP

> Nome provisório. Fechado em entrevista de 2026-10-13.

## 1. Produto

SaaS web (PWA, mobile-first) que transforma qualquer material em script de vídeo, grava com teleprompter e entrega vídeo principal + cortes + capas + descrições organizados em pastas.

- Público aberto, grátis no lançamento, cobrança depois.
- Limite grátis inicial: 5 projetos/mês e 60 min de transcrição/mês por conta (ajustar com dados reais).
- Interface em pt-BR; script gerado no idioma do conteúdo de entrada.

## 2. Stack

| Camada | Escolha |
|---|---|
| Front + API | Next.js (App Router) na Vercel, PWA instalável |
| Login, banco, storage | Supabase (Google + link mágico por e-mail) |
| Processamento de vídeo | Worker ffmpeg em container (Railway ou Fly), fila via tabela `jobs` no Supabase |
| Upload | Resumível (tus, suportado pelo Supabase Storage) — vídeos de centenas de MB |

### IA (conta do próprio usuário via OpenRouter — nunca login de assinatura pessoal)

Decisão de 13/10/2026: cada usuário conecta a própria conta OpenRouter por login (OAuth PKCE, botão "Conectar sua IA"); o app recebe uma chave cobrada na conta do usuário, guardada cifrada no servidor. No piloto, a conta conectada é a do dono. Login de assinatura do ChatGPT/Claude não é usado (termos de uso).

| Tarefa | Modelo | Provedor |
|---|---|---|
| Script, títulos, descrições, prompts de cenário/capa, divisão em série, reescrever trecho | `openai/gpt-6-luna` | OpenRouter (conta do usuário) |
| OCR de foto de livro, PDF escaneado, slide em imagem | `anthropic/claude-haiku-5.5` | OpenRouter (conta do usuário) |
| Ranking de títulos virais, checagem de regras (cortes, tom, CTA) | `jev-latest` | TypeSafe (chave do Gravaí) |
| Transcrição de áudio de ideia (Plano 1) | modelo com entrada de áudio (`google/gemini-3.8-flash`, trocável) | OpenRouter (conta do usuário) |
| Transcrição do vídeo gravado com timestamps por palavra (Plano 3) | whisper local no worker | worker |

Chaves (a do usuário cifrada, a TypeSafe) ficam só no servidor.

## 3. Fluxo

### 3.1 Entrada
Uma tela, várias formas:
- Câmera do celular (foto de página) ou upload de imagem → OCR (haiku). Várias fotos em sequência = várias páginas.
- Colar texto.
- Upload: PDF (texto extraído; se escaneado → OCR), DOCX, PPTX, TXT.
- Google Docs: link público (export via URL) ou arquivo exportado. Sem OAuth Google.
- Áudio: gravar ideia no app ou subir arquivo → transcrição.

Resultado: texto-fonte editável antes de seguir.

### 3.2 Perfil (cadastrado uma vez, editável)
- Nicho, público, tom de voz (sério, descontraído, pastoral, técnico…), exemplos de frases.
- CTAs salvos: link, bio, WhatsApp, telefone.

### 3.3 Entrevista
Uma pergunta por tela, cartões clicáveis, sugestão da IA pré-marcada. Ordem:

1. **Plataformas** (multi): YouTube, Reels, Feed Instagram, Facebook, TikTok, X → define quais capas e descrições gerar.
2. **Isolado ou série**. Série: IA propõe N episódios com tema; usuário remove/reordena. Cada episódio = um projeto.
3. **Duração do vídeo principal**: 30s, 60s, 3 min, 5 min, 10 min+. Script calculado a ~150 palavras/min.
4. **Cortes**: sim/não; duração 10, 20, 30 ou 60s. Regra: corte < metade do vídeo principal (vídeo < 60s → cortes ≤ 30s). Opções inválidas aparecem desabilitadas.
5. **Cenário**: natural (sugestão descrita) ou IA (prompt com botão copiar).
6. **Títulos virais**: sugestões por vídeo e por corte, ranqueadas (jev); usuário escolhe ou edita.
7. **Capa**: prompt de IA (copiar) ou frame do vídeo + título por cima.
8. **CTA**: escolhe um CTA do perfil ou "sem CTA".

### 3.4 Script
- Gerado após a entrevista. Começa sempre pelo vídeo completo.
- Estruturado em **blocos**; cada bloco planejado para virar corte tem gancho próprio e funciona sozinho.
- Cada bloco carrega: texto, duração estimada, título do corte, descrição, prompt de capa.
- Edição livre + botão "reescrever este trecho" (mais curto, mais emocional, mais direto…).

### 3.5 Gravação
- Sempre vertical 9:16.
- Usuário escolhe: **take único** ou **por blocos** (refaz só o bloco errado).
- Alternativa: subir vídeo gravado fora do app (câmera nativa).

Teleprompter (MVP):
- Texto sobreposto à câmera frontal, posicionado perto da lente (ajustável: topo/meio).
- Velocidade ajustável antes e durante a gravação; toque pausa/retoma.
- Tamanho e família da fonte, cor do texto, opacidade do fundo, largura da margem.
- Espelhar texto, contagem 3-2-1, linha-guia de leitura.
- Fase 2: rolagem que acompanha a voz.

### 3.6 Aprovação e processamento (worker)
Usuário assiste e aprova → worker:
1. Junta blocos (modo blocos) ou transcreve o take único com timestamps.
2. Localiza início/fim de cada corte (blocos = direto; take único = alinhamento texto do bloco ↔ transcrição).
3. Recorta vídeos curtos.
4. Gera capas por frame + título (tamanho por plataforma).
5. Monta descrições finais (com CTA) por plataforma.

### 3.7 Entrega — pastas
```
<Projeto>/
  video-principal.mp4
  capa-<plataforma>.png
  descricao-<plataforma>.txt
  prompts.txt            (cenário + capa)
  cortes/
    01-<titulo>/
      corte.mp4
      capa.png
      descricao.txt      (descrição + prompt de capa)
```
- Organizado no app; cada item com botões **baixar vídeo**, **copiar descrição**, **baixar capa**.
- "Baixar tudo" gera .zip com essa estrutura.

### 3.8 Retenção
Vídeos e capas: 30 dias (aviso antes de apagar). Textos (script, títulos, descrições, prompts): permanentes.

## 4. Modelo de dados (rascunho)

- `profiles` — usuário, nicho, público, tom, exemplos, uso do mês.
- `ctas` — perfil_id, tipo, valor, rótulo.
- `series` — opcional, agrupa projetos.
- `projects` — fonte (texto), respostas da entrevista (jsonb), status.
- `script_blocks` — projeto_id, ordem, texto, duração, é_corte, título, descrição, prompt_capa.
- `recordings` — projeto_id, bloco_id (nulo = take único), storage_path, aprovado.
- `outputs` — projeto_id, bloco_id, tipo (video/capa/descricao), plataforma, storage_path, expira_em.
- `jobs` — fila do worker: tipo, payload, status, erro.

RLS em todas as tabelas: usuário só vê o que é dele.

## 5. Fases

- **MVP**: tudo acima.
- **Fase 2**: teleprompter que segue a voz, geração de imagem de capa dentro do app, cobrança e planos, integração Google Drive.

## 6. Riscos conhecidos

- Gravação longa no Safari/iOS: formato varia (MP4/H.264 vs WebM) e a gravação pode se perder se a aba fechar → modo por blocos e upload de vídeo externo mitigam; worker normaliza formato.
- Custo de storage de vídeo → retenção de 30 dias + limite grátis.
- Alinhamento de cortes no take único depende da fala seguir o script → permitir ajuste manual de início/fim do corte.
