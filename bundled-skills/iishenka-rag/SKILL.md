---
name: iishenka-rag
description: Deploy a Postgres/pgvector RAG pipeline inside the vault, then keep it in sync. Creates a RAG folder, runs a questionnaire (Postgres/Supabase connection into .env, embedding model + key, chunk size, metadata fields, file formats), checks and installs the pgvector extension, creates the vector table (content, embedding, metadata) with an HNSW index and a match_documents search function, and scaffolds standalone scripts (rag_sync.py, rag_query.py) plus a rag-operator runbook. The operator diffs the folder against index.csv (source of truth) by modified time and adds/updates/deletes vectors so the base stays fresh. Supports multiple pipelines. All user-facing questions are in Russian. Use when the user says "set up RAG", "deploy a RAG pipeline", "vector database", "semantic search over my files", "разверни RAG", "векторная база", "поиск по файлам", or runs /iishenka-rag.
---

# iishenka RAG — Deploy + Operate

USE WHEN the user runs `/iishenka-rag` or asks to deploy a RAG pipeline / vector database / semantic search over their files inside the vault.

> [!important] Язык общения
> Всё, что видит пользователь, должно быть **на русском** — опросник, подтверждения, сводки, гайд по использованию. Внутренние инструкции этого SKILL.md, имена файлов, ключи `.env`, frontmatter, плейсхолдеры `{{...}}` и содержимое шаблонов остаются как есть.

Like the other iishenka skills, this one **stands up a new sub-system, then explains how to run it.** Concept:

- A **RAG folder** is a self-contained pipeline: drop files in, they get chunked, embedded, and stored in Postgres/pgvector; search them semantically.
- **`index.csv` is the source of truth.** The operator diffs the folder against it by modified time and syncs only the delta (new / modified / deleted). No full re-index on every run.
- The **operator is a standalone Python script** the user runs themselves (`python scripts/rag_sync.py`). It reads all config from `.env`, so it works outside a Claude session and is fully reproducible.
- **Multiple pipelines supported.** The vault can hold several RAG folders on different topics, each with its own table.

Phases:
- **Phase 0** — Pre-flight: verify vault, immediately create the RAG folder, detect existing pipelines.
- **Phase 1** — Questionnaire: DB connection, embeddings, metadata, chunk size, formats, topic.
- **Phase 2** — Provision the database: pgvector + table + indexes + match function.
- **Phase 3** — Scaffold the RAG folder from references.
- **Phase 4** — Patch the root `CLAUDE.md` registry.
- **Phase 5** — Usage guide.

## Reference files

Every `references/<file>` lives next to **this SKILL.md**, not in the user's vault. Read paths resolve relative to this SKILL.md; write paths resolve relative to the user's cwd (the vault root). If a `references/...` path won't open directly, discover it once:

```bash
find / -type d -path '*iishenka-rag/references' 2>/dev/null | head -1
```

- `references/rag_common.py`, `references/rag_sync.py`, `references/rag_query.py`, `references/requirements.txt` — the pipeline scripts (copied verbatim, no placeholders).
- `references/schema.sql` — DDL template (`{{EMBED_DIM}}`, `{{RAG_TABLE}}`).
- `references/env-template.md` — `.env` template (many placeholders).
- `references/rag-operator.md` — the operator runbook (`{{...}}` placeholders).
- `references/rag-claude-md.md` — the RAG folder's own `CLAUDE.md`.
- `references/ragignore-template.md` — `.ragignore` scaffold (copied verbatim).
- `references/index-csv-format.md` — docs for index.csv (reference only, not deployed).
- `references/root-claude-md-snippet.md` — how to patch the root `CLAUDE.md`.

---

## Phase 0 — Pre-flight

1. **Verify the cwd is a vault.** `claude.md` or `CLAUDE.md` must exist at the cwd root. If not, ask the user to `cd` into their vault and re-run. Do not proceed.
2. **Detect existing RAG pipelines.** Scan top-level folders for a `CLAUDE.md` with `type: rag-config`:

   ```bash
   grep -rl 'type: rag-config' --include=CLAUDE.md . 2>/dev/null
   ```

3. **If at least one pipeline exists**, ask via `AskUserQuestion` (header `RAG`, на русском):
   - `Создать новый пайплайн` — новая тема, новая папка, новая таблица (реестр в root получает новую строку, старые не трогаются).
   - `Обновить существующий` — выбрать какой, поменять конфиг (`.env`, чанкинг, форматы). Без новой папки.
   - `Пересоздать существующий` — выбрать какой, перезаписать скрипты/шаблоны. **Не трогать файлы-контент и `index.csv` без подтверждения.**
   - `Отмена`.

   If more than one exists and the user picks update/recreate, fire a second `AskUserQuestion` listing them (`{folder} — {topic}`).

