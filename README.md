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

## Validação

```bash
pnpm test
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm lint
pnpm build
```

Testes requerem Node 22.18+ ou Node 24. Os testes HTTP usam upstream local com dados fictícios e não enviam mensagens externas. Para inspeção visual isolada, execute `node tests/browser-fixture.mjs` e abra `http://localhost:3333/mensageiro/`; esse servidor de testes nunca deve ser instalado como serviço de produção.

Antes de atualizar a VPS, preserve `dist`, `server/server.mjs` e o ambiente atual. Publique ambos os diretórios da mesma release, reinicie somente `mensageiro.service` e valide HTTP, acesso anônimo negado e leitura autenticada de instâncias/conversas. Reverta os dois artefatos juntos se a verificação falhar. Nunca inclua `tests/browser-fixture.mjs` na inicialização do serviço.
