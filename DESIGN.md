---
name: Video Facil
description: Do material ao post, num lugar só — app de criação claro e vibrante, com a gravação no escuro.
colors:
  primary: "#E11D55"
  primary-press: "#C3134A"
  primary-tint: "#FFE4EC"
  tangerine: "#FF7A00"
  sky: "#1E9BFF"
  mint: "#12B76A"
  sun: "#FFC21A"
  sky-tint: "#E1F1FF"
  sky-ink: "#0C3C66"
  mint-tint: "#DDF6EA"
  mint-ink: "#08643A"
  ink: "#15161C"
  ink-2: "#555867"
  bg: "#FFFFFF"
  surface: "#F4F5F9"
  surface-2: "#ECEEF4"
  line: "#E3E5EC"
  line-strong: "#C9CCD8"
  rec-bg: "#0C0D12"
  rec-red: "#FF3B30"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline-sm:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  numeral:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  title-ui:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  body-script:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  prompter:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  label-button:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
  meta:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  caption:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  pill: "999px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    typography: "{typography.label-button}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.primary-press}"
  button-soft:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label-button}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "56px"
  button-soft-hover:
    backgroundColor: "{colors.surface-2}"
  button-next:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "38px"
  button-mini:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "10px"
    padding: "0 12px"
    height: "34px"
  icon-button:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "28px"
  chip-saved:
    backgroundColor: "{colors.mint-tint}"
    textColor: "{colors.mint-ink}"
    rounded: "{rounded.pill}"
    height: "28px"
  option-card:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "18px 16px 16px"
  option-card-selected:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.ink}"
  badge-suggested:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  platform-toggle:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  platform-toggle-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
  block:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-script}"
    rounded: "{rounded.md}"
    padding: "14px 16px 12px"
  block-cut:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px 12px"
  tag-cut:
    textColor: "{colors.ink}"
    rounded: "{rounded.xs}"
    padding: "0 10px"
    height: "26px"
  project-card:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "14px"
  cover-poster:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "14px"
  cover-placeholder:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
  tab-new:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "20px"
    size: "60px"
  explainer:
    backgroundColor: "{colors.sky-tint}"
    textColor: "{colors.sky-ink}"
    rounded: "{rounded.sm}"
    padding: "14px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  prompter:
    backgroundColor: "{colors.rec-bg}"
    textColor: "{colors.bg}"
    typography: "{typography.prompter}"
    rounded: "{rounded.lg}"
    padding: "18px 20px 20px"
---

# Design System: Video Facil

## Overview

**Creative North Star: "O Estúdio de Bolso"**

Video Facil é um app de criação no padrão da categoria, executado com acabamento nível Canva: cada tela tem uma única próxima ação óbvia, e as cores vivas significam alguma coisa. Fundo branco, seções em cinza-frio muito claro, tinta quase preta; o coral-magenta aparece só onde está a ação principal da tela. O resto do arco-íris (tangerina, céu, menta, sol) não decora: ele numera os cortes do vídeo, sempre na mesma ordem.

A densidade é de celular com uma mão: blocos grandes e arredondados, alvos de 44 a 60px, botão principal ancorado no rodapé ao alcance do polegar. Títulos em grotesca expressiva e amigável (Bricolage Grotesque) dão personalidade; a interface em grotesca humanista (Hanken Grotesk) fica quieta e legível. Sombras são suaves e difusas, com leve deslocamento para baixo; nada de sombra dura.

O app é claro e vibrante; a gravação vira um estúdio escuro quase preto, onde o único destaque é a linha atual do teleprompter em amarelo-sol. O sistema recusa o editor escuro com gradiente roxo de IA, o painel cheio de opções, a cara de ferramenta técnica, o visual infantil/gamificado e o corporativo sério.

**Key Characteristics:**
- Uma ação primária coral-magenta por tela; todo o resto é neutro ou tinta.
- Cores vivas de apoio = código dos cortes, em sequência fixa, sempre em campos sólidos.
- Texto sobre cor viva é tinta, nunca branco.
- Cantos generosos (12 a 24px), sombras suaves, superfícies brancas sobre cinza-frio.
- Gravação em quase-preto com a linha atual em sol.
- Números de tempo sempre com algarismos tabulares.

## Colors

Paleta clara de alto contraste: neutros frios, um primário quente e quatro cores vivas reservadas a um único código.

### Primary
- **Coral-Magenta** (`primary`): a ação principal da tela e só ela — botão de rodapé ("Próxima", "Gravar", "Baixar vídeo"), painel "Novo vídeo", botão central da barra de abas, check da opção marcada, etapa atual na trilha de progresso. Texto branco sobre ele (contraste 4,66:1).
- **Coral Pressionado** (`primary-press`): hover/pressão do botão primário.
- **Rosa-Clarinho** (`primary-tint`): fundo da opção selecionada na entrevista; seleção de texto.

