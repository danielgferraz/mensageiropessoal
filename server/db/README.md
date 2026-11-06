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
- **Rollback:**
  1. Remova o drop-in, rode `daemon-reload` e reinicie o `mensageiro`. As rotas `/state` passam a responder 503 e o resto do app continua funcionando.
  2. Rode `DROP DATABASE mensageiro; DROP ROLE mensageiro_app;`.
- **Risco residual:** o role consegue *conectar* aos bancos `postgres` e `_supabase`, porque o CONNECT vem de PUBLIC no stack legado. Lá ele não lê `auth` nem `storage`, mas tem acesso de PUBLIC ao `pg_net` (`net.http_*`). Para fechar isso sem mexer no stack, a proposta é um login event trigger (PG17) nesses dois bancos, que barra `mensageiro_app`. Ainda não foi aplicado: falta aprovação.
- **Modo:** só sugestão. `COPILOT_ALLOW_AUTOMATIC` continua proibido e nenhuma rota envia mensagem sozinha.
