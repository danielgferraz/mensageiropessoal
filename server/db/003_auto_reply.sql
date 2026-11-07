-- Mensageiro · 003_auto_reply — opt-in de resposta automática por conversa (padrão: desligado em todas).
-- Rodar como supabase_admin no banco "mensageiro". Idempotente.
-- Sem esta coluna o servidor continua funcionando: o envio automático fica indisponível e tudo segue só como sugestão.

BEGIN;
ALTER TABLE mensageiro.conversations ADD COLUMN IF NOT EXISTS auto_reply boolean NOT NULL DEFAULT false;
INSERT INTO mensageiro.schema_migrations (version) VALUES ('003_auto_reply') ON CONFLICT DO NOTHING;
COMMIT;