4. **If no pipeline exists**, proceed to create the first one.

### Create the RAG folder immediately

As soon as you know the folder name (Phase 1 sets `{{RAG_DIR}}`; default `RAG` for the first pipeline, `RAG-{topic-slug}` for additional ones), create it right away so the user sees the workspace exist:

```bash
mkdir -p {{RAG_DIR}}/scripts
```

(A new top-level folder is allowed — the "no files in vault root" rule forbids loose root files, not new folders.) Tell the user, на русском, that the RAG folder is created and now you'll configure it.

---

## Phase 1 — Questionnaire

Run as a wizard via `AskUserQuestion` (на русском). Capture each answer into the placeholder noted.

### Q1 — Тема пайплайна

`AskUserQuestion`, header `Тема`. Question: `Про что этот RAG? Короткое название темы (по ней назовём папку и таблицу).`
- Options illustrative (`База знаний`, `Документация`, `Заметки`); most users type their own via «Свой вариант».
- Save the text as `{{RAG_TOPIC}}`. Derive `{{RAG_TOPIC_SLUG}}` = kebab-case slug.
- **Folder** `{{RAG_DIR}}`: first/only pipeline → `RAG`; additional → `RAG-{{RAG_TOPIC_SLUG}}`. Ensure no collision with an existing RAG folder.
- **Table** `{{RAG_TABLE}}`: first/only → `documents`; additional → `documents_{{RAG_TOPIC_SLUG}}` (snake_case, valid SQL identifier).

### Q2 — Подключение к базе

The operator is a standalone script, so it **always** needs a direct connection string — even if the user also has the Supabase MCP connector. Ask (header `База`):

- Question: `Где твой Postgres? Мне нужна строка подключения — положу её в .env в папке RAG. Оператор (скрипт) подключается по ней напрямую.`
- Options:
  - `Supabase` — `Дам строку из Project Settings > Database. Возьми session/direct строку (не transaction pooler), иначе CREATE EXTENSION не пройдёт.`
  - `Свой Postgres` — `Локальный или облачный Postgres с pgvector. Дам postgresql://... строку.`
  - `Supabase-коннектор в Claude` — `Использовать MCP-коннектор Supabase для настройки базы. Строку подключения для скрипта всё равно попрошу отдельно.`

Then request the actual connection string from the user and save it as `{{DATABASE_URL}}`. **Never invent it.** If the user chose the MCP-connector option, note that Phase 2 provisioning can go through the connector, but the `.env` still needs the string for `rag_sync.py`/`rag_query.py` at runtime — ask for it.

If the Supabase MCP connector is connected in this session (tools like `list_extensions`, `apply_migration`, `execute_sql`), you may use it in Phase 2. Do not hardcode a connector name; detect what's available.

### Q3 — Эмбеддинги

`AskUserQuestion`, header `Эмбеддинги`. Question: `Чем векторизуем? По умолчанию OpenAI text-embedding-3-small — дёшево и хорошо. Ключ положим в .env.`
- Options:
  - `OpenAI small (по умолчанию)` — `text-embedding-3-small, 1536. Нужен OPENAI_API_KEY.`
  - `OpenAI large` — `text-embedding-3-large, 3072. Дороже, точнее.`
  - `Опишу свой процесс` — `Своя модель / провайдер / локальный Ollama. Расскажи, чем пользуешься — подберу модель, размерность и endpoint.`

