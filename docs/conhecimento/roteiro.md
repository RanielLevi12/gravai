# Cérebro do roteiro (Gravaí)

Guia de escrita de roteiro falado em português do Brasil. Os prompts da IA carregam a versão enxuta em `src/lib/ai/agents/guia.ts`; este arquivo é a versão completa, com fontes.

**Como ler os rótulos**
- **[Fonte]** = vem de uma página citada.
- **[Prática]** = consenso de blogs e criadores, sem estudo por trás.
- **[Nosso]** = montado por nós (exemplos, proporções, listas). Trate como padrão editável, não como fato medido.

**Limite da pesquisa:** quase tudo que existe em português é blog de ferramenta. As únicas fontes primárias são as páginas de ajuda do YouTube e do TikTok Ads. Números como "65% saem nos 3 segundos" circulam sem origem e **não** entram no guia.

---

## 1. Estrutura do roteiro

Toda estrutura boa cabe em quatro batidas: **gancho que promete** → **tensão** (problema ou conflito) → **virada/solução concreta** → **fecho com uma ação ou ideia**.

O esqueleto mínimo é o **ABT (E / Mas / Portanto)**: "Eu gravava todo dia (E), mas travava quando a câmera ligava (Mas), portanto passei a ler em frases curtas e o travamento acabou (Portanto)." Criado a partir da regra dos roteiristas de South Park de trocar "e então" por "mas" ou "portanto" [Fonte: SESYNC, Randy Olson]. Cada bloco do vídeo pode ser um mini-ABT.

| Estrutura | Quando usar | Proporção do tempo [Nosso] |
|---|---|---|
| **PAS** (Problema, Agitação, Solução) | dor clara, venda, serviço | 15% / 25% / 45% / CTA 15% |
| **ABT** | explicar uma ideia, notícia ou lição em 30–60 s | E 25% / Mas 30% / Portanto 45% |
| **Gancho, história, lição** | pregação, testemunho, reflexão | gancho 10% / história 60% / lição 20% / fecho 10% |
| **Lista numerada** ("3 erros…") | dicas práticas | gancho 10% / itens iguais 75% / fecho 15% |
| **Antes, Depois, Ponte** | transformação visível | 25% / 25% / 40% / CTA 10% |
| **AIDA** | anúncio, captação | 15% / 30% / 35% / 20% |
| **Story Circle** (Dan Harmon, 8 passos) | vídeo longo com história pessoal ou estudo de caso | Você+Precisa 10% / Vai+Busca 40% / Encontra+Paga 25% / Retorna+Muda 25% |
| **StoryBrand** (Donald Miller) | vídeo de venda ou institucional longo | o público é o herói, você é o guia |

