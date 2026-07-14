# --- Database connection -----------------------------------------------------
# Direct Postgres connection string. For Supabase: Project Settings > Database >
# Connection string (use the "session"/direct string, not the transaction pooler,
# so DDL like CREATE EXTENSION works). Keep this file out of git (.gitignore).
DATABASE_URL={{DATABASE_URL}}

# --- Embeddings --------------------------------------------------------------
# Default: OpenAI text-embedding-3-small (1536 dims). To use a different model,
# set EMBEDDING_MODEL + EMBEDDING_DIM to match, and (for local/other providers)
# point OPENAI_BASE_URL at any OpenAI-compatible endpoint (Ollama, LM Studio, ...).
EMBEDDING_PROVIDER={{EMBEDDING_PROVIDER}}
EMBEDDING_MODEL={{EMBEDDING_MODEL}}
EMBEDDING_DIM={{EMBEDDING_DIM}}
OPENAI_API_KEY={{OPENAI_API_KEY}}
OPENAI_BASE_URL={{OPENAI_BASE_URL}}

# --- Vector table ------------------------------------------------------------
RAG_TABLE={{RAG_TABLE}}

# --- Chunking ----------------------------------------------------------------
CHUNK_SIZE={{CHUNK_SIZE}}
CHUNK_OVERLAP={{CHUNK_OVERLAP}}
EMBED_BATCH_SIZE=64

# --- Files to vectorize ------------------------------------------------------
# Comma-separated extensions scanned recursively in the RAG folder.
FILE_EXTENSIONS={{FILE_EXTENSIONS}}

# --- Metadata ----------------------------------------------------------------
# Comma-separated fields stored in the metadata jsonb column.
# Supported: file (name), path (relative), folder, ext, modified.
METADATA_FIELDS={{METADATA_FIELDS}}
