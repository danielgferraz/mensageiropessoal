-- Mensageiro · 004_nebria_rag — base de conhecimento da NebrIA com pgvector (busca por similaridade).
-- Rodar como supabase_admin no banco "mensageiro". Idempotente.
-- Uso: psql -v ingest_password="<senha>" -f 004_nebria_rag.sql   (a senha vem de /etc/nebria/ingest.pass, nunca do git)
-- Embedding: OpenAI text-embedding-3-small (1536 dimensões).
-- Papéis:
--   nebria_ingest -> grava/atualiza/apaga em nebria.knowledge (processo de ingestão, usuário Linux nebria-ingest)
--   mensageiro_app -> só SELECT, e a RLS só mostra linhas com status = 'aprovado'
-- Rollback: DROP SCHEMA nebria CASCADE; DROP ROLE nebria_ingest;  (a extensão vector vive dentro do schema e cai junto)

SELECT format('CREATE ROLE nebria_ingest LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5 PASSWORD %L', :'ingest_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nebria_ingest') \gexec
SELECT format('ALTER ROLE nebria_ingest PASSWORD %L', :'ingest_password') \gexec

BEGIN;
GRANT CONNECT ON DATABASE mensageiro TO nebria_ingest;
ALTER ROLE nebria_ingest SET search_path = nebria;

CREATE SCHEMA IF NOT EXISTS nebria AUTHORIZATION supabase_admin;
REVOKE ALL ON SCHEMA nebria FROM PUBLIC;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA nebria;
GRANT USAGE ON SCHEMA nebria TO nebria_ingest, mensageiro_app;
-- o tipo vector e o operador <=> vivem em "nebria": o backend do Mensageiro precisa enxergar esse schema
ALTER ROLE mensageiro_app SET search_path = mensageiro, nebria;

CREATE TABLE IF NOT EXISTS nebria.knowledge (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source         text NOT NULL,                       -- caminho relativo em /srv/data/nebria
  chunk_index    integer NOT NULL DEFAULT 0 CHECK (chunk_index >= 0),
  title          text,
  version        text,
  status         text NOT NULL CHECK (status IN ('rascunho', 'aprovado', 'arquivado')),
  content        text NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding      nebria.vector(1536),
  content_sha256 text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, chunk_index)
);
CREATE INDEX IF NOT EXISTS knowledge_embedding_hnsw ON nebria.knowledge USING hnsw (embedding nebria.vector_cosine_ops);
CREATE INDEX IF NOT EXISTS knowledge_status_idx ON nebria.knowledge (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON nebria.knowledge TO nebria_ingest;
GRANT SELECT ON nebria.knowledge TO mensageiro_app;

ALTER TABLE nebria.knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE nebria.knowledge FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nebria' AND tablename = 'knowledge' AND policyname = 'ingest_all') THEN
    CREATE POLICY ingest_all ON nebria.knowledge TO nebria_ingest USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nebria' AND tablename = 'knowledge' AND policyname = 'app_read_approved') THEN
    CREATE POLICY app_read_approved ON nebria.knowledge FOR SELECT TO mensageiro_app USING (status = 'aprovado');
  END IF;
END $$;

INSERT INTO mensageiro.schema_migrations (version) VALUES ('004_nebria_rag') ON CONFLICT DO NOTHING;
COMMIT;