### Secondary
As quatro cores de corte, sempre nesta ordem: **Tangerina** (`tangerine`) = corte 1, **Céu** (`sky`) = corte 2, **Menta** (`mint`) = corte 3, **Sol** (`sun`) = corte 4; a partir do 5º a sequência recomeça. Aparecem como borda do bloco de corte no script, etiqueta "Corte N", miniatura numerada na pasta e barrinhas de corte nas opções de duração.

### Tertiary
Pares tinta-clara + tinta-escura para estados do sistema, nunca como campo sólido vivo:
- **Céu-Claro / Céu-Profundo** (`sky-tint` / `sky-ink`): caixa de explicação ("por que marcamos essa opção"). `sky` sólido também é o anel de foco (3px, offset 2px).
- **Menta-Clara / Menta-Profunda** (`mint-tint` / `mint-ink`): confirmação ("Salvo"); `mint` colore o ícone de sucesso no toast.

### Neutral
- **Tinta** (`ink`): texto principal; fundo de botões secundários de ação (próxima ação no card, selo "Sugerido", toast); estado selecionado de plataforma; etapas concluídas.
- **Tinta Média** (`ink-2`): texto de apoio, meta, durações, chips neutros, abas inativas (7,05:1 no branco).
- **Branco** (`bg`): fundo do app e dos cards.
- **Cinza-Frio** (`surface`) e **Cinza-Frio 2** (`surface-2`): seções, blocos sem corte, botão suave, trilhas vazias.
- **Linha** (`line`) e **Linha Forte** (`line-strong`): bordas de 1 a 2px, divisores; `line-strong` é o tracejado do placeholder de capa e a borda de opção em hover.
- **Estúdio** (`rec-bg`): fundo da gravação/teleprompter. **Vermelho REC** (`rec-red`): só o ponto e o quadrado de gravação.

### Named Rules
**A Regra da Uma Voz.** Coral-magenta marca a única ação principal da tela. Se duas coisas estão em coral, uma delas está errada.

**A Regra do Código de Cortes.** Tangerina, céu, menta e sol codificam somente cortes, nesta sequência fixa. Plataformas, origens de conteúdo, avatares e categorias ficam neutros (tinta quando selecionados).

**A Regra da Tinta sobre Cor.** Texto e ícone sobre campo vivo (tangerina, céu, menta, sol) são sempre `ink`, nunca branco (branco sobre tangerina dá 2,61:1). Branco só sobre `primary`, `ink` e `rec-bg`.

**A Regra do Campo Sólido.** Cor viva é sempre campo sólido; nunca degradê entre cores. O único degradê do sistema é o véu preto→transparente na base da capa e o esmaecimento de rolagem.

## Typography

**Display Font:** Bricolage Grotesque (fallback system-ui, sans-serif), pesos 700–800, eixo opsz.
**Body Font:** Hanken Grotesk (fallback system-ui, sans-serif), pesos 400–700.

**Character:** Bricolage dá a voz expressiva e amigável dos títulos, com tracking negativo e entrelinha curta; Hanken é a interface humanista que não chama atenção. Ambas devem ser auto-hospedadas na PWA.

### Hierarchy
- **Display** (800, 34px, 1.05, -0.03em): título da tela raiz ("Seus vídeos").
- **Headline** (800, 30px, 1.1, -0.03em, `text-wrap: balance`): pergunta da entrevista.
- **Headline-sm** (800, 26px, 1.12, -0.02em): título do script, título do painel "Novo vídeo".
- **Title** (Bricolage 700, 20px, -0.01em): títulos de seção ("Continue de onde parou", "Cortes").
- **Numeral** (Bricolage 800, 34px, 1, tabular): números grandes das opções (10s, 30s), sufixo em 18px.
- **Title-ui** (Hanken 700, 15–17px, 1.25): nome do projeto, título do corte, título da barra superior.
- **Body** (400, 16px, 1.45); **Body-script** (400, 16px, 1.55): texto dos blocos do script; textos de apoio limitados a ~34ch.
- **Prompter** (600, 27px, 1.35, -0.01em): texto do teleprompter; linha passada a 38% de branco, linha atual em `sun`.
- **Label-button** (700, 17px): botões grandes; 15px nos botões compactos.
- **Label** (600, 13–14.5px): chips, mini-botões, plataformas, etiquetas.
- **Meta** (400, 13.5px, tabular): meta de projeto e corte em `ink-2`.
- **Caption** (600–700, 12px): rótulos de aba, selo "Sugerido". Piso absoluto do sistema.

