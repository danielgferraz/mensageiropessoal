# Mensageiro Pessoal | TechAgenda

Aplicação web e PWA de mensageria com interface baseada no WhatsApp Web, totalmente integrada ao ecossistema do **TechAgenda**.

## 🚀 Tecnologias e Arquitetura

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Shadcn UI, Lucide Icons
- **Backend Node.js:** Servidor HTTP nativo com proxy reverso e endpoints para:
  - **WhatsApp Evolution API v2:** Gestão de instâncias, QR Code, envio e recebimento de mensagens e sincronização de conversas.
  - **Antigravity Copilot:** Integração nativa com o CLI `agy` na VPS Oracle para assistência técnica com IA.
  - **Supabase Auth + RBAC:** Proteção rigorosa de rotas e APIs com perfil exclusivo de `admin`.
- **PWA:** Service Worker para cache offline, Web App Manifest com instalação no Android, iOS e Desktop.

## 🔐 Segurança e Políticas de Acesso

- O acesso à interface e aos endpoints de API é restrito exclusivamente a usuários com a role `admin` em `public.profiles`.
- Se o usuário já estiver autenticado no TechAgenda, o login ocorre de forma transparente (SSO via sessão local).
- Usuários não-administradores recebem tela de bloqueio e status `403 Forbidden`.

## 📦 Execução Local e Produção

```bash
# Instalação das dependências
pnpm install

# Build de produção
pnpm build

# Servidor de produção (porta 3333)
node server/server.mjs
```

## 🌐 Produção (VPS Oracle Cloud)

Hospedado na VPS sob o serviço systemd `mensageiro.service` e servido via Nginx com terminação TLS/HTTPS em:
`https://techagenda.app.br/mensageiro/`


## Conversas reais e atualização

- A instância `WA` conectada é selecionada automaticamente; se ela estiver fechada, usa outra instância com estado `open`.
- A lista é atualizada a cada 5 segundos e a conversa aberta a cada 3 segundos, enquanto a página está visível. Histórico em páginas de 50 mensagens, com botão para carregar anteriores.
- Envios de texto passam pelo backend autenticado e usam o JID real do contato ou grupo. Não há respostas automáticas nem confirmações de leitura simuladas. Em falha, o rascunho é preservado; confira a conversa antes de reenviar quando a resposta for incerta.
- As conversas e mensagens remotas ficam na memória da sessão. Os antigos exemplos em localStorage não são carregados como conversas reais. Notas, etiquetas e CRM continuam sendo recursos locais.
- Fotos, vídeos, áudio e documentos recebidos aparecem como resumo textual. Envio de mídia/áudio, criação de grupos e reações remotas não fazem parte desta entrega; use o WhatsApp para essas ações.

## Configuração do backend

Configure `EVOLUTION_APIKEY` somente no ambiente do serviço systemd. Sem essa variável, a API WhatsApp falha fechada com HTTP 503. Configure também `EVOLUTION_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PORT` e `AGY_BIN` conforme a VPS. Não coloque a chave Evolution no frontend ou no Git.

Uma chave que tenha sido incluída anteriormente no código/histórico deve ser rotacionada na Evolution e no ambiente do serviço pelo administrador da VPS. Esta alteração remove o fallback do código, mas não reescreve o histórico Git.

## Antigravity no fluxo de respostas

