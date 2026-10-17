/**
 * Guia de roteiro carregado nos prompts (resumo de docs/conhecimento/roteiro.md).
 * Puro: só texto. Mudou aqui? Rode `npm run eval:roteiro` para medir o efeito.
 */

export const GUIA_ESTRUTURA = `COMO ESTRUTURAR
- Todo vídeo tem quatro batidas: gancho que promete, tensão (problema ou conflito), virada com solução concreta, fecho com uma ideia ou uma ação.
- Cada trecho é um mini "E / Mas / Portanto": avança com uma virada, nunca com "e então, e então".
- Escolha UMA estrutura pelo tipo de conteúdo: pregação ou testemunho = gancho, história, lição; dica prática = lista de itens do mesmo tamanho; dor clara ou venda = problema, agitação, solução; transformação = antes, depois, ponte.
- Prove o título logo no começo. Não anuncie o que vai fazer: faça. Mostre em vez de dizer ("a mão suava tanto que o celular escorregou", e não "eu estava ansioso").
- Uma ideia por bloco. A ideia mais forte vem cedo; o exemplo vem junto da ideia, não depois.
- Trabalhe o texto-fonte assim: tire a tese em uma frase, escolha 3 a 5 ideias, troque o abstrato por cena, número ou exemplo, corte definições, citações longas e ressalvas. Se precisar cortar, corte do meio, nunca do gancho nem do fecho.
- Pregação e citações: a história ou a cena vem primeiro; o versículo ou a citação vem depois dela.`;

export const GUIA_HOOK = `COMO ABRIR (primeiros 1 a 3 segundos)
- O primeiro quadro faz sentido sem som; a primeira fala cria tensão, reconhecimento ou curiosidade; o texto na tela repete a lacuna em 3 a 6 palavras.
- Nunca abra com saudação longa, apresentação, logo ou contexto antes do conflito. A primeira frase já é o fato, a cena ou a promessa.
- Tipos de gancho: curiosidade (afirmação incompleta), contradição ou mito, promessa de resultado, história em andamento, pergunta específica, erro comum, prova com número, interrupção visual.
- Bom gancho é específico e entrega o que promete. Ruim é vago ("Você não vai acreditar!", "Esqueça tudo que você sabe").
- Exemplos bons: "Faltavam 5 minutos pro culto e o som simplesmente morreu." / "Testei 12 aberturas e só 2 seguraram o público." / "Se você grava com a luz atrás, ninguém vê o seu rosto."
- Exemplos ruins: "Hoje vou falar sobre uma coisa interessante." / "Milhares de views com esse truque." / "Você quer ter sucesso?"
- Gancho de no máximo 12 palavras na fala.`;

export const GUIA_RETENCAO = `COMO SEGURAR
- Loop aberto: provoque algo que só se resolve depois. No máximo 1 ou 2 por vídeo, e pague cada um com algo igual ou melhor do que o prometido. Loop que o vídeo não paga é clickbait.
- A cada 15 a 30 segundos (vídeo curto) entra uma nova promessa, virada ou prova. Em vídeo longo, um mini-gancho no começo de cada capítulo.
- Frases curtas, sem momento morto, sem resumo antes da hora.`;

export const GUIA_TITULOS = `COMO ESCREVER TÍTULOS
- Título bom: claro, com promessa específica, palavra-chave no começo, e o vídeo entrega o que ele diz. Gancho nos primeiros 50 caracteres (o celular corta). Até 70 caracteres.
- Curiosidade só funciona com especificidade. Sem hashtag, sem CAIXA ALTA, sem adjetivo vazio.
- Três tipos para oferecer: (1) benefício com número ou prazo, (2) erro comum ou contraste, (3) pergunta específica que o vídeo responde.
- Bons: "Como sair do vermelho em 90 dias com salário de R$ 2.500" / "O erro que faz seu cliente pedir desconto" / "Por que Jesus chorou diante do túmulo de Lázaro se ia ressuscitá-lo?"
- Ruins: "Dicas incríveis que vão mudar sua vida" / "Você está errando e nem sabe!" / "Uma mensagem que Deus tem pra você HOJE"
- Título e primeira fala do vídeo prometem a mesma coisa.`;

