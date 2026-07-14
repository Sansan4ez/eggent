-- RAG pipeline schema. Written to RAG/schema.sql during deploy, and applied
-- either via the Supabase MCP connector or directly against DATABASE_URL.
--
-- rag_sync.py also runs this same DDL idempotently on every run (ensure_schema),
-- so the operator is self-healing if this was never applied manually.
--
-- Placeholders {{EMBED_DIM}} and {{RAG_TABLE}} are substituted at deploy time.

-- 1. pgvector extension ------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Vector table ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS {{RAG_TABLE}} (
    id          bigserial PRIMARY KEY,
    content     text NOT NULL,                    -- the chunk text
    embedding   vector({{EMBED_DIM}}),            -- the embedding vector
    source_file text NOT NULL,                    -- relative path, first-class for fast deletes
    chunk_index int NOT NULL DEFAULT 0,           -- position of chunk within its file
    metadata    jsonb NOT NULL DEFAULT '{}',      -- user-chosen metadata (file name, folder, ...)
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes -----------------------------------------------------------------
-- HNSW cosine index for fast approximate nearest-neighbour search.
CREATE INDEX IF NOT EXISTS {{RAG_TABLE}}_embedding_idx
    ON {{RAG_TABLE}} USING hnsw (embedding vector_cosine_ops);

-- B-tree on source_file so "delete all rows for this file" is fast.
CREATE INDEX IF NOT EXISTS {{RAG_TABLE}}_source_file_idx
    ON {{RAG_TABLE}} (source_file);

-- 4. Retrieval function ------------------------------------------------------
-- Callable as a Supabase RPC from any client:
--   supabase.rpc('match_documents', { query_embedding, match_count, filter })
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector({{EMBED_DIM}}),
    match_count int DEFAULT 5,
    filter jsonb DEFAULT '{}'
) RETURNS TABLE (
    id bigint,
    content text,
    source_file text,
    metadata jsonb,
    similarity float
) LANGUAGE sql STABLE AS $$
    SELECT id, content, source_file, metadata,
           1 - (embedding <=> query_embedding) AS similarity
    FROM {{RAG_TABLE}}
    WHERE metadata @> filter
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;
