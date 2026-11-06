-- Mensageiro · bootstrap do banco isolado no Postgres do stack /srv/stacks/supabase (container supabase-db).
-- Rodar como superusuário (supabase_admin) no banco "postgres". Idempotente.
-- Uso: psql -v app_password="<senha>" -f 000_bootstrap.sql   (a senha vem de /etc/mensageiro/db.env, nunca do git)
-- Rollback: DROP DATABASE mensageiro; DROP ROLE mensageiro_app;

SELECT format('CREATE ROLE mensageiro_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 10 PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mensageiro_app') \gexec

SELECT format('ALTER ROLE mensageiro_app PASSWORD %L', :'app_password') \gexec

SELECT 'CREATE DATABASE mensageiro OWNER supabase_admin'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'mensageiro') \gexec

REVOKE ALL ON DATABASE mensageiro FROM PUBLIC;
GRANT CONNECT ON DATABASE mensageiro TO mensageiro_app;
ALTER ROLE mensageiro_app SET search_path = mensageiro;
