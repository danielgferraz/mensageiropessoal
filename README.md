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
- O webhook não usa token de admin: exige o segredo `EVOLUTION_WEBHOOK_SECRET` (cabeçalho `x-webhook-secret`, `Authorization: Bearer` ou `?token=`). Sem a variável, responde `503`. Defina o segredo só no ambiente do serviço.
- Configuração na Evolution (por instância), feita pelo administrador da VPS com a chave da Evolution fora do Git:

```json
POST {EVOLUTION_URL}/webhook/set/WA
{ "webhook": { "enabled": true, "url": "http://<host-do-servico>:3333/api/webhook/evolution",
  "headers": { "x-webhook-secret": "<EVOLUTION_WEBHOOK_SECRET>" }, "byEvents": false, "base64": false, "events": ["MESSAGES_UPSERT"] } }
```

- **Envio automático (opt-in por conversa)**: só envia quando TODAS as travas passam: `COPILOT_ALLOW_AUTOMATIC=1` no serviço; atendente ligado, fora de pausa e em modo **Automático** (Configurações); migração `003_auto_reply.sql` aplicada; a conversa tem "Ativar resposta automática" ligado (confirmação explícita, uma a uma, só conversas individuais) e ninguém assumiu; mensagem de texto puro com até 2 min; rascunho com fonte aprovada da base NebrIA (`AUTO_REPLY_REQUIRE_SOURCES=0` desliga essa exigência) e aprovado pelo filtro de saída; ainda atual (sem mensagem mais nova); respeita a janela (`AUTO_REPLY_MIN_INTERVAL_MS`, 60000), o limite por conversa/hora (`AUTO_REPLY_MAX_PER_CONV_HOUR`, 3) e o global/hora (`AUTO_REPLY_MAX_PER_HOUR`, 10). Qualquer dúvida, falha ou limite deixa o texto como sugestão. O rascunho é reservado no banco antes do envio (descartado = não envia) e falha de envio nunca tenta de novo. Humano responde (celular ou app) => pausa a conversa; assumir/desligar a IA também. Nunca envia mídia, áudio ou figurinha, nem para grupos. Auditoria `auto_sent`/`auto_skip`/`auto_paused` sem o texto das mensagens. Kill switch: remover `COPILOT_ALLOW_AUTOMATIC` (o modo salvo volta a valer como sugestão) ou pausar o atendente.
- O atendente (aba Configurações) continua sendo a chave geral: com `enabled=false` ou `paused=true` nada é gerado. Ligar "Ligar sugestões" numa conversa vale como autorização daquele contato para rascunhos automáticos (grupos nunca geram).

## Validação

```bash
pnpm test
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm lint
pnpm build
```

Testes requerem Node 22.18+ ou Node 24. Os testes HTTP usam upstream local com dados fictícios e não enviam mensagens externas. Para inspeção visual isolada, execute `node tests/browser-fixture.mjs` (ou `node docs/qa/20261106-scroll-antigravity/fixture.mjs`, que também simula webhook, banco de estado e Antigravity; portas 4455/3355) e abra `http://localhost:3333/mensageiro/`; esse servidor de testes nunca deve ser instalado como serviço de produção.

Antes de atualizar a VPS, preserve `dist`, `server/server.mjs` e o ambiente atual. Publique ambos os diretórios da mesma release, reinicie somente `mensageiro.service` e valide HTTP, acesso anônimo negado e leitura autenticada de instâncias/conversas. Reverta os dois artefatos juntos se a verificação falhar. Nunca inclua `tests/browser-fixture.mjs` na inicialização do serviço.