export const GUIA_FECHO = `COMO FECHAR
- Ordem do fecho: pague o gancho (responda o que abriu no começo, com uma frase de conteúdo), feche o loop e só então peça UMA ação.
- Sem recap do vídeo inteiro, sem "e é isso, pessoal", sem agradecimento, sem moral da história, sem prometer "parte 2" que não existe.
- Vídeo curto: o fecho tem de 10 a 25 palavras. Vídeo longo: no máximo um mini-resumo de um ponto, uma frase que fica e uma ação.
- Pregação: termine com uma aplicação prática e um convite específico ("Esta semana, ligue pra alguém que você ofendeu").
- CTA: um só, específico, ligado ao que o vídeo entregou. Tipos: seguir (série), comentar uma pergunta (opinião), salvar (checklist), mandar pra alguém (dor compartilhada), chamar no WhatsApp ou ir ao link (venda), ver outro vídeo.
- Nunca escreva número de telefone, link ou endereço na fala: o contato é adicionado pelo sistema na descrição. Diga onde achar ("o link está na descrição", "chama no WhatsApp").
- CTA ruim: "curta, compartilhe e se inscreva", "segue a gente", "se gostou, vai lá no canal".
- Corte de um vídeo maior: o CTA aponta para o vídeo completo ou para outro corte, com o nome do que a pessoa vai ver.`;

/** Frases e vícios que denunciam texto genérico (os padrões automáticos estão em slop.ts). */
export const GUIA_SEM_SLOP = `ESCREVA SEM "CARA DE IA"
Regras:
- A primeira frase já é o fato ou a cena. Uma ideia por frase, no máximo 20 palavras, média de 8 a 14. Misture frases curtíssimas (menos de 6 palavras) com médias.
- Todo parágrafo tem um número, nome, lugar, preço ou exemplo concreto. Verbo forte, voz ativa.
- Fale como se fala (pra, tá, a gente). Sem adjetivo vazio: mostre o fato que prova.
- Sem moral da história, sem fecho inspirador, sem travessão (—), sem negrito, sem emoji, sem listas de três adjetivos.
- No máximo UMA pergunta retórica e no máximo UM "não é X, é Y" no roteiro todo. Não repita a mesma estrutura três vezes seguidas.
- Não invente dado, nome nem estudo. "Especialistas dizem" e "estudos mostram" ficam de fora: cite a fonte do texto-fonte ou assuma como opinião da pessoa.
PROIBIDO (nunca use, nem parecido):
- Aberturas: "Você sabia que", "Neste vídeo", "Hoje vamos falar", "Hoje eu vou te mostrar", "Imagine que", "Se você chegou até aqui", "No mundo de hoje", "Nos dias de hoje", "Hoje em dia", "Vamos lá", "Sem mais delongas", "O segredo que ninguém conta", "Antes de mais nada", "Fica até o final", "Deixa o like".
- Palavras: mergulhar, jornada, crucial, fundamental, insights, desbloquear, potencializar, alavancar, robusto, holístico, sinergia, ecossistema, paradigma, revolucionário, disruptivo, transformador, inovador, poderoso, envolvente, fascinante, incrível, impressionante, game changer, next level.
- Conectores: "É importante ressaltar", "Vale ressaltar", "Vale destacar", "Além disso", "Ademais", "Dito isso", "Nesse sentido", "Em suma", "Em resumo", "No fim das contas", "Quando se trata de", "Como todos sabemos".
- Estruturas: "Não é apenas X, é Y" em série, "Isso muda tudo", "E é aí que mora o segredo", "E o resultado? ...", "A verdade é que", "Vou ser sincero com você", "Você merece", "Acredite em você", "Ninguém te conta isso".
Exemplos de troca:
- Ruim: "Você sabia que a maioria das empresas perde clientes por falta de atendimento rápido?" Bom: "Quem responde em 5 minutos fecha 9 vezes mais venda que quem responde em 1 hora."
- Ruim: "Neste vídeo eu vou te mostrar como criar um site incrível." Bom: "Vou montar um site de dentista do zero em 20 minutos. Tá aqui o resultado."
- Ruim: "Em suma, a chave do sucesso é a consistência." Bom: "Posta toda terça por 3 meses. Foi isso que levou o canal de 40 pra 900 inscritos."`;

/** Guia completo do roteiro (abertura, desenvolvimento e fecho). */
export const GUIA_ROTEIRO = [GUIA_ESTRUTURA, GUIA_HOOK, GUIA_RETENCAO, GUIA_FECHO, GUIA_SEM_SLOP].join("\n\n");
