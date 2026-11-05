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
