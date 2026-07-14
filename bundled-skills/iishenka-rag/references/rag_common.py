"""
rag_common.py — shared helpers for the RAG pipeline.

Deployed into RAG/scripts/. Every configuration value is read from the .env
file at the RAG folder root, so this code is universal: point it at any
Postgres/pgvector database and any OpenAI-compatible embedding endpoint.

Nothing here is skill-specific. rag_sync.py and rag_query.py both import it.
"""

import os
import sys
import json
from pathlib import Path

# --- Paths -------------------------------------------------------------------

# This file lives in RAG/scripts/. The RAG root is its parent's parent... no:
# scripts/ is directly under RAG/, so RAG root is the parent of scripts/.
SCRIPTS_DIR = Path(__file__).resolve().parent
RAG_ROOT = SCRIPTS_DIR.parent
ENV_PATH = RAG_ROOT / ".env"
INDEX_PATH = RAG_ROOT / "index.csv"
RAGIGNORE_PATH = RAG_ROOT / ".ragignore"

# Machinery that must never be treated as content, even though it sits in RAG/.
ALWAYS_IGNORE_NAMES = {
    ".env",
    ".ragignore",
    "index.csv",
    "CLAUDE.md",
    "rag-operator.md",
    "README.md",
    "schema.sql",
    "requirements.txt",
}
ALWAYS_IGNORE_DIRS = {"scripts", ".git", ".obsidian", "__pycache__", ".venv", "venv"}


# --- .env loading ------------------------------------------------------------

def load_env():
    """Load RAG/.env into os.environ. Uses python-dotenv if present, else a
    minimal parser so the scripts run even without the dependency.

    Empty values are dropped on purpose: a blank line like `OPENAI_BASE_URL=`
    must NOT enter the environment, or it leaks into SDKs (e.g. the OpenAI
    client reads OPENAI_BASE_URL from env and a "" becomes a broken base_url)."""
    if not ENV_PATH.exists():
        die(f".env not found at {ENV_PATH}. Run the deploy phase of the skill first.")
    try:
        from dotenv import dotenv_values  # type: ignore
        values = dotenv_values(ENV_PATH)
    except Exception:
        values = _parse_env_file()
    for key, val in values.items():
        # Skip empty/None so blank keys never shadow SDK defaults or real env.
        if key and val not in (None, "") and key not in os.environ:
            os.environ[key] = val


def _parse_env_file():
    """Minimal .env parser used when python-dotenv is unavailable."""
    values = {}
    for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        values[key.strip()] = val.strip().strip('"').strip("'")
    return values


def env(key, default=None, required=False):
    val = os.environ.get(key, default)
    if required and (val is None or val == ""):
        die(f"Missing required config `{key}` in {ENV_PATH}.")
    return val


# --- Config ------------------------------------------------------------------

class Config:
    def __init__(self):
        load_env()
        self.database_url = env("DATABASE_URL", required=True)
        self.table = env("RAG_TABLE", "documents")

        self.provider = env("EMBEDDING_PROVIDER", "openai").lower()
        self.model = env("EMBEDDING_MODEL", "text-embedding-3-small")
        self.dim = int(env("EMBEDDING_DIM", "1536"))
        self.api_key = env("OPENAI_API_KEY", "")
        self.base_url = env("OPENAI_BASE_URL", "") or None

        self.chunk_size = int(env("CHUNK_SIZE", "1000"))
        self.chunk_overlap = int(env("CHUNK_OVERLAP", "150"))
        self.batch_size = int(env("EMBED_BATCH_SIZE", "64"))

        exts = env("FILE_EXTENSIONS", ".md,.txt,.pdf,.docx")
        self.extensions = {
            e.strip().lower() if e.strip().startswith(".") else "." + e.strip().lower()
            for e in exts.split(",") if e.strip()
        }

        fields = env("METADATA_FIELDS", "file")
        self.metadata_fields = [f.strip() for f in fields.split(",") if f.strip()]


# --- Database ----------------------------------------------------------------

def connect(cfg):
    """Return a psycopg2 connection."""
    try:
        import psycopg2  # type: ignore
    except ImportError:
        die("psycopg2 not installed. Run: pip install -r scripts/requirements.txt")
    return psycopg2.connect(cfg.database_url)