- **Chat do Antigravity** (`POST /api/antigravity/chat`, admin): o servidor monta o prompt com o contexto real da conversa (contato, últimas mensagens da Evolution, notas, estágio do CRM e estado da IA), responde sempre em pt-BR (uma segunda passada reescreve respostas em inglês), mascara caminhos internos/segredos e devolve erros claros (`503` fora do ar, `504` demora, `502` falha). Ele só sugere: notas, estágio e "aguardando retorno" só são gravados depois do clique de confirmação na interface. O `agy` roda sem `MENSAGEIRO_DATABASE_URL`/`EVOLUTION_APIKEY`. Opcional: `AGY_CWD` aponta uma pasta vazia para o `agy` trabalhar (teste antes de ativar).
- **Sugestão automática** (`POST /api/webhook/evolution`): a Evolution avisa `messages.upsert`; se a conversa tem sugestões ligadas e nenhum humano assumiu, o servidor gera um rascunho e grava em `ai_suggestions` (kind `reply`, com `sourceMessageId`, `auto: true`). Uma sugestão pendente por conversa; mensagem nova (ou resposta humana) descarta a antiga; debounce (`AUTO_SUGGEST_DEBOUNCE_MS`, padrão 4000), limite por hora (`AUTO_SUGGEST_MAX_PER_HOUR`, padrão 20, além dos limites do atendente), auditoria sem texto de mensagem. **Nunca envia**: `COPILOT_ALLOW_AUTOMATIC` continua desligado e o envio só acontece com o clique do administrador.
- **Espera de 6 s com reinício e "digitando…"**: a resposta (e o rascunho de sugestão) só é gerada 6 s depois da ÚLTIMA mensagem do contato; cada mensagem nova reinicia a contagem e a rajada vira UMA resposta (`AUTO_SUGGEST_DEBOUNCE_MS`, padrão 6000). Quando uma resposta automática ainda é possível (todas as travas passam e há fonte aprovada para a pergunta), o servidor mostra "digitando…" ao contato via Evolution (`POST /chat/sendPresence/{instância}`, `composing`) desde o início da espera, renova a presença a cada 8 s enquanto espera/gera e encerra sempre com `paused` (após enviar, abortar, cair para sugestão ou falhar; teto de segurança de 150 s). Se um humano assumir, a IA for desligada ou o atendente pausar durante a espera, a resposta é cancelada e o "digitando" some em até 2 s. Nunca em grupos, conversas sem opt-in ou só-sugestão.
- **Tom natural (como o Daniel)**: o prompt do atendente fala em primeira pessoa, em português informal de WhatsApp, 1 a 2 frases, espelhando o contato, sem lista, "Prezado", "Como posso ajudar?" nem frase de atendimento robotizado, varia a abertura e nunca diz que é robô/bot/IA. O filtro de saída barra (e pede uma única reescrita) respostas que soam como robô, citam IA/bot ou fazem lista. **Perguntas de identidade** ("você é um robô/pessoa de verdade?") nunca são respondidas pela IA (nem negando nem confirmando): vão para o humano (`identity_question`). Reclamação, cancelamento, reembolso, negociação e questão jurídica sempre viram handoff (nada é enviado) e o marcador `[ENCAMINHAR]` nunca chega ao contato.
- **Prompt v3 (tom de conversa)**: respostas curtas (1 frase na maioria; 2 só quando precisar; até 2 bolhas separadas por linha em branco, enviadas em sequência com o "digitando" ligado), espelhando o registro e as gírias do contato, no máximo 1 emoji e só se o contato usou, abertura sempre diferente (o servidor guarda as aberturas das últimas respostas e o prompt manda evitá-las; `AUTO_REPLY_ANTI_REPEAT=0` desliga), sem muletas ("fico à disposição", "qualquer dúvida", "estou aqui para ajudar", "claro!", "com certeza!"). Filtro "soa humano" (só na resposta automática): se parecer atendente genérico, longa demais, com emoji demais ou abertura repetida, reescreve UMA vez; se persistir, não envia. **Meu jeito de escrever** (Configurações > Atendente): você busca e escolhe até 10 mensagens suas (curtas, sem número, link, e-mail nem nome de pessoa; só mensagens enviadas por você) e elas entram no prompt como exemplos de estilo (nunca de conteúdo); ficam em `server/data/style-samples.json`, a auditoria só guarda a quantidade.
- **Fonte não é trava dura com `AUTO_REPLY_REQUIRE_SOURCES=0`**: conversa social (oi, tudo bem, obrigado, tchau) é respondida sem trecho aprovado. Fatos (preço, prazo, garantia, condição, desconto...) só com trecho aprovado: sem trecho, a resposta automática não pode conter número, valor ou prazo (o filtro bloqueia) e, por padrão, fica no "deixa eu confirmar e já te falo" (`AUTO_REPLY_FACT_NO_SOURCE=confirm`); com `AUTO_REPLY_FACT_NO_SOURCE=suggest`, pergunta de fato sem trecho vira só sugestão. Padrão do servidor continua `AUTO_REPLY_REQUIRE_SOURCES` ligado (sem a env, tudo sem fonte fica como sugestão).
- O webhook não usa token de admin: exige o segredo `EVOLUTION_WEBHOOK_SECRET` (cabeçalho `x-webhook-secret`, `Authorization: Bearer` ou `?token=`). Sem a variável, responde `503`. Defina o segredo só no ambiente do serviço.
- Configuração na Evolution (por instância), feita pelo administrador da VPS com a chave da Evolution fora do Git:

```json
POST {EVOLUTION_URL}/webhook/set/WA
{ "webhook": { "enabled": true, "url": "http://<host-do-servico>:3333/api/webhook/evolution",
  "headers": { "x-webhook-secret": "<EVOLUTION_WEBHOOK_SECRET>" }, "byEvents": false, "base64": false, "events": ["MESSAGES_UPSERT"] } }
```

