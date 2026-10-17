# Pesquisa: publicar nas redes com o Zernio (Fase 6 do Gravaí)

Data da pesquisa: 17/10/2026. Só leitura de documentação pública. Nenhuma conta criada, nenhum termo aceito, nada pago.

## Resposta curta

- **Dá para usar o Zernio.** Tem API, SDK para Node, webhooks de status, agendamento e todas as redes que o Gravaí precisa.
- **Preço é baixo:** as 2 primeiras contas conectadas são grátis; da 3ª à 10ª custa US$ 6 por conta/mês. Não há limite de posts.
- **Ponto aberto nº 1 (marca Gravaí):** dá para esconder a tela de escolha de páginas do Zernio (modo `headless`). Mas **não achei** prova de que a tela de login do Instagram/YouTube/TikTok mostra "Gravaí" em vez de "Zernio". Isso precisa ser perguntado ao suporte antes de construir.
- **Ponto aberto nº 2 (revenda):** os Termos de Uso **não proíbem nem liberam** expressamente usar o Zernio para clientes finais. Silêncio não é permissão. Perguntar por escrito.
- **Plano B** só entra se o suporte do Zernio responder mal. O mais parecido é o Upload-Post.

## 1. Tabela comparativa

| | **Zernio** (antigo "Late") | **Ayrshare** | **Upload-Post** |
|---|---|---|---|
| Preço | Por conta conectada: 1–2 grátis; 3–10 = US$ 6; 11–100 = US$ 3; 101+ = US$ 1 (cada faixa só vale para as contas dela). Ex.: 10 contas = US$ 48/mês | Planos fixos: Premium US$ 149 (1 perfil), Launch US$ 299 (até 10 perfis), Business US$ 599 (30 perfis) | Por envio: grátis 10 envios/mês; Basic ≈ € 8,40 (120 envios); Professional ≈ € 25 (valores citados pelo Zernio, não confirmados no site do Upload-Post) |
| Plano grátis | Sim, 2 contas, sem cartão | Não (Launch tem 28 dias de teste) | Sim, 10 envios/mês |
| Limite de posts | Ilimitado | Ilimitado | Por plano |
| Marca própria (white-label) | `headless=true` tira as telas de seleção do Zernio. Tela de consentimento da rede: **não confirmado** | "Custom branding" do Launch para cima; guia "White-Label API". Qual plano exato: não está claro | Página de conexão com logo, títulos e tema próprios (descrito pelo próprio Upload-Post) |
| Redes | 16–17 (YouTube, Instagram, Facebook, TikTok, X, LinkedIn, Threads, etc.) | Principais redes | 22 (segundo o site) |
| Webhooks | Sim: `post.published`, `post.failed`, `post.partial`, `post.platform.failed`; assinatura HMAC-SHA256 | Sim (não verifiquei os detalhes) | Não verifiquei |
| SDK Node | Sim, `@zernio/node` | Sim (não verifiquei) | Sim (JavaScript/Node) |
| Perfil por cliente | Sim, grátis (`/v1/profiles` com `externalId`) | Sim ("profiles") | Sim (multi-usuário com JWT) |

Observação: o Zernio e o Upload-Post comparam um ao outro em páginas de marketing próprias. Trate como alegação, não como fato.

"Late" é o nome antigo do Zernio (a assinatura legada dos webhooks ainda se chama `X-Late-Signature`). Então Late não é um 3º concorrente de verdade.

## 2. Redes e limites (fonte: páginas oficiais do Zernio, por rede)