Set placeholders:
- OpenAI small → `{{EMBEDDING_PROVIDER}}=openai`, `{{EMBEDDING_MODEL}}=text-embedding-3-small`, `{{EMBEDDING_DIM}}=1536`, `{{OPENAI_BASE_URL}}` empty.
- OpenAI large → same, model `text-embedding-3-large`, dim `3072`.
- «Опишу свой процесс» → have a short free-text exchange. Map their answer to `{{EMBEDDING_MODEL}}`, `{{EMBEDDING_DIM}}` (must match the model's true output size), and `{{OPENAI_BASE_URL}}` if they use an OpenAI-compatible endpoint (Ollama `http://localhost:11434/v1`, LM Studio, Azure, a proxy). The scripts speak the OpenAI embeddings API, so any compatible endpoint works via `base_url`. Set `{{EMBEDDING_PROVIDER}}` to a short label.

Then ask for the API key → `{{OPENAI_API_KEY}}` (skip / leave empty for keyless local endpoints). Getting the **dimension right** is critical: it defines the vector column and must equal the model's real output size.

### Q4 — Метаданные

`AskUserQuestion`, header `Метаданные`, **multiSelect: true**. Question: `Что класть в метаданные каждого чанка? (source_file и chunk_index пишутся всегда отдельными столбцами)`
- Options:
  - `Имя файла` — `file — имя файла. Рекомендуется, включено по умолчанию.`
  - `Относительный путь` — `path — путь внутри папки RAG.`
  - `Папка` — `folder — подпапка, где лежит файл.`
  - `Расширение` — `ext — тип файла.`
  - `Время изменения` — `modified — когда файл изменён.`

Map selections to the `METADATA_FIELDS` list (`file,path,folder,ext,modified`). Always include `file`. Save as `{{METADATA_FIELDS}}` (comma-separated).

### Q5 — Форматы файлов

`AskUserQuestion`, header `Форматы`, **multiSelect: true**. Question: `Какие форматы векторизуем из папки?`
- Options: `.md / .txt` (default, always), `PDF` (`.pdf`), `DOCX` (`.docx`), `Код` (`.py,.js,.ts,.tsx,.json,.yaml,.yml,.html,.css`).

Build `{{FILE_EXTENSIONS}}` (comma-separated, e.g. `.md,.txt,.pdf,.docx`). Note which optional deps are needed (`pypdf` for PDF, `python-docx` for DOCX) to mention in Phase 5.

### Q6 — Размер чанка

`AskUserQuestion`, header `Чанки`. Question: `Размер чанка векторизации? (в символах, с перекрытием)`
- Options:
  - `1000 / 150 (по умолчанию)` — `Баланс. Подходит для заметок и документации.`
  - `500 / 75` — `Мелкие чанки, точечный поиск, короткие фрагменты.`
  - `2000 / 200` — `Крупные чанки, больше контекста в одном фрагменте.`
  - `Свой вариант` — `Впиши размер и overlap.`

Save `{{CHUNK_SIZE}}` and `{{CHUNK_OVERLAP}}`.

Set `{{TODAY}}` = today's date (`YYYY-MM-DD`).

---

## Phase 2 — Provision the database

Goal: pgvector extension present, table + indexes + `match_documents` created. Two paths — use whichever fits what's connected.

**First, render the DDL:** read `references/schema.sql`, replace `{{EMBED_DIM}}` with `{{EMBEDDING_DIM}}` and `{{RAG_TABLE}}` with `{{RAG_TABLE}}`.

**Path A — Supabase MCP connector available** (and the user is fine with it):
1. Check the extension: `list_extensions` — look for `vector`.
2. If missing, enable it: `apply_migration` with `CREATE EXTENSION IF NOT EXISTS vector;` (or `execute_sql`).
3. Apply the rendered DDL via `apply_migration` (name it e.g. `rag_{{RAG_TOPIC_SLUG}}_schema`).
4. Verify with `list_tables` that `{{RAG_TABLE}}` exists.

**Path B — direct connection string** (no connector, or user prefers scripts):
- The safest universal move is to let the operator bootstrap it: `rag_sync.py`'s `ensure_schema()` runs the exact same idempotent DDL on first run. So you can either:
  - run the DDL now via `psql "{{DATABASE_URL}}" -f {{RAG_DIR}}/schema.sql` if `psql` is available, or
  - skip explicit provisioning and note that the first `python scripts/rag_sync.py` creates everything (extension included, provided the DB role may `CREATE EXTENSION`).
- If the role cannot create extensions, tell the user to enable `pgvector` once in their provider's dashboard, then the rest self-provisions.

Either way, `schema.sql` is also written into the RAG folder in Phase 3 for the record. Report to the user (на русском) what got provisioned and how.

---

## Phase 3 — Scaffold the RAG folder

Work mostly silently; summarize at the end. All write paths are under `{{RAG_DIR}}/`.

### 3.1 — Copy scripts verbatim (no placeholder substitution)

| Reference | Write to |
|---|---|
| `references/rag_common.py` | `{{RAG_DIR}}/scripts/rag_common.py` |
| `references/rag_sync.py` | `{{RAG_DIR}}/scripts/rag_sync.py` |
| `references/rag_query.py` | `{{RAG_DIR}}/scripts/rag_query.py` |
| `references/requirements.txt` | `{{RAG_DIR}}/scripts/requirements.txt` |
| `references/ragignore-template.md` | `{{RAG_DIR}}/.ragignore` |

These carry **no `{{...}}`** — copy exactly. (All runtime config lives in `.env`.)

### 3.2 — Render templated files (substitute every placeholder)

For each: read the reference, replace all `{{PLACEHOLDER}}`, write to the local path.

| Reference | Write to | Placeholders |
|---|---|---|
| `references/env-template.md` | `{{RAG_DIR}}/.env` | DB, embedding, table, chunk, formats, metadata |
| `references/schema.sql` (rendered in Phase 2) | `{{RAG_DIR}}/schema.sql` | `{{EMBED_DIM}}`, `{{RAG_TABLE}}` |
| `references/rag-operator.md` | `{{RAG_DIR}}/rag-operator.md` | `{{TODAY}}`, `{{RAG_TABLE}}`, `{{FILE_EXTENSIONS}}` |
| `references/rag-claude-md.md` | `{{RAG_DIR}}/CLAUDE.md` | `{{RAG_TABLE}}`, `{{EMBEDDING_MODEL}}`, `{{EMBEDDING_DIM}}`, `{{TODAY}}` |

`.env` placeholders: `{{DATABASE_URL}}`, `{{EMBEDDING_PROVIDER}}`, `{{EMBEDDING_MODEL}}`, `{{EMBEDDING_DIM}}`, `{{OPENAI_API_KEY}}`, `{{OPENAI_BASE_URL}}`, `{{RAG_TABLE}}`, `{{CHUNK_SIZE}}`, `{{CHUNK_OVERLAP}}`, `{{FILE_EXTENSIONS}}`, `{{METADATA_FIELDS}}`.

### 3.3 — Initialize index.csv (header only)

Write `{{RAG_DIR}}/index.csv` with exactly:

```csv
path,mtime,status,chunk_count
```

### 3.4 — Keep secrets out of git

Ensure `.env` is git-ignored. If the vault has a `.gitignore`, add `{{RAG_DIR}}/.env` (and optionally `{{RAG_DIR}}/scripts/__pycache__/`) if not already covered. If `.claudeignore` exists, consider adding `{{RAG_DIR}}/.env` there too so the key isn't read into context.

### 3.5 — Sanity pass

Scan every written file for leftover `{{` and fix before continuing.

---

## Phase 4 — Patch the root CLAUDE.md

Read `references/root-claude-md-snippet.md` and follow it. Add/refresh one row in the single `## RAG pipelines` registry table for `{{RAG_DIR}}/` + `{{RAG_TOPIC}}` + `{{RAG_TABLE}}`. Never overwrite another pipeline's row. Show the user the exact diff and confirm before saving. Surgical, idempotent, no em dashes.

---

## Phase 5 — Usage guide

Tell the user (на русском, кратко):

- **Установи зависимости один раз:** `pip install -r {{RAG_DIR}}/scripts/requirements.txt`. (Если выбрал PDF/DOCX — нужны `pypdf` / `python-docx`, они уже в requirements.)
- **Положи файлы** прямо в `{{RAG_DIR}}/` (можно в подпапки). Форматы: `{{FILE_EXTENSIONS}}`.
- **Прогони оператор:** из папки RAG — `python scripts/rag_sync.py` (или скажи «прогони rag-оператор»). Он досинхронизирует базу по `index.csv`. Проверить план без записи: `--dry-run`.
- **Ищи:** `python scripts/rag_query.py "твой вопрос"`, либо из приложения через RPC `match_documents`.
- **Меняй настройки** в `{{RAG_DIR}}/.env` (модель, чанкинг, форматы). Полный runbook — в `{{RAG_DIR}}/rag-operator.md`.

Suggest a concrete first step: «Закинь пару файлов в `{{RAG_DIR}}/`, поставь зависимости и прогони `python scripts/rag_sync.py` — я помогу, если что-то упадёт.»

---

## Guidelines

- **Deploy first, operate second.** Phase 0-4 stand the pipeline up; the operator (`rag_sync.py` + `rag-operator.md`) is what the user runs afterwards.
- **`.env` is the single config surface.** Scripts are copied verbatim and read everything from `.env`. Never bake config into the `.py` files.
- **Connection string always required** — the operator is standalone; the MCP connector only helps with one-time provisioning.
- **Dimension must match the model.** `EMBEDDING_DIM` defines the vector column; a mismatch breaks inserts. Verify it against the chosen model.
- **`index.csv` is the source of truth.** The operator maintains it; never hand-edit. Deploy it header-only.
- **Never commit `.env`.** It holds the DB password and API key.
- **Multiple pipelines are added, not substituted.** Re-running for a new topic creates a new folder + table + registry row; existing ones stay untouched.
- **One sanity pass for `{{` after render.** Catch unfilled placeholders before finishing.
- Templates are scaffolds: fill every placeholder, leave no `{{...}}` in written files. Scripts carry no placeholders — copy them exactly.
