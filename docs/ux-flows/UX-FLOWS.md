# UX Flows — Video Facil

Base: [spec](../spec.md) · [casos de uso](use-cases.md)

## Mapa de telas
[diagrams/screen-map.md](diagrams/screen-map.md)

## Inventário de telas
30 telas, todas clicáveis e sem beco sem saída. Tabela completa com links de saída: [wireframes/INDEX.md](wireframes/INDEX.md). Entrada: [boas-vindas.html](wireframes/boas-vindas.html).

| Grupo | Telas | UC |
|---|---|---|
| Acesso | boas-vindas, onboarding-nicho, onboarding-tom, onboarding-cta, perfil | UC-001 |
| Início | projetos | UC-001/007 |
| Entrada | novo-entrada, entrada-camera, texto-fonte | UC-002 |
| Entrevista | plataformas, formato, serie, duracao, cortes, cenario, titulos, capa, cta, resumo | UC-003 |
| Script | script, script-reescrever | UC-004 |
| Gravação | gravar-modo, teleprompter, teleprompter-ajustes, gravacao-previa | UC-005 |
| Processamento | aprovar, processando, ajustar-corte | UC-006 |
| Entrega | pasta-projeto, pasta-corte | UC-007 |

## Diagramas por caso de uso
Índice: [diagrams/INDEX.md](diagrams/INDEX.md) — cada UC tem fluxo, estados e sequência (frontend ↔ API ↔ IA/worker).

## Padrões de navegação
- **Barra de abas** (3): Projetos · + Novo vídeo · Perfil. Só nas telas de topo; fluxos de criação ficam em tela cheia com "← Voltar".
- **Entrevista**: uma pergunta por tela, barra "Pergunta N de 8", resposta sugerida já marcada → o usuário só toca "Próxima". "Sair" salva rascunho.
- **Resumo editável**: cada linha volta direto para a pergunta.
- **Bottom sheet** para ações secundárias sem sair do contexto: reescrever trecho, ajustes do teleprompter.
- **Retomar de onde parou**: card do projeto em Projetos mostra o status e abre a etapa certa.
- **Processamento em segundo plano**: pode fechar o app, notificação ao concluir.

## Questões abertas para o design visual (impeccable)
1. Identidade visual do "Video Facil" provisório: cor de destaque, tipografia, tom (criador de conteúdo, não corporativo).
2. Teleprompter: contraste do texto sobre câmera em qualquer ambiente; controles ao alcance do polegar sem cobrir o rosto.
3. Selo "✂ Corte" no script: como diferenciar blocos-corte de blocos de ligação sem poluir.
4. Rolagem de velocidade durante a gravação: slider visível ou gesto (arrastar na tela)?
5. Estados vazios (primeiro acesso sem projetos) e de erro (OCR ilegível, link privado, limite do mês).
6. Modo escuro: teleprompter e câmera pedem tema escuro; o resto do app segue o sistema?