| Rede | Vídeo | Texto | Capa | Agendar | Observações |
|---|---|---|---|---|---|
| **YouTube / Shorts** | Até 256 GB. 15 min em canal não verificado; 12 h em canal verificado (verificação por telefone). Shorts: até 3 min, 9:16, 1080×1920 | Título 100 caracteres; descrição 5.000; tags 500 no total | JPEG/PNG até 2 MB, 1280×720. **Em canal não verificado o vídeo sai, mas a capa é ignorada.** Shorts: capa não é aceita pela API | Sim. O vídeo sobe como privado e o YouTube libera na hora marcada | Vídeo é Short pela duração e formato, sem marcação. Cota diária varia por canal |
| **Instagram Reels** | MP4/MOV, H.264, 30 fps, **até 300 MB, 3 a 90 s**, 9:16 1080×1920 | Legenda 2.200 (só 125 aparecem antes do "mais") | `instagramThumbnail` (JPEG/PNG) ou quadro por `thumbOffset` | Sim | **Só conta Business ou Creator.** Conta pessoal não posta pela API. Limite: 100 posts por 24 h |
| **TikTok** | Até 4 GB, 3 s a 10 min, 9:16 | Legenda 2.200 | Quadro por tempo ou imagem própria (até 20 MB) | Sim (lista como suportado) | Direto: contas "Business app" só publicam como **público**. Rascunho (`draft`): vai para a caixa de entrada do TikTok e a pessoa toca em Postar (máx. 5 pendentes/24 h). Até 15 vídeos/24 h por conta. Auditoria do app TikTok: a página não explica |
| **Facebook Reels** | MP4/MOV, 3 a **60 s**, 9:16, até 4 GB | Feed 63.206 caracteres | Página não fala de capa de Reel | Sim | **Só Página** (não perfil pessoal); o usuário precisa ser Admin ou Editor da Página |
| **X** | 1 vídeo por post. Limites de arquivo estão numa página "Media & Video" que **não li** | 280 (conta grátis) / 25.000 (Premium); URL conta 23 | — | Sim | **O X cobra por chamada e o Zernio repassa sem margem**: de US$ 0,005 por leitura até US$ 0,20 por post com link. Exige cartão no Zernio, senão a conexão dá erro 402 |

Pontos que pesam no Gravaí:
- O vídeo principal em 9:16 e os cortes têm de caber em: **Instagram 90 s e 300 MB**, **Facebook 60 s**, **Shorts 3 min**. Cortes longos precisam de aviso na tela de publicar.
- O Gravaí aceita gravações de até 500 MB, mas o Instagram só aceita 300 MB. O arquivo final (render) deve respeitar esse teto para o Reels.
- O X é o único com custo extra por post. Sugestão: deixar o X desligado por padrão.

## 3. OAuth e marca Gravaí

O que está comprovado na documentação:
- Fluxo de conexão: o Gravaí chama `GET /v1/connect/{rede}` com o `profileId` e recebe uma `authUrl`. O usuário autoriza e volta para o `redirect_url` do Gravaí com `connected`, `profileId`, `accountId` e `username`.
- Modo `headless=true`: o Gravaí desenha as telas de seleção (Páginas do Facebook, organizações do LinkedIn, boards do Pinterest). Para o Facebook, o blog do Zernio diz que o usuário "nunca vê a marca Zernio".
- Modelo "plataforma": um perfil Zernio por cliente do Gravaí, com `externalId` igual ao id do usuário no Gravaí. Perfis são grátis; cada conta conectada é cobrada. Todo webhook devolve o `externalId`.

O que **não** está comprovado:
- Se a tela do Google, da Meta ou do TikTok mostra "Gravaí" ou "Zernio" como app pedindo permissão. Em regra, essa tela mostra o nome do app cadastrado na rede, que é do Zernio. Um pedido de recurso no fórum do Zernio ("Customizable, Hosted UI for OAuth Workflow") indica que a tela hospedada ainda não é personalizável.
- Se dá para usar os **próprios apps** Meta/Google/TikTok do Gravaí. A documentação não menciona isso. Fazer isso exigiria revisão de app em cada rede (semanas) e é trabalho grande.

**Veredito:** para uma versão de uso pessoal e para um grupo pequeno, "Zernio" aparecer na tela da rede é aceitável. Para vender como marca Gravaí, perguntar ao suporte (ver seção 7).

## 4. Webhooks