- **Envio automático (opt-in por conversa)**: só envia quando TODAS as travas passam: `COPILOT_ALLOW_AUTOMATIC=1` no serviço; atendente ligado, fora de pausa e em modo **Automático** (Configurações); migração `003_auto_reply.sql` aplicada; a conversa tem "Ativar resposta automática" ligado (confirmação explícita, uma a uma, só conversas individuais) e ninguém assumiu; mensagem de texto puro com até 2 min; rascunho com fonte aprovada da base NebrIA (`AUTO_REPLY_REQUIRE_SOURCES=0` desliga essa exigência) e aprovado pelo filtro de saída; ainda atual (sem mensagem mais nova); respeita a janela entre respostas da mesma conversa (`AUTO_REPLY_MIN_INTERVAL_MS`, 60000) e o limite global/hora (`AUTO_REPLY_MAX_PER_HOUR`, 10). **Sem teto por conversa** (decisão do usuário): `AUTO_REPLY_MAX_PER_CONV_HOUR` (ou `AUTO_REPLY_MAX_PER_CONVERSATION`) vem desligada (0); defina um número para reativar um teto por conversa/hora. O limite "rascunhos por hora por contato" das Configurações não vale para o fluxo automático das conversas com opt-in (continua valendo no pedido manual); o limite diário de rascunhos e o global/hora continuam. Qualquer dúvida, falha ou limite deixa o texto como sugestão. O rascunho é reservado no banco antes do envio (descartado = não envia) e falha de envio nunca tenta de novo. Humano responde (celular ou app) => pausa a conversa; assumir/desligar a IA também. Nunca envia mídia, áudio ou figurinha, nem para grupos. Auditoria `auto_sent`/`auto_skip`/`auto_paused` sem o texto das mensagens. Kill switch: remover `COPILOT_ALLOW_AUTOMATIC` (o modo salvo volta a valer como sugestão) ou pausar o atendente.
- O atendente (aba Configurações) continua sendo a chave geral: com `enabled=false` ou `paused=true` nada é gerado. Ligar "Ligar sugestões" numa conversa vale como autorização daquele contato para rascunhos automáticos (grupos nunca geram).

## Menus e botões (construtor)

- Página **Menus e botões** (menu lateral): você cria menus com nome interno, texto de abertura (escreva como numa conversa; o editor avisa se soar como URA), botões ordenados (arrastar ou ▲▼) e, em cada botão, uma lista ordenada de ações: **responder texto**, **pedir um dado** (nome, e-mail, cidade, tipo de serviço ou campo próprio, com validação), **mover no CRM e/ou criar nota** (decisão humana, auditada), **chamar o Daniel** (assume a conversa e desliga o automático) e **ir para outro menu** (sem ciclos, máx. 5 em cadeia). Prévia dos dois modos e simulador de clique (nada é enviado).
- **Envio sempre manual**: "Enviar menu…" no menu do chat (⋮ e anexos) -> escolhe o menu e o modo -> prévia exata -> Enviar. Nunca vai na primeira mensagem e nunca automático. Faixa "Menu em andamento · Encerrar" na conversa; a sessão vale 30 min (renova a cada resposta válida) e cancela se você escrever na conversa.
- **Dois modos por menu** (padrão de fábrica: texto numerado): *Botões do WhatsApp* (rota `sendButtons` da Evolution para até 3 opções; `sendList` acima disso) e *Texto numerado* ("1 - Serviços ... me responde com o número ou o nome da opção"). Erro explícito do modo nativo (ex.: 400 `this.isZero is not a function`) cai para texto numerado **uma única vez**, sem duplicar. Atenção: no Baileys a API pode responder 201 e o contato nunca receber; a interface avisa isso e oferece **"Reenviar como texto"** com um clique. `MENUS_NATIVE=0` força só texto; `MENUS_ENABLED=0` desliga envio e roteamento.
- **Roteamento das respostas** (mesmo para texto e botão): número ("1", "1.", "opção 1", "1️⃣"), rótulo/apelido (mensagem inteira) ou id do botão. Inválido: reenvia as opções uma vez e depois devolve a conversa à IA/você. Enquanto há sessão a IA não responde àquela mensagem. Dados pedidos ficam em `contact_data`; grupos nunca.
- **Auditoria** (`copilot-audit.jsonl`): `menu_sent` com `modeRequested`/`modeUsed`/`fallback`, `menu_choice`, `menu_field`, `menu_crm`, `menu_handoff`, `menu_invalid`, `menu_abandoned`, `menu_expired`, `menu_cancelled`, `menu_admin`. Nunca guarda o que o contato digitou.
- **Banco**: migração `server/db/005_menus.sql` (menus, menu_items, menu_sessions, contact_data; RLS). Sem ela, `/api/menus` responde 503 `menus_unavailable`, a página avisa e o resto do app segue normal. API admin: `/api/menus` (CRUD), `PUT /api/menus/:id/items` (lista inteira, ordenada e validada, transação), `POST /api/menus/preview`, `POST /api/menus/:id/send`, `GET|DELETE /api/menu-sessions?jid=`, `GET /api/menus/capabilities`. Estudo e decisões: `docs/botoes-menus-estudo.md`.

## Validação

```bash
pnpm test
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm lint
pnpm build
```

Testes requerem Node 22.18+ ou Node 24. Os testes HTTP usam upstream local com dados fictícios e não enviam mensagens externas. Para inspeção visual isolada, execute `node tests/browser-fixture.mjs` (ou `node docs/qa/20261106-scroll-antigravity/fixture.mjs`, que também simula webhook, banco de estado e Antigravity; portas 4455/3355) e abra `http://localhost:3333/mensageiro/`; esse servidor de testes nunca deve ser instalado como serviço de produção.

Antes de atualizar a VPS, preserve `dist`, `server/server.mjs` e o ambiente atual. Publique ambos os diretórios da mesma release, reinicie somente `mensageiro.service` e valide HTTP, acesso anônimo negado e leitura autenticada de instâncias/conversas. Reverta os dois artefatos juntos se a verificação falhar. Nunca inclua `tests/browser-fixture.mjs` na inicialização do serviço.
