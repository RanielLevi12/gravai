# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) na Vercel, PWA mobile-first; Supabase (auth, banco, storage); worker ffmpeg em container (Railway/Fly). IA: gpt-6-luna (texto), claude-haiku-5-5 (OCR), jev (ranking/checagens), transcrição OpenAI. Detalhes em `docs/spec.md`.

## Users

Criador de conteúdo iniciante: quer crescer nas redes, posta com frequência, pouca técnica de vídeo e de roteiro. Usa principalmente o celular, muitas vezes gravando sozinho em casa.

## Product Purpose

Levar o criador do material bruto (foto de página de livro, PDF, documento, texto, áudio com uma ideia) até o post pronto: script escrito para a duração e as plataformas certas, gravação com teleprompter, vídeo principal + cortes + capas + descrições organizados em pastas. Sucesso = o usuário grava e publica sem abrir outro app de roteiro ou edição.

## Positioning

Do material ao post, num lugar só. Começa antes do vídeo existir (no livro ou na ideia), escreve o script já pensando nos cortes, grava e entrega tudo organizado. Ferramentas de corte (Opus Clip) começam do vídeo pronto; teleprompters avulsos não escrevem; editores (CapCut) exigem técnica.

## Operating Context

- Fluxo: entrada → entrevista (uma pergunta por tela, sugestão pré-marcada) → script em blocos → teleprompter/gravação vertical 9:16 → aprovação → processamento em segundo plano → pasta do projeto com cortes.
- Gravação com câmera frontal, celular apoiado ou na mão, ambientes de luz variada.
- Plataformas de destino: YouTube, Reels, Feed Instagram, Facebook, TikTok, X.
- Protótipo de fluxo aprovado: `docs/ux-flows/` (30 telas wireframe).

## Capabilities and Constraints

- Interface em pt-BR; script no idioma do conteúdo.
- Grátis no lançamento com limite (5 projetos/mês, 60 min de transcrição); cobrança depois.
- Vídeos retidos 30 dias; textos permanentes.
- Gravação no navegador (MediaRecorder) — Safari/iOS tem limites; upload resumível.
- Fase 2: teleprompter que segue a voz, geração de imagem de capa no app, planos pagos, Google Drive.

## Brand Commitments

- Nome provisório: "Video Facil".
- Visual pedido pelo usuário: bonito, colorido, com bom gosto — cores vivas e bem trabalhadas (não tímido, não neutro corporativo).
- Preferência registrada (2026-10-13): padrão da categoria executado com capricho, sem metáfora de mundo; régua de acabamento = Canva. Sem roxo de IA.
- Evitar: cara de ferramenta técnica, infantil/gamificado, genérico de IA (gradiente roxo, neon), sério/corporativo.
- App claro e vibrante; gravação/teleprompter em tela escura.

## Evidence on Hand

Nenhum depoimento, cliente, métrica ou logo. Não inventar números de uso, avaliações ou clientes.

## Product Principles

1. Responder, não configurar: toda escolha vem com sugestão pré-marcada; o caminho padrão é tocar "Próxima".
2. O corte nasce no script: planejamento acontece antes de gravar, não na edição.
3. Nunca perder trabalho: rascunho salvo sempre, gravação por blocos, upload que retoma.
4. Celular primeiro, uma mão: ações principais ao alcance do polegar.
5. Entregar pronto para postar: cada item sai com vídeo, capa e descrição por plataforma.

## Accessibility & Inclusion

WCAG 2.2 AA (assumido, sem requisito específico confirmado). Contraste do texto do teleprompter sobre câmera em qualquer luz.