### Named Rules
**A Regra do Piso de 12.** Nenhum texto abaixo de 12px, inclusive título em capa e rótulo de aba.

**A Regra do Relógio Tabular.** Toda duração, timecode, contagem (3:05, 0:28, 4/8, 00:14, "2 de 5") usa `font-variant-numeric: tabular-nums`.

## Layout

Mobile-first, coluna única desenhada em 390px de largura. Cards e blocos têm margem lateral de 16px; títulos e textos corridos entram a 20px. Ritmo vertical em passos de 4: 8–12px entre itens irmãos, 10px entre cards, 28px acima de título de seção. Estrutura fixa por tela: barra superior (ícone 44px, título, ícone 44px) ou cabeçalho com avatar; área rolável com esmaecimento de 32px na base; rodapé fixo com o botão principal em largura total (padding 12px 16px, folga inferior de ~30px para a área segura). A raiz usa barra de 3 abas com o botão "Novo" central elevado.

Opções de escolha ficam em grade 2×2 (gap 12px); atalhos de origem em grade de 5 colunas (gap 8px); lista de cortes em grade miniatura 48px / texto / ações.

## Elevation & Depth

Híbrido: a profundidade vem principalmente de tom (branco sobre cinza-frio, bordas de 1px `line`) e de sombras suaves e difusas com deslocamento vertical. Não há sombra dura nem sombra colorida fora da ação primária.

### Shadow Vocabulary
- **Repouso** (`box-shadow: 0 1px 2px rgba(21,22,28,.06), 0 4px 12px rgba(21,22,28,.06)`): card de projeto, bloco de corte.
- **Ação** (`box-shadow: 0 4px 10px rgba(225,29,85,.28), 0 12px 28px rgba(225,29,85,.18)`): só no botão primário, no painel "Novo vídeo" e no botão central da aba.

### Named Rules
**A Regra do Brilho da Ação.** Sombra tingida de coral pertence exclusivamente ao elemento primário; ela é parte da Regra da Uma Voz.

**A Regra do Vidro no Estúdio.** No escuro, o teleprompter e os controles flutuam sobre a câmera em véu translúcido (`rgba(12,13,18,.72)` com blur de 6px; controles em branco a 10–12%), nunca em cartão opaco.

## Shapes

Cantos generosos e consistentes: 24px para painéis e containers grandes (painel "Novo vídeo", vídeo principal, teleprompter), 16px para botões grandes, cards, blocos e opções, 12px para botões compactos, atalhos, miniaturas e caixas de explicação, 8px para etiquetas de corte. Pílula (999px) para chips, plataformas, selo, toast, controle de velocidade e pílula REC. Botões de ícone são círculos. Capas são retângulos verticais 2:3 (próximo de 9:16) com raio 12–14px. Bordas são de 1px (divisores, cards), 1,5px (plataformas, descrição, tracejado de placeholder) ou 2px (opções, blocos de corte).

## Components

### Buttons
Táteis e confiantes, sempre largos o bastante para o polegar.
- **Shape:** cantos suaves (16px), altura mínima 56px, largura total no rodapé; versão compacta 44px / 12px dentro de cards.
- **Primary:** fundo coral-magenta, texto branco 17px/700, ícone Lucide à esquerda ou seta à direita, sombra de ação.
- **Hover / Focus / Active:** hover escurece para `primary-press`; pressão encolhe para 98% (180ms, ease-out exponencial); foco = anel `sky` de 3px com offset 2px.
- **Soft:** fundo `surface`, texto tinta; vira branco quando está sobre `surface`. Usado em ações secundárias e em "Baixar tudo".
- **Next (próxima ação do card):** tinta sólida, texto branco 14.5px/700, 38px, raio 12px.
- **Mini:** 34px, raio 10px, `surface`, ícone 16px + rótulo 14px/600 ("Reescrever", "Editar", "Copiar").
- **Icon button:** círculo de 44px, ícone 22px; hover ganha fundo `surface`.

### Chips
- **Style:** pílula de 28px, `surface` com texto `ink-2` 13px/600, ícone 15px.
- **State:** "Salvo" em `mint-tint` com `mint-ink`. Chips são informativos, não filtros.