Fontes: [SESYNC](https://www.sesync.org/resources/communications-toolkit-and-therefore-statement), [Story Circle](https://www.thebookdesigner.com/the-dan-harmon-story-circle/), [Mailchimp pt-BR](https://mailchimp.com/pt-br/resources/copwriting-formulas/), [StoryBrand](https://www.gravityglobal.com/blog/complete-guide-storybrand-framework), [Made to Stick](https://www.happycoders.eu/books/made-to-stick). Nenhuma fonte valida as proporções acima nem compara estruturas em retenção.

**Princípios que valem para todas** [Fonte: Made to Stick, resumos]: simples, inesperado, concreto, crível, emocional, com história. Mostre em vez de dizer: "Minha mão suava tanto que o celular escorregou", e não "eu estava ansioso".

### Vídeo curto (até 90 s) e longo (3–15 min)
- **Curto:** gancho (0–3 s) → entrega rápida → fecho que paga o gancho. Fecho de 10 a 15 palavras.
- **Longo:** gancho (0–30 s) → ponte → capítulos com mini-gancho → payoff. O primeiro minuto é onde mais gente sai [Fonte: memo MrBeast, ~2022, vazado; autenticidade confirmada por ex-produtores ao Passionfruit]. Prove o título nos primeiros segundos.
- Teste útil [Prática: Paddy Galloway, segunda mão]: se os 30 s iniciais do longo funcionam como vídeo curto, a abertura é boa.

### Transformar texto-fonte em roteiro falado [Nosso, método comum sem fonte única]
1. Tire a tese em uma frase.
2. Escolha uma estrutura.
3. Liste 3 a 5 ideias, uma por bloco.
4. Reescreva em frases de 8 a 15 palavras, voz ativa, falando com "você".
5. Troque o abstrato por cena, número ou exemplo.
6. Corte definições, citações longas e ressalvas.
7. Leia em voz alta e cronometre.
8. Corte do meio, nunca do gancho nem do fecho.

**Tamanho:** não há fonte que confirme palavras por segundo em português. As faixas achadas vão de 110 a 170 palavras por minuto (média de fala, teleprompter). Use cerca de **2,2 palavras por segundo** como padrão (60 s ≈ 130–150 palavras) e deixe a pessoa se medir lendo 1 minuto em voz alta. O app calcula isso em `src/lib/rules/duration.ts`.

### Voz e estilo do projeto [Nosso]
Ficha de estilo: público (quem e quanto sabe), tom, tratamento ("você", "gente"), vocabulário preferido e proibido, bordões, exemplos do mundo do público (igreja, loja, consultório), formalidade, como a pessoa abre e fecha. Se houver trechos reais da fala dela, imite ritmo e vocabulário sem copiar frases. Gíria só se a pessoa usa de verdade. Quem gosta de contar história antes da tese (pregador) usa gancho-história-lição; quem é direto (vendedor) usa PAS.

---

## 2. Hooks (primeiros 1 a 3 segundos)

O primeiro quadro precisa fazer sentido **sem som**; a primeira fala cria tensão, reconhecimento ou curiosidade; o texto na tela repete a lacuna em 3 a 6 palavras [Fonte: go-viral, Submagic, CapCut; todos blogs]. O TikTok Ads pede a proposta em 3 s e o gancho em até 6 s, com texto na tela de 5 a 10 palavras por segundo [Fonte oficial: [TikTok Ads Help](https://ads.tiktok.com/help/article/creative-best-practices)].

**Destruidores de gancho:** fade do preto, logo animado, "e aí, galera", apresentação, contexto antes do conflito.

Oito tipos (classificação [Nosso], montada sobre as categorias dos blogs; nenhuma fonte oficial classifica):

| Tipo | Como funciona | Bom | Ruim |
|---|---|---|---|
| **Curiosidade** | afirmação incompleta, a resposta vem no fim | "Tem um motivo pro seu pão murchar, e não é o forno." | "Você não vai acreditar!" |
| **Contradição / mito** | crença comum + "na verdade" | "Cardio em jejum não queima mais gordura. Olha o estudo." | "Esqueça tudo que você sabe sobre vendas." |
| **Promessa de resultado** | resultado + prazo ou esforço | "3 passos pra cobrar seu primeiro cliente de site esta semana." | "Método secreto que muda sua vida." |
| **História em andamento** | começa no meio do conflito | "Faltavam 5 minutos pro culto e o som simplesmente morreu." | "Deixa eu contar como tudo começou, lá em 2015…" |
| **Pergunta** | dor específica que o público responde "comigo também" | "Por que seu Reels morre em 200 views?" | "Você quer ter sucesso?" |
| **Erro comum** | "você faz X errado" + consequência | "Se você grava com a luz atrás, ninguém vê o seu rosto." | "Você está errando em tudo." |
| **Prova / número** | número específico + como | "Testei 12 aberturas e só 2 seguraram o público." | "Milhares de views com esse truque." |
| **Interrupção visual** | ação inesperada em 0,5–1 s, fala curta | (derruba o copo) "Calma, é de propósito." | logo de 3 s antes de tudo |

Regra de ouro: gancho bom é **específico e entrega o que promete**. Alterne 3 ou 4 tipos entre vídeos e teste só trocando o gancho [Prática].

**Medir de verdade:** use as métricas de cada plataforma contra o histórico do próprio canal: "Intro" (quem ainda assiste aos 30 s) e o gráfico de retenção no YouTube [Fonte oficial: [YouTube Ajuda](https://support.google.com/youtube/answer/9314415)], Skip Rate (saída nos 3 s iniciais) no Instagram desde ago/2025 [Fonte: Social Media Today, secundária], "viewed vs swiped" nos Shorts.

---

## 3. Retenção e loops abertos

- **Loop aberto:** provoque algo que só se resolve depois. Use 1 ou 2 por vídeo; mais que isso cansa [Prática].
- **Regra de ouro [Nosso]:** todo loop aberto precisa ser pago com algo igual ou melhor, na ordem prometida ou com aviso ("já mostro, antes você precisa disso"). Loop que o vídeo não paga é clickbait e derruba a confiança.
- **Re-hook:** antes da queda esperada, uma nova promessa, virada ou prova. Curto: a cada 15–30 s [Prática, sem estudo]. Longo: por volta dos 3 e dos 6 min [Fonte: memo MrBeast].
- **Mostre, não anuncie:** "pare de contar o que vão assistir e comece a mostrar" [Fonte: memo MrBeast]. Sem momentos mortos; final abrupto protege a retenção.
- **Ritmo:** frase curta, uma ideia por frase, mudança visual a cada ideia nova.
- **Contexto de mercado** [Fonte: estudo Metricool, 799 mil vídeos, fev/2025 contra fev/2026]: o tempo médio assistido de Shorts caiu cerca de 63% e o de vídeos longos cerca de 37% (outra matéria cita 67%). A atenção está mais curta, então o gancho pesa mais.

---

## 4. Escrita sem "slop"

"Slop" é texto genérico de IA. O sinal não é uma palavra isolada: é o **conjunto**, mais a falta de número, nome, cena ou opinião [Fonte: Wikipedia, "Signs of AI writing"; Hora de Codar; Substack IA e Práxis]. Em roteiro falado o problema maior é ser genérico; consertar a especificidade resolve quase tudo.

### Regras (Orwell + redação brasileira + [Nosso])
1. A primeira frase já é o fato ou a cena. Nada de aquecimento.
2. Uma ideia por frase. Máximo de 20 palavras; média de 8 a 14.
3. Misture o tamanho: uma frase de menos de 6 palavras a cada 4 ou 5.
4. Todo parágrafo tem um número, nome, lugar, preço ou exemplo.
5. Verbo forte, voz ativa, sujeito claro.
6. Fale como se fala ("pra", "tá", "a gente"), nunca "outrossim" ou "ademais".
7. Corte adjetivo vazio (incrível, poderoso). Mostre o fato que prova.
8. Sem moral da história nem fecho inspirador.
9. Não repita a mesma estrutura três vezes seguidas.
10. No máximo uma pergunta retórica, e só se for dúvida real de quem assiste.
11. Sem travessão (—). Na fala, o ponto é a respiração.
12. "Não é X, é Y": no máximo uma vez no roteiro.
13. Não anuncie o que vai fazer: faça.
14. Leia em voz alta. Onde engasgar, reescreva.

### Vícios proibidos, com troca
**A. Aberturas**
- "Você sabia que…?" → afirme o fato: "A Netflix perde 1 em cada 5 assinantes no primeiro ano."
- "Neste vídeo eu vou te mostrar…" / "Hoje vamos falar sobre…" → comece pelo resultado.
- "Imagine que…" → cena real com hora e nome.
- "Se você chegou até aqui…" → corte.
- "No mundo de hoje…", "Nos dias atuais…", "Hoje em dia…" → dê o ano e o dado.
- "Vamos lá!", "Bora!", "Sem mais delongas" → vá direto ao primeiro passo.
- "O segredo que ninguém conta", "o que os gurus não querem que você saiba" → diga quem e o quê.
- "Prepare-se para mudar sua vida" → prometa um resultado que dá pra medir.
- "Deixa o like e se inscreve" no começo → peça no fim, em uma frase.
- Três perguntas retóricas seguidas → uma afirmação com número.
- "Fica até o final" sem entregar nada → entregue cedo e aprofunde.

**B. Palavras-tell de IA**
mergulhar / mergulhar fundo (→ olhar, ver, abrir), crucial, fundamental, essencial, insights (→ o que descobri), jornada (→ caminho, ou as etapas), desbloquear, potencializar, alavancar (→ aumentar, com o número), robusto, holístico, abrangente, sinergia, ecossistema, paradigma, cenário (→ mercado, situação), revolucionar, revolucionário, disruptivo, transformador, inovador, dinâmico, poderoso, envolvente, fascinante, incrível, impressionante, meticuloso, tapeçaria, "testemunho de", "no coração de", "repleto de", "rica variedade", navegar (desafios) (→ lidar com), otimizar (no vazio), "solução completa", "ferramenta definitiva", game changer, next level, "de outro nível".

**C. Conectores e muletas**
"É importante ressaltar/notar que…", "Vale ressaltar/destacar que…", "Além disso", "Ademais", "Outrossim", "Adicionalmente", "Dito isso", "Com isso em mente", "Nesse sentido", "Em suma", "Em resumo", "Em conclusão", "No fim das contas", "Quando se trata de…", "Como todos sabemos", "É fundamental entender que". Apague e diga a coisa. Se for crítico: "Atenção:".

**D. Estruturas repetitivas**
- "Não é apenas X, é Y" / "Não se trata de X, mas de Y" / "não só X, mas também Y" → afirme só Y.
- Lista de três adjetivos ("rápido, simples e eficiente") → dois itens concretos.
- "Você vai… Você vai… Você vai…" → varie ou corte.
- Pergunta e resposta em série ("O resultado? Desastre.") → afirme direto.
- "Isso muda tudo.", "E é aí que mora o segredo.", "E aqui vem a virada." → mostre a virada.
- Gerúndio vago no fim da frase ("…destacando a importância de…") → corte ou ponha dado.
- "serve como", "se configura como", "constitui" → "é".

**E. Afirmação vaga**
- "Especialistas dizem…", "Estudos mostram…" → cite quem e quando, ou assuma como sua opinião.
- "Muitas pessoas", "a maioria das empresas" → número, ou "3 dos 5 clientes que atendi".
- "Cada vez mais", "tendência crescente" → "de 12% pra 31% em dois anos".
- "Existem diversos fatores" → nomeie os dois principais.
- "Seja você X ou Y, isso é pra você" → fale com uma pessoa específica.
- "Resultados incríveis", "garantir o sucesso", "levar ao próximo nível" → resultado e prazo.

**F. Forma**
Travessão, negrito, emoji, markdown, frases todas com 15 a 25 palavras, vírgula antes do "e" em lista (estilo inglês), Title Case em termos comuns.

**G. Voz de guru**
"Você merece", "Acredite em você", "mindset", "A verdade é que…", "A realidade é que…", "Vou ser sincero com você", "Ninguém te conta isso", "Escola não ensina", urgência fabricada ("agora mesmo", "não perca", "última chance").

### Antes e depois
| Antes | Depois |
|---|---|
| "Você sabia que a maioria das empresas perde clientes por falta de atendimento rápido?" | "Quem responde em 5 minutos fecha 9 vezes mais venda que quem responde em 1 hora." |
| "Neste vídeo eu vou te mostrar como criar um site incrível." | "Vou montar um site de dentista do zero em 20 minutos. Tá aqui o resultado." |
| "No mundo de hoje, a presença digital é crucial." | "Antes de ir ao consultório, 8 em cada 10 pacientes procuram o dentista no Google." |
| "Vamos mergulhar nessa jornada de transformação." | "Vamos ver o que mudou na loja da Márcia em 3 meses: o site, o WhatsApp e as vendas." |
| "Não é apenas uma ferramenta, é uma revolução." | "Ela faz em 2 minutos o que eu fazia em 40." |
| "Imagine ter mais tempo livre." | "Sexta, 18h, ela fechou o notebook. Antes, ficava até as 21h na planilha." |
| "Em suma, a chave do sucesso é a consistência." | "Posta toda terça por 3 meses. Foi isso que levou o canal de 40 pra 900 inscritos." |
| "E o resultado? Impressionante. A conversão? Dobrou." | "A conversão foi de 1,8% pra 3,9%." |
| "Se você chegou até aqui, deixa o like!" | "Se isso te ajudou, o próximo vídeo mostra como cobrar. Tá na tela." |

(Os números dos exemplos são inventados, só ilustram.)

Fontes: [Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), [Hora de Codar](https://horadecodar.com.br/humanizar-textos-chatgpt/), [Substack IA e Práxis](https://iaedpraxis101.substack.com/p/texto-chocho-como-identificar-a-escrita), [Orwell](https://www.orwell.ru/library/essays/politics/english/e_polit), [Correio Braziliense](https://blogs.correiobraziliense.com.br/dad/dicas_de_redacao/). Não existe lista oficial de "palavras de IA" em português; a lista acima é curadoria nossa. O verificador automático está em `src/lib/ai/agents/slop.ts`.

---

## 5. Títulos

- Título bom = clareza + promessa específica + palavra-chave no começo; **o vídeo precisa entregar** [Fonte: Semrush Brasil; Herospark].
- Tamanho: o YouTube aceita 100 caracteres, mas no celular aparecem uns 50–60 (estimativa de terceiros, depende da largura). Ponha o gancho no início. No Reels e no TikTok, o "título" é o texto na tela + a primeira linha da legenda.
- Curiosidade pura tem alta variância: uma análise de 3.357 vídeos achou 0,92x do controle [Fonte: OverseerOS, amostra de blog]. Curiosidade **com especificidade**.
- O gancho falado nos 3 primeiros segundos repete a promessa do título (mesma palavra-chave).
- Título e capa não repetem o mesmo texto: a capa mostra emoção ou resultado em 2 a 4 palavras.
- Descartados por falta de fonte: "números dão 15% mais cliques", "títulos otimizados rendem 2–3x".

Três tipos para oferecer sempre (um de cada) [Nosso]:
1. **Benefício + número**: "Como sair do vermelho em 90 dias com salário de R$ 2.500" / ruim: "Dicas incríveis de dinheiro que mudam sua vida".
2. **Erro comum / contraste**: "O erro que faz seu cliente pedir desconto (e como evitar sem baixar o preço)" / ruim: "Você está errando e nem sabe!".
3. **Pergunta específica com resposta garantida**: "Por que Jesus chorou diante do túmulo de Lázaro se ia ressuscitá-lo?" / ruim: "Uma mensagem que Deus tem pra você HOJE".

Outras fórmulas: "como X sem Y", antes/depois, contraste, número + benefício.

---

## 6. Conclusão e CTA

### Conclusão [Prática: Kineclip, blog de ferramenta]
- Ordem: **pagar o gancho** → fechar o loop → (opcional) pedir uma ação.
- Pague com uma frase de conteúdo, não com recap. "E é isso, pessoal" e "resumindo tudo" não entram.
- Três formas de fechar o loop: completar a frase de abertura; repetir a imagem inicial com uma mudança; responder a pergunta e abrir uma menor.
- Não prometa "parte 2" que não vai existir.
- Curto: uma frase de pagamento + um CTA. Longo: um mini-resumo de um ponto só se ajudar, uma frase que fica, um CTA que leva ao próximo vídeo.
- Pregação: fechar com uma aplicação prática e um convite específico ("Esta semana, ligue pra uma pessoa que você ofendeu").
- Exemplo: gancho "Por que seu dinheiro some no dia 20?" → fecho "Some porque você paga o futuro com o cartão de hoje. Corte uma parcela e o dia 20 volta a ser dia 20."

### CTA
- **Um só**, específico, ligado ao que o vídeo entregou, **depois** de pagar o gancho. CTA genérico ("curta, compartilhe e se inscreva") falha [Prática: SocialKit, Postiz].
- Tipos e quando usar: seguir (série), comentar uma pergunta (opinião), salvar (checklist/referência), mandar pra alguém (dor compartilhada), WhatsApp/link na bio/telefone (venda), ver outro vídeo (longo).
- O objetivo vem do CTA salvo no perfil (WhatsApp, link na bio, link, telefone). **A IA escreve a frase, o código monta o contato**: telefone e link nunca saem da mão da IA.
- **Cortes:** o CTA aponta para o vídeo completo ou para outro corte, com nome concreto. Bom: "O resto da conta, com os números, está no vídeo completo. Link na bio." Ruim: "Se gostou, vai lá no canal."
- YouTube, tela final [Fonte oficial: [Ajuda do YouTube](https://support.google.com/youtube/answer/6388789)]: últimos 5–20 s, vídeo de pelo menos 25 s, até 4 elementos, cada um com CTA claro e relevante ao vídeo. Só quem assiste até o fim vê.
- Não achamos guia oficial de CTA do Instagram nem do TikTok.

---

## 7. Lacunas honestas

- Sem estudo aberto comparando tipos de hook, estruturas ou fórmulas de título.
- Sem dados em português do Brasil de retenção ou conversão por tipo de CTA; nada específico de igreja ou pregação.
- Manual da Folha só por eco em blog; livros de Olson, Harmon, Heath e Miller só por resumo.
- Hotmart, RD Station, Rock Content, vidIQ e Think Media não foram consultados.
- Os limiares do verificador (`slop.ts`) são palpites: calibrar com roteiros bons do Raniel.
- A bateria `tests/evals` mede o efeito real do guia; use-a antes de ajustar o texto.