- Criar: `POST /v1/webhooks/settings` (nome, url, eventos, `secret` que **nós** escolhemos) ou no painel.
- Eventos de post: `post.published`, `post.failed`, `post.partial` (algumas redes ok, outras falharam), `post.platform.failed` (uma rede falhou de vez), além de agendado e apagado. Também há eventos de conta conectada/desconectada.
- Segurança: cabeçalho `X-Zernio-Signature` = HMAC-SHA256 do corpo **bruto** com o secret, em hexadecimal. Rejeitar se não bater.
- Entrega: o endpoint tem **5 s** para responder 2xx; até 7 tentativas com espera crescente (máx. 24 h); depois vai para uma fila de falhas que dá para reenviar. Entrega é "pelo menos uma vez": pode vir repetida, então usar o `id` do evento (`X-Zernio-Event-Id`) para ignorar repetidos.
- Regra de ouro da documentação: gravar o evento, responder 2xx na hora e processar depois.
- Ainda assim, ter um plano B sem webhook: uma consulta periódica (`posts.getPost`) para posts que ficaram "agendado" além da hora.

## 5. API e SDK para Node

- Base: `https://zernio.com/api/v1`. Chave de API começa com `sk_`, enviada em `Authorization: Bearer`. O Zernio guarda só o hash, então a chave é mostrada **uma vez**.
- SDK oficial: `npm install @zernio/node`; lê a chave da variável `ZERNIO_API_KEY`. Chamadas: `profiles.createProfile`, `connect.getConnectUrl`, `accounts.listAccounts`, `posts.createPost`, `posts.getPost`.
- Publicar: `publishNow: true` (agora), `scheduledFor` + `timezone` (agendar), nenhum dos dois (rascunho). Várias redes em um post, com opções por rede em `platformSpecificData`.
- Repetir o mesmo conteúdo na mesma conta dá erro 409 (se já está agendado ou saiu nas últimas 24 h). O cabeçalho `x-request-id` torna a repetição segura.
- Subir mídia: há um guia "media uploads" que não li; o desenho abaixo supõe enviar o vídeo por URL assinada do Supabase Storage. **Confirmar na 1ª tarefa da fase.**
- Limite de requisições cresce com o número de contas conectadas e é compartilhado por todos os clientes do Gravaí. Em erro 429, esperar o tempo do `Retry-After`.

## 6. Termos de uso (revenda)

Li a página <https://zernio.com/tos> (atualizada em 17/03/2026):
- Não há cláusula escrita proibindo revenda, nem permitindo. O que existe: o serviço é propriedade do Zernio (seção 7) e **nada concede licença para revender ou sublicenciar**; limites de API conforme o plano (seção 3); abuso pode causar suspensão imediata (seção 3); o Zernio pode suspender a conta **sem aviso** (seção 8); a lei é a da Espanha (seção 10); uso do YouTube também obriga aceitar os termos do YouTube (seção 1).
- O próprio Zernio se vende a SaaS e agências ("Build a Platform", perfil por cliente, `headless`). Isso é sinal bom, mas é marketing, não contrato.
- Quem opera: aparecem duas razões sociais (ARBICHAT, S.L. na política de privacidade e ZERNIO SOFTWARE SL em outro registro). Confirmar com quem se assina.

Conclusão: **provavelmente permitido, mas não garantido.** Pedir confirmação escrita antes de cobrar clientes por isso.

## 7. Recomendação final

1. **Usar o Zernio** na Fase 6. Motivos: preço por conta (cabe no uso do Raniel, que começa de graça com 2 contas), cobertura das 5 redes, webhooks assinados, SDK Node, `headless` para tirar telas do Zernio.
2. **Antes de escrever código, mandar 3 perguntas ao suporte do Zernio** (texto pronto na seção 9).
3. **Começar só com contas do próprio Raniel** (até 2 grátis; o resto a US$ 6). Isso adia o problema de marca e de revenda.
4. **Plano B:** Upload-Post (white-label descrito, SDK Node, plano grátis), se o Zernio responder que não permite revenda ou que não dá para tirar a marca. Ayrshare só se o orçamento aceitar US$ 149–299/mês: é o mais caro por perfil.
5. Escrever o código com uma camada fina (`PublishProvider`) para trocar de serviço sem refazer telas.

## 8. Desenho da integração no Gravaí

### Tabelas novas (migração `0013_publicacao.sql`; todas com RLS por `user_id`, como as demais)

