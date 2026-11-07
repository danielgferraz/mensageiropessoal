-- Mensageiro · 005_menus — construtor de menus/botões (menus, botões ordenados com ações, sessões e dados coletados).
-- Rodar como supabase_admin no banco "mensageiro". Idempotente.
-- Sem estas tabelas o servidor continua funcionando: as rotas /menus respondem 503 e a página mostra o aviso.

BEGIN;

CREATE TABLE IF NOT EXISTS mensageiro.menus (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text   NOT NULL CHECK (length(name) BETWEEN 1 AND 60),            -- nome interno
  description text   NOT NULL CHECK (length(description) BETWEEN 1 AND 600),    -- texto de abertura que o contato vê
  footer      text   CHECK (footer IS NULL OR length(footer) <= 60),
  render_mode text   NOT NULL DEFAULT 'text' CHECK (render_mode IN ('native', 'text')),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mensageiro.menu_items (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  menu_id  bigint NOT NULL REFERENCES mensageiro.menus(id) ON DELETE CASCADE,
  position int    NOT NULL CHECK (position BETWEEN 1 AND 10),
  label    text   NOT NULL CHECK (length(label) BETWEEN 1 AND 40),
  aliases  text[] NOT NULL DEFAULT '{}',
  actions  jsonb  NOT NULL DEFAULT '[]',                                         -- lista ordenada de {type, ...}, validada no servidor
  active   boolean NOT NULL DEFAULT true,
  CONSTRAINT menu_items_menu_position_key UNIQUE (menu_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS menu_items_menu_idx ON mensageiro.menu_items (menu_id, position);

-- Uma sessão ativa por conversa (o menu enviado e o ponto em que o contato está)
CREATE TABLE IF NOT EXISTS mensageiro.menu_sessions (
  jid        text PRIMARY KEY,
  menu_id    bigint NOT NULL REFERENCES mensageiro.menus(id) ON DELETE CASCADE,
  item_id    bigint,
  step       int    NOT NULL DEFAULT 0,
  awaiting   text   NOT NULL CHECK (awaiting IN ('choice', 'field')),
  field      text,
  attempts   int    NOT NULL DEFAULT 0,
  collected  jsonb  NOT NULL DEFAULT '{}',
  mode_used  text   NOT NULL DEFAULT 'text' CHECK (mode_used IN ('native', 'text')),
  started_by text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dados pedidos pelo menu (nome, e-mail, cidade...): só o necessário
CREATE TABLE IF NOT EXISTS mensageiro.contact_data (
  jid        text NOT NULL,
  key        text NOT NULL CHECK (key ~ '^[a-z_]{1,30}$'),
  value      text NOT NULL CHECK (length(value) <= 200),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jid, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON mensageiro.menus, mensageiro.menu_items, mensageiro.menu_sessions TO mensageiro_app;
GRANT SELECT, INSERT, UPDATE ON mensageiro.contact_data TO mensageiro_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['menus','menu_items','menu_sessions','contact_data'] LOOP
    EXECUTE format('ALTER TABLE mensageiro.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE mensageiro.%I FORCE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'mensageiro' AND tablename = t AND policyname = 'mensageiro_app_all') THEN
      EXECUTE format('CREATE POLICY mensageiro_app_all ON mensageiro.%I TO mensageiro_app USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

INSERT INTO mensageiro.schema_migrations (version) VALUES ('005_menus') ON CONFLICT DO NOTHING;
COMMIT;