def ensure_schema(conn, cfg):
    """Idempotent schema bootstrap. Safe to run every sync. Creates the pgvector
    extension, the documents table, indexes, and the match_documents function.
    This makes the operator self-healing even if the deploy phase was partial."""
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS {cfg.table} (
                id          bigserial PRIMARY KEY,
                content     text NOT NULL,
                embedding   vector({cfg.dim}),
                source_file text NOT NULL,
                chunk_index int NOT NULL DEFAULT 0,
                metadata    jsonb NOT NULL DEFAULT '{{}}',
                created_at  timestamptz NOT NULL DEFAULT now()
            );
        """)
        cur.execute(f"""
            CREATE INDEX IF NOT EXISTS {cfg.table}_embedding_idx
            ON {cfg.table} USING hnsw (embedding vector_cosine_ops);
        """)
        cur.execute(f"""
            CREATE INDEX IF NOT EXISTS {cfg.table}_source_file_idx
            ON {cfg.table} (source_file);
        """)
        cur.execute(f"""
            CREATE OR REPLACE FUNCTION match_documents(
                query_embedding vector({cfg.dim}),
                match_count int DEFAULT 5,
                filter jsonb DEFAULT '{{}}'
            ) RETURNS TABLE (
                id bigint, content text, source_file text,
                metadata jsonb, similarity float
            ) LANGUAGE sql STABLE AS $$
                SELECT id, content, source_file, metadata,
                       1 - (embedding <=> query_embedding) AS similarity
                FROM {cfg.table}
                WHERE metadata @> filter
                ORDER BY embedding <=> query_embedding
                LIMIT match_count;
            $$;
        """)
    conn.commit()


def delete_file_rows(conn, cfg, source_file):
    with conn.cursor() as cur:
        cur.execute(
            f"DELETE FROM {cfg.table} WHERE source_file = %s;", (source_file,)
        )
    conn.commit()


def insert_chunks(conn, cfg, source_file, chunks, embeddings, base_metadata):
    with conn.cursor() as cur:
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            meta = dict(base_metadata)
            meta["chunk_index"] = i
            cur.execute(
                f"""INSERT INTO {cfg.table}
                    (content, embedding, source_file, chunk_index, metadata)
                    VALUES (%s, %s::vector, %s, %s, %s::jsonb);""",
                (chunk, to_pgvector(emb), source_file, i, json.dumps(meta)),
            )
    conn.commit()


def to_pgvector(vec):
    return "[" + ",".join(f"{x:.8f}" for x in vec) + "]"


# --- Embeddings --------------------------------------------------------------

def get_embedder(cfg):
    """Return a function batch(list[str]) -> list[list[float]] using an
    OpenAI-compatible client. base_url lets this target Ollama, LM Studio,
    Azure, or any compatible proxy, so 'custom' providers work unchanged."""
    try:
        from openai import OpenAI  # type: ignore
    except ImportError:
        die("openai package not installed. Run: pip install -r scripts/requirements.txt")

    # Only pass base_url when set. An empty OPENAI_BASE_URL from .env otherwise
    # leaks through os.environ into the SDK and becomes a protocol-less URL.
    kwargs = {"api_key": cfg.api_key or "not-needed"}
    if cfg.base_url:
        kwargs["base_url"] = cfg.base_url
    else:
        os.environ.pop("OPENAI_BASE_URL", None)
    client = OpenAI(**kwargs)

    def embed(texts):
        out = []
        for i in range(0, len(texts), cfg.batch_size):
            batch = texts[i:i + cfg.batch_size]
            resp = client.embeddings.create(model=cfg.model, input=batch)
            out.extend([d.embedding for d in resp.data])
        return out

    return embed


# --- Chunking ----------------------------------------------------------------

def chunk_text(text, size, overlap):
    """Character-based chunking with overlap. Prefers to break on a paragraph or
    sentence boundary near the target size to keep chunks coherent."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]

    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        if end < n:
            window = text[start:end]
            # Prefer a clean break: paragraph, then sentence, then space.
            for sep in ("\n\n", "\n", ". ", " "):
                idx = window.rfind(sep)
                if idx > size * 0.5:
                    end = start + idx + len(sep)
                    break
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks


# --- Text extraction ---------------------------------------------------------

def extract_text(path: Path):
    """Return plain text for a file, dispatching on extension. Returns None if
    the format needs a missing dependency (logged by the caller)."""
    ext = path.suffix.lower()
    if ext == ".pdf":
        return _extract_pdf(path)
    if ext == ".docx":
        return _extract_docx(path)
    # Everything else (.md, .txt, code, .json, ...) is read as UTF-8 text.
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        warn(f"Could not read {path}: {e}")
        return None


def _extract_pdf(path):
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        warn(f"Skipping {path.name}: pypdf not installed (pip install pypdf).")
        return None
    try:
        reader = PdfReader(str(path))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as e:
        warn(f"Failed to extract PDF {path.name}: {e}")
        return None


def _extract_docx(path):
    try:
        import docx  # type: ignore
    except ImportError:
        warn(f"Skipping {path.name}: python-docx not installed (pip install python-docx).")
        return None
    try:
        d = docx.Document(str(path))
        return "\n".join(p.text for p in d.paragraphs)
    except Exception as e:
        warn(f"Failed to extract DOCX {path.name}: {e}")
        return None


# --- File discovery ----------------------------------------------------------

def load_ragignore():
    """Read optional .ragignore globs (one per line, # comments allowed)."""
    patterns = []
    if RAGIGNORE_PATH.exists():
        for raw in RAGIGNORE_PATH.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if line and not line.startswith("#"):
                patterns.append(line)
    return patterns


def discover_files(cfg):
    """Walk RAG_ROOT recursively, return content files as relative POSIX paths."""
    import fnmatch
    ignore_globs = load_ragignore()
    found = []
    for p in RAG_ROOT.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(RAG_ROOT)
        parts = set(rel.parts)
        if parts & ALWAYS_IGNORE_DIRS:
            continue
        if p.name in ALWAYS_IGNORE_NAMES or p.name.startswith("."):
            continue
        if p.suffix.lower() not in cfg.extensions:
            continue
        rel_str = rel.as_posix()
        if any(fnmatch.fnmatch(rel_str, g) for g in ignore_globs):
            continue
        found.append(rel_str)
    return sorted(found)


# --- Output helpers ----------------------------------------------------------

def warn(msg):
    print(f"  ! {msg}", file=sys.stderr)


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)
