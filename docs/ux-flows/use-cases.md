# Casos de uso — Video Facil

Fonte: [docs/spec.md](../spec.md)

## UC-001 — Entrar e configurar perfil
- **Atores**: Usuário, Supabase Auth
- **Pré-condições**: nenhuma
- **Fluxo principal**:
  1. Abre o app → tela de boas-vindas.
  2. Entra com Google ou recebe link mágico por e-mail.
  3. Primeiro acesso → onboarding curto (3 telas): nicho e público, tom de voz (+ exemplos de frases, opcional), CTAs (link, bio, WhatsApp, telefone — opcional).
  4. Cai na tela inicial (Projetos).
- **Alternativos**: pular onboarding (preenche depois em Perfil); link mágico expirado → reenviar.
- **Pós-condições**: perfil criado; app instalável (convite PWA).

## UC-002 — Criar projeto a partir de material
- **Atores**: Usuário, Sistema (OCR haiku, transcrição OpenAI)
- **Pré-condições**: logado, dentro do limite mensal
- **Fluxo principal**:
  1. Toca "Novo vídeo".
  2. Escolhe entrada: Câmera (foto) · Colar texto · Arquivo (PDF/DOCX/PPTX/TXT/imagem) · Link Google Docs · Gravar áudio.
  3. Sistema extrai texto (progresso visível).
  4. Revisa/edita texto-fonte → "Continuar".
- **Alternativos**: várias fotos em sequência (páginas); OCR ilegível → aviso + refazer foto; link de Docs não público → instrução para compartilhar; limite atingido → aviso com contador.
- **Pós-condições**: projeto com texto-fonte salvo (rascunho).

## UC-003 — Entrevista do vídeo
- **Atores**: Usuário, Sistema (gpt-6-luna, jev)
- **Pré-condições**: projeto com texto-fonte
- **Fluxo principal** (uma pergunta por tela, barra de progresso, sugestão pré-marcada):
  1. Plataformas (multi).
  2. Isolado ou série → série: lista de episódios proposta, remove/reordena.
  3. Duração do vídeo principal.
  4. Cortes sim/não → duração do corte (opções inválidas desabilitadas com motivo).
  5. Cenário: natural ou IA (prompt + copiar).
  6. Títulos sugeridos (ranqueados) → escolhe/edita.
  7. Capa: prompt IA ou frame + título.
  8. CTA do perfil ou "sem CTA".
  9. Resumo → "Gerar script".
- **Alternativos**: voltar a qualquer pergunta pelo resumo; sair e continuar depois (rascunho salvo).
- **Pós-condições**: respostas salvas; script em geração.

## UC-004 — Revisar e editar script
- **Atores**: Usuário, Sistema (gpt-6-luna)
- **Pré-condições**: entrevista concluída
- **Fluxo principal**:
  1. Vê script em blocos; blocos-corte marcados com selo (duração, título).
  2. Edita texto direto ou toca "Reescrever" → escolhe ajuste (mais curto, mais direto, mais emocional).
  3. "Gravar".
- **Alternativos**: regerar script inteiro; duração estimada estoura a escolhida → aviso.
- **Pós-condições**: script final salvo.

## UC-005 — Gravar com teleprompter
- **Atores**: Usuário, Navegador (câmera/microfone)
- **Pré-condições**: script final; permissão de câmera
- **Fluxo principal**:
  1. Escolhe modo: take único ou por blocos. Ou "Subir vídeo gravado fora".
  2. Ajustes rápidos (painel): velocidade, fonte, tamanho, cor, opacidade, posição, margem, espelhar.
  3. Toca gravar → 3-2-1 → texto rola; toque pausa.
  4. Para → prévia → "Usar" ou "Refazer" (no modo blocos, por bloco).
  5. Upload resumível em segundo plano.
- **Alternativos**: permissão negada → instrução; upload interrompido → retoma; aba fechada no meio → blocos já enviados preservados.
- **Pós-condições**: gravação(ões) no storage.

## UC-006 — Aprovar e gerar entregáveis
- **Atores**: Usuário, Worker (ffmpeg, transcrição)
- **Pré-condições**: gravação completa
- **Fluxo principal**:
  1. Assiste vídeo final → "Aprovar e gerar cortes".
  2. Progresso por etapa: juntando, transcrevendo, cortando, criando capas.
  3. Notificação ao concluir.
- **Alternativos**: corte com início/fim ruim → ajuste manual (arrastar); falha no job → tentar novamente.
- **Pós-condições**: vídeo principal, cortes, capas e descrições prontos.

## UC-007 — Baixar e organizar (pastas)
- **Atores**: Usuário
- **Pré-condições**: entregáveis prontos
- **Fluxo principal**:
  1. Pasta do projeto: vídeo principal + lista de cortes (subpastas).
  2. Em cada item: Baixar vídeo · Copiar descrição (por plataforma) · Baixar capa · Copiar prompts.
  3. "Baixar tudo (.zip)".
- **Alternativos**: vídeo expirado (30 dias) → só textos disponíveis, aviso.
- **Pós-condições**: material baixado.