### Option Cards (entrevista)
Assinatura do princípio "responder, não configurar".
- Grade 2×2, cada opção com número grande Bricolage, subtítulo tabular e barrinhas na sequência de cortes.
- **Repouso:** branco, borda 2px `line`; hover borda `line-strong`.
- **Selecionada:** borda `primary`, fundo `primary-tint`, check circular coral no canto que entra com escala 0→1 (350ms, ease-out exponencial).
- **Sugerida pela IA:** já vem marcada e carrega o selo "Sugerido" (pílula tinta, ícone sparkles, 12px/700). Uma caixa `explainer` em céu-claro diz por quê.

### Cards / Containers
- **Card de projeto:** raio 16px, branco, borda 1px `line`, sombra de repouso, padding 14px; miniatura 64×92 à esquerda, título, meta tabular, trilha de 5 etapas (concluída = tinta, atual = coral, futura = `surface-2`), divisor e linha de próxima ação.
- **Bloco de script:** raio 16px; bloco sem corte em `surface`; bloco de corte em branco com borda 2px na cor do corte e sombra de repouso, etiqueta "Corte N" em campo sólido da cor com texto tinta, duração tabular à direita.
- **Vídeo principal:** container `surface` raio 24px com pôster e duas ações empilhadas.

### Covers
- **Capa existente (pôster):** retângulo vertical em `primary` (até haver imagem), véu preto→transparente na base, título em Bricolage 800 branco; na pasta ganha botão play e duração tabular.
- **Capa ainda inexistente:** placeholder `surface` com tracejado 1,5px `line-strong` e o ícone da origem do conteúdo (livro, microfone…). Nunca uma capa falsa.

### Platform Toggles
Pílulas de 36px com borda 1,5px `line`, texto 14px/600. Selecionada = fundo e borda tinta, texto branco. Plataformas nunca recebem cor própria.

### Navigation
Barra inferior de 3 abas em branco 96% com borda superior `line`: ícone 22px + rótulo 12px/600; ativa em `ink`, inativa em `ink-2`. Centro: botão "Novo" coral de 60px, raio 20px, elevado 6px, ícone plus 28px. Telas internas usam barra superior com voltar / título 16px/700 / mais opções.

### Teleprompter (assinatura)
Estúdio escuro `rec-bg`. Topo: fechar, pílula REC (ponto `rec-red` piscando, timecode tabular), ajustes. Contador "Corte N · bloco X de Y". Painel de vidro com texto 27px: passado esmaecido, linha atual em `sun` com barra de leitura de 4px em `sun` à esquerda, máscara de esmaecimento na base. Rodapé: controle de velocidade em pílula translúcida (tartaruga ↔ coelho, accent `sun`), pausar e refazer em círculos de 52px, botão de gravação de 84px com aro branco de 4px e quadrado `rec-red`.

### Toast
Pílula tinta de 44px, texto branco 14.5px/600, ícone de sucesso em `mint`; sobe 16px e aparece em 350ms, some após ~1,6s.

### Iconography
Lucide exclusivamente, traço único de 2px, 22px por padrão (15–20px dentro de chips e botões compactos).

### Motion
Uma curva só: ease-out exponencial `cubic-bezier(.16,1,.3,1)`; 180ms para pressão/hover, 200ms para troca de borda/fundo, 350ms para check, toast e entradas. `prefers-reduced-motion` zera transições e animações.

## Do's and Don'ts

### Do:
- **Do** dar a cada tela exatamente uma ação em coral-magenta, de preferência no rodapé ao alcance do polegar.
- **Do** colorir cortes na sequência tangerina → céu → menta → sol, repetindo a partir do 5º.
- **Do** usar `ink` para texto e ícone sobre qualquer campo vivo.
- **Do** mostrar a capa só quando ela existe; antes disso, placeholder tracejado com o ícone da origem.
- **Do** vir com a sugestão já marcada e o selo "Sugerido", com explicação em céu-claro.
- **Do** usar algarismos tabulares em toda duração, timecode e contagem; nunca texto abaixo de 12px.
- **Do** manter a gravação em `rec-bg` com a linha atual em `sun`.
- **Do** auto-hospedar Bricolage Grotesque e Hanken Grotesk na PWA e usar só ícones Lucide com traço 2px.

### Don't:
- **Don't** usar roxo de IA, neon ou degradê entre cores; cor viva é sempre campo sólido.
- **Don't** dar cor própria a plataformas, origens de conteúdo ou categorias; as quatro cores vivas são dos cortes.
- **Don't** colocar texto branco sobre tangerina, céu, menta ou sol.
- **Don't** pôr duas ações coral na mesma tela nem usar a sombra coral fora do elemento primário.
- **Don't** usar sombra dura ou deslocada sem desfoque.
- **Don't** escurecer o app inteiro: só gravação/teleprompter é escuro.
- **Don't** misturar bibliotecas de ícones nem pesos de traço.
