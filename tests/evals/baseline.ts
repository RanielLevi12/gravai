/**
 * "Antes": os prompts de roteiro e de títulos de ANTES da Fase 3, congelados. Não edite: a bateria compara o
 * pipeline atual com este. Serve só para medir.
 */
import { z } from "zod";

export const LEGACY_SCRIPT_SYSTEM = `Você escreve o roteiro falado de UM vídeo de criador brasileiro, do começo ao fim, como um texto só e contínuo.
Regras:
- Escreva no mesmo idioma do texto-fonte, em linguagem falada e simples, como a pessoa falaria olhando para a câmera.
- É um único vídeo: um bloco "opening" (abertura com gancho), vários blocos "body" (os parágrafos do desenvolvimento, cada um continuando o anterior) e um bloco "closing" (fechamento).
- Cumprimente a plateia no máximo UMA vez, na abertura ("Fala, pessoal", "Meu povo" etc.). Nenhum outro bloco começa com cumprimento, nem recomeça o assunto como se fosse outro vídeo, nem se despede antes do fechamento.
- Cada "body" liga com o anterior (use a continuação natural da fala) e avança a ideia.
- Não faça cortes nem marque trechos para publicar separado: isso é feito depois, em outra etapa.
- Não invente fatos que não estejam no texto-fonte.
- Não escreva chamada para ação (link, WhatsApp, telefone) nas descrições nem no roteiro: ela é adicionada depois.
- "mainDescriptions": uma legenda por plataforma pedida, no estilo da plataforma, sem a chamada para ação. "mainCoverPrompt": descrição da capa do vídeo.
- Responda só com o JSON pedido.`;


export const LEGACY_TITLES_SYSTEM = `Você escreve títulos de vídeos curtos para redes sociais.
Crie 6 títulos diferentes para o vídeo descrito: curtos (até 70 caracteres), específicos, com gancho de curiosidade ou benefício claro, sem caça-clique enganoso e sem hashtags.
Escreva no mesmo idioma do texto.`;

export const LegacyTitlesSchema = z.object({ titles: z.array(z.string()) }).meta({ title: "interview_titles" });