- `social_connections`: `id`, `user_id`, `zernio_profile_id`, `zernio_account_id`, `platform` (youtube, instagram, facebook, tiktok, x), `username`, `status` (`ativa`, `expirada`, `desconectada`), `created_at`. **Sem token de rede.** Quem guarda o token da rede é o Zernio.
- `publications`: `id`, `user_id`, `project_id`, `cut_id` (nulo = vídeo principal), `video_path` (Storage), `cover_path`, `status` (`rascunho`, `agendada`, `publicando`, `publicada`, `parcial`, `falhou`), `scheduled_for`, `timezone`, `zernio_post_id`, `idempotency_key` único, `created_at`.
- `publication_targets`: `id`, `publication_id`, `connection_id`, `platform`, `caption` (copiada de `descriptions` do projeto/corte e editável), `status`, `platform_post_url`, `error_message`, `published_at`.
- `webhook_events`: `event_id` (chave primária, evita repetição), `type`, `payload` jsonb, `received_at`, `processed_at`. Só o servidor lê.

### Telas

1. **Contas conectadas** (configurações): cartões por rede com "Conectar" / "Desconectar" e estado (ativa, expirada). Conectar chama uma rota do servidor que cria o perfil Zernio do usuário (1ª vez) e redireciona para a `authUrl`. Ao voltar, grava em `social_connections`. Avisos fixos: "Instagram precisa ser conta Business ou Creator", "Facebook precisa ser Página", "TikTok publica como público".
2. **Publicar** (no projeto pronto e em cada corte): escolher contas, ver a descrição de cada rede (já pronta, editável), capa, e escolher "Publicar agora" ou "Agendar" (data, hora, fuso de São Paulo). Validação antes de enviar: duração × limite de cada rede, tamanho do arquivo (Instagram 300 MB), conta ativa. Mostrar o que vai ficar de fora e por quê.
3. **Status**: lista de publicações com selo por rede (agendada, publicando, publicada com link, falhou com motivo) e botão "Tentar de novo" nas que falharam.

### Fluxo técnico

1. "Publicar" cria `publications` + `publication_targets` e chama `posts.createPost` com `x-request-id` = `idempotency_key`. O vídeo vai por URL assinada de curta duração do Storage privado.
2. Rota `POST /api/webhooks/zernio`: lê o corpo bruto, confere HMAC (comparação de tempo constante), grava em `webhook_events` (ignora `event_id` repetido), responde 200 e atualiza `publication_targets` em segundo plano.
3. Tarefa periódica: para alvos "agendada/publicando" além da hora, consulta `posts.getPost` (rede de segurança se o webhook falhar).
4. Reuso do que existe: textos vêm de `descriptions` (por rede) do projeto e dos cortes; vídeos vêm dos arquivos gerados pelo worker.

### Onde guardar os segredos

- `ZERNIO_API_KEY` e `ZERNIO_WEBHOOK_SECRET`: **somente variáveis de ambiente do servidor** (Vercel, marcadas como sensíveis). Nunca em código, nunca no navegador, nunca em tabela, nunca em commit.
- Tokens do YouTube/Instagram/TikTok/Facebook/X: **ficam no Zernio**. O Gravaí guarda só `zernio_account_id`. Isso reduz muito o estrago se o banco vazar.
- Rotas de publicar e de webhook rodam só no servidor; a chave usa uma única conta de serviço do Zernio com chave própria do app, e pode ser trocada (rotacionada) pela API.
- Webhook: validar assinatura, limitar tamanho do corpo, não confiar em dados do corpo sem conferir o `externalId` contra `publications`.

## 9. Riscos

