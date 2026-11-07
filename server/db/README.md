# Banco do Mensageiro (isolado)

- **Onde:** container `supabase-db`, do stack `/srv/stacks/supabase` (é o legado, separado de `techagenda-core-db-1`). Banco `mensageiro`, schema `mensageiro`.
- **Role:** `mensageiro_app`, com LOGIN e sem superuser, createdb, createrole ou bypassrls. Limite de 10 conexões. `search_path=mensageiro`. Só tem CONNECT no banco `mensageiro`, que tem `REVOKE ALL FROM PUBLIC`.
- **Privilégios:** DML mínimo. `audit` e `message_authorship` aceitam só INSERT e SELECT. `notes` não aceita UPDATE. RLS fica ligado e forçado em todas as tabelas, com uma policy só para `mensageiro_app`.
- **Conexão:** o `server.mjs` conecta pela env `MENSAGEIRO_DATABASE_URL`, através do pooler local `127.0.0.1:54322` (o Supavisor, em modo sessão, com o usuário `mensageiro_app.<tenant>`). Não passa por Kong/PostgREST e nada fica exposto para fora.
- **Segredo:** a senha fica em `/etc/mensageiro/db.pass` e a URL em `/etc/mensageiro/db.env` (root, 0600). O systemd carrega a URL pelo drop-in `/etc/systemd/system/mensageiro.service.d/10-state-db.conf`. O `agy` não recebe essa env.
- **Migrações:** `000_bootstrap.sql` roda como `supabase_admin` no banco `postgres`. `001_init.sql` roda como `supabase_admin` no banco `mensageiro`. As duas são idempotentes:
  ```sh
  sudo docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -v app_password="$(sudo cat /etc/mensageiro/db.pass)" < 000_bootstrap.sql
  sudo docker exec -i supabase-db psql -U supabase_admin -d mensageiro -v ON_ERROR_STOP=1 < 001_init.sql
  ```
- **`003_auto_reply.sql` (resposta automática por conversa):** adiciona `conversations.auto_reply boolean NOT NULL DEFAULT false` (todas as conversas começam desligadas). Idempotente, roda como `supabase_admin` no banco `mensageiro`:
  ```sh
  sudo docker exec -i supabase-db psql -U supabase_admin -d mensageiro -v ON_ERROR_STOP=1 < 003_auto_reply.sql
  ```
  Sem a migração o servidor funciona normalmente e a resposta automática fica indisponível (tudo só sugestão). Rollback: `ALTER TABLE mensageiro.conversations DROP COLUMN auto_reply;`.
- **Rollback:**
  1. Remova o drop-in, rode `daemon-reload` e reinicie o `mensageiro`. As rotas `/state` passam a responder 503 e o resto do app continua funcionando.
  2. Rode `DROP DATABASE mensageiro; DROP ROLE mensageiro_app;`.
- **Login compartilhado, dados isolados:** o login do Mensageiro usa o auth do TechAgenda pelo Kong `127.0.0.1:18180` (`/auth/v1` + `profiles` no `techagenda-core-db-1`). Isso foi mantido de propósito. Notas, CRM, estado por conversa e auditoria ficam só no banco `mensageiro`, que é outro Postgres (o do stack legado). O banco `mensageiro` não tem nenhuma tabela de usuário.
- **Bloqueio dos outros bancos (`002_block_other_dbs.sql`, aplicado em 06/11/2026):** um login event trigger, `mensageiro_block_login`, nos bancos `postgres` e `_supabase` recusa conexões de `mensageiro_app`. Isso corta o acesso PUBLIC ao `pg_net`. Nenhum outro role é afetado.
  - Para aplicar de novo, rode em cada banco:
    ```sh
    sudo docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < 002_block_other_dbs.sql
    ```
  - Ao aplicar pela primeira vez, encerre as sessões de `mensageiro_app` que o pooler já tinha abertas nesses bancos:
    ```sql
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename='mensageiro_app' AND datname IN ('postgres','_supabase');
    ```
  - Rollback, em cada banco:
    ```sql
    DROP EVENT TRIGGER IF EXISTS mensageiro_block_login; DROP FUNCTION IF EXISTS public.mensageiro_block_login();
    ```
  - Emergência: `PGOPTIONS='-c event_triggers=off'` como superusuário.
- **Modo:** só sugestão. `COPILOT_ALLOW_AUTOMATIC` continua proibido e nenhuma rota envia mensagem sozinha.
