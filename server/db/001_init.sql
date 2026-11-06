-- Mensageiro · 001_init — schema de estado por conversa, notas, CRM, sugestões da IA e auditoria.
-- Rodar como superusuário no banco "mensageiro". Idempotente (pode rodar de novo).
-- Modo SOMENTE SUGESTÃO: nada aqui envia mensagem; o envio automático não existe nesta versão.

BEGIN;

CREATE SCHEMA IF NOT EXISTS mensageiro AUTHORIZATION supabase_admin;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA mensageiro FROM PUBLIC;
GRANT USAGE ON SCHEMA mensageiro TO mensageiro_app;

CREATE TABLE IF NOT EXISTS mensageiro.schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Estado por conversa (jid canônico @s.whatsapp.net / @g.us / @lid)
CREATE TABLE IF NOT EXISTS mensageiro.conversations (
  jid                 text PRIMARY KEY,
  ai_enabled          boolean NOT NULL DEFAULT false,
  mode                text    NOT NULL DEFAULT 'suggestion' CHECK (mode IN ('suggestion', 'human')),
  taken_over_at       timestamptz,
  last_ai_reply_at    timestamptz,
  last_human_reply_at timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Notas internas (nunca enviadas ao contato)
CREATE TABLE IF NOT EXISTS mensageiro.notes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jid        text NOT NULL,
  author     text NOT NULL CHECK (author IN ('ia', 'humano')),
  text       text NOT NULL CHECK (length(text) BETWEEN 1 AND 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_jid_created_idx ON mensageiro.notes (jid, created_at DESC);

-- Estágio do CRM por contato (stage NULL = fora do pipeline)
CREATE TABLE IF NOT EXISTS mensageiro.crm_stages (
  jid        text PRIMARY KEY,
  stage      text CHECK (stage IS NULL OR length(stage) BETWEEN 1 AND 64),
  updated_by text NOT NULL CHECK (updated_by IN ('ia', 'humano')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sugestões da IA aguardando decisão humana (resposta, estágio de CRM)
CREATE TABLE IF NOT EXISTS mensageiro.ai_suggestions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jid         text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('reply', 'crm_stage')),
  payload     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS ai_suggestions_jid_status_idx ON mensageiro.ai_suggestions (jid, status, created_at DESC);

-- Autoria das mensagens enviadas pelo Mensageiro (indicador IA x humano)
CREATE TABLE IF NOT EXISTS mensageiro.message_authorship (
  message_id text PRIMARY KEY,
  jid        text NOT NULL,
  author     text NOT NULL CHECK (author IN ('ia', 'humano')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_authorship_jid_idx ON mensageiro.message_authorship (jid);

-- Auditoria append-only
CREATE TABLE IF NOT EXISTS mensageiro.audit (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at     timestamptz NOT NULL DEFAULT now(),
  actor  text NOT NULL CHECK (actor IN ('ia', 'humano', 'sistema')),
  action text NOT NULL,
  jid    text,
  before jsonb,
  after  jsonb
);
CREATE INDEX IF NOT EXISTS audit_jid_at_idx ON mensageiro.audit (jid, at DESC);

-- Privilégios mínimos: DML só onde precisa; auditoria só INSERT/SELECT
GRANT SELECT, INSERT, UPDATE ON mensageiro.conversations, mensageiro.crm_stages, mensageiro.ai_suggestions TO mensageiro_app;
GRANT SELECT, INSERT, DELETE ON mensageiro.notes TO mensageiro_app;
GRANT SELECT, INSERT ON mensageiro.message_authorship, mensageiro.audit TO mensageiro_app;
GRANT SELECT ON mensageiro.schema_migrations TO mensageiro_app;

-- RLS: só o role do backend do Mensageiro (que exige token de admin na API) enxerga as linhas
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conversations','notes','crm_stages','ai_suggestions','message_authorship','audit'] LOOP
    EXECUTE format('ALTER TABLE mensageiro.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE mensageiro.%I FORCE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'mensageiro' AND tablename = t AND policyname = 'mensageiro_app_all') THEN
      EXECUTE format('CREATE POLICY mensageiro_app_all ON mensageiro.%I TO mensageiro_app USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

INSERT INTO mensageiro.schema_migrations (version) VALUES ('001_init') ON CONFLICT DO NOTHING;

COMMIT;
