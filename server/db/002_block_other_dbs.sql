-- Mensageiro · 002 — impede o role mensageiro_app de entrar nos bancos compartilhados do stack legado.
-- Motivo: o CONNECT vem de PUBLIC em "postgres" e "_supabase", e lá o PUBLIC alcança o pg_net (net.http_*).
-- Rodar como supabase_admin EM CADA banco, "postgres" e "_supabase". Idempotente. Requer PostgreSQL 17+ (login event trigger).
--   sudo docker exec -i supabase-db psql -U supabase_admin -d postgres  -v ON_ERROR_STOP=1 < 002_block_other_dbs.sql
--   sudo docker exec -i supabase-db psql -U supabase_admin -d _supabase -v ON_ERROR_STOP=1 < 002_block_other_dbs.sql
-- Afeta SÓ quem entra como mensageiro_app; nenhum outro role é tocado.
-- Rollback (em cada banco):
--   DROP EVENT TRIGGER IF EXISTS mensageiro_block_login; DROP FUNCTION IF EXISTS public.mensageiro_block_login();
-- Emergência (se um login trigger com defeito travar conexões): conectar como superusuário com
--   PGOPTIONS='-c event_triggers=off' psql -U supabase_admin -d <banco>   e rodar o rollback.

CREATE OR REPLACE FUNCTION public.mensageiro_block_login() RETURNS event_trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF session_user = 'mensageiro_app' THEN
    RAISE EXCEPTION 'mensageiro_app só pode conectar ao banco mensageiro';
  END IF;
END
$$;
REVOKE ALL ON FUNCTION public.mensageiro_block_login() FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'mensageiro_block_login') THEN
    CREATE EVENT TRIGGER mensageiro_block_login ON login EXECUTE FUNCTION public.mensageiro_block_login();
  END IF;
END
$$;