| Risco | Gravidade | O que fazer |
|---|---|---|
| Tela de login da rede mostra "Zernio", não "Gravaí" | Média | Perguntar ao suporte; aceitar no começo |
| Termos não liberam revenda por escrito | Alta se for vender | Resposta escrita antes de cobrar clientes |
| Zernio pode suspender a conta sem aviso (seção 8 dos termos) | Média | Camada `PublishProvider`; guardar vídeos e textos no Gravaí; ter o Upload-Post como reserva |
| Conta de YouTube não verificada: capa ignorada e vídeo longo limitado a 15 min | Baixa | Avisar na tela; pedir verificação por telefone |
| Instagram só Business/Creator; Facebook só Página | Média (suporte ao usuário) | Texto de ajuda na tela de conectar |
| TikTok "Business app" só publica público; rascunho precisa de toque manual | Média | Oferecer "Publicar" ou "Enviar como rascunho" |
| X cobra por post (até US$ 0,20) e exige cartão | Baixa | X desligado por padrão, aviso de custo |
| Limites de tamanho/duração diferentes por rede (IG 300 MB/90 s, FB 60 s) | Média | Validar antes de enviar; render menor para Reels |
| Limite de requisições compartilhado entre clientes | Baixa | Fila e `Retry-After` |
| Webhook perdido ou repetido | Média | Idempotência por `event_id` + consulta periódica |
| Preço muda | Baixa | Conferir a página de preços antes de cada novo cliente |
| Falta de pesquisa: página "Media & Video", guia de conexão e outras páginas não foram lidas por completo | Média | 1ª tarefa da Fase 6 é um teste real com conta própria |

## 10. Passos do Raniel

Nada disso foi feito. Cada item exige a sua ação.

1. **Mandar este e-mail ao suporte do Zernio** (peça para eu revisar antes de enviar):
   > Estou construindo o Gravaí, um app que publica vídeos para meus clientes. Pergunto: (1) posso usar o Zernio revendendo o acesso aos meus clientes, com um perfil por cliente? (2) A tela de autorização do YouTube/Instagram/TikTok pode mostrar a marca "Gravaí" em vez de "Zernio", ou posso usar meus próprios apps nas redes? (3) Quais os limites de vídeo do X e do guia de upload de mídia?
2. **Criar a conta no Zernio** (só você, com cartão se quiser; as 2 primeiras contas conectadas são grátis). Eu não posso criar conta nem aceitar termos por você.
3. **Gerar a chave de API** no painel e **guardá-la**. A chave só aparece uma vez. Não cole a chave no chat. Eu vou pedir que você a coloque direto na Vercel e no arquivo local `.env` (que não vai para o Git).
4. **Escolher o segredo do webhook** (uma senha longa e aleatória) e colocar na Vercel como `ZERNIO_WEBHOOK_SECRET`. Eu gero o comando quando chegar a hora.
5. **Preparar as contas de teste:** Instagram em modo Business/Creator ligado a uma Página do Facebook; canal do YouTube (idealmente verificado por telefone em youtube.com/verify); conta de TikTok; Página do Facebook.
6. Só depois disso a Fase 6 pode ser construída.

## Fontes

- Preços: <https://zernio.com/pricing>
- Documentação (início, chave, conexão, SDK, agendamento): <https://docs.zernio.com>
- Índice da documentação: <https://docs.zernio.com/llms.txt>
- Plataforma multi-cliente e `headless`: <https://docs.zernio.com/multi-tenant>
- Webhooks: <https://docs.zernio.com/webhooks> e <https://docs.zernio.com/webhooks/posts>
- YouTube: <https://docs.zernio.com/platforms/youtube.mdx>
- Instagram: <https://docs.zernio.com/platforms/instagram.mdx>
- TikTok: <https://docs.zernio.com/platforms/tiktok.mdx>
- Facebook: <https://docs.zernio.com/platforms/facebook.mdx>
- X: <https://docs.zernio.com/platforms/twitter.mdx>
- Termos de uso: <https://zernio.com/tos>; diretrizes de conteúdo: <https://zernio.com/content-guidelines>
- White-label no Facebook (blog Zernio): <https://zernio.com/blog/whitelabel-facebook-oauth-integration-guide>
- Pedido de tela OAuth personalizável: <https://zernio.featurebase.app/p/trophy-quick-high-value-customizable-hosted-ui-for-oauth-workflow>
- Zernio × Upload-Post (marketing do próprio Zernio): <https://zernio.com/alternatives/uploadpost>
- Ayrshare: <https://www.ayrshare.com/pricing/>
- Upload-Post: <https://www.upload-post.com/>

Limites desta pesquisa: as páginas foram resumidas por ferramenta de leitura, não conferidas linha a linha. Antes de construir, os números de limite de cada rede (principalmente Instagram 300 MB/90 s e Facebook 60 s) devem ser conferidos de novo na página oficial e em um teste real.
