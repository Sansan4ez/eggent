---
type: rag-config
status: active
tags: [rag, pipeline, vector-db]
table: "{{RAG_TABLE}}"
embedding_model: "{{EMBEDDING_MODEL}}"
embedding_dim: {{EMBEDDING_DIM}}
updated: {{TODAY}}
---

## Назначение

Эта папка — RAG-пайплайн: содержимое файлов здесь векторизуется и складывается в Postgres/pgvector, а потом по нему можно искать семантически.

Человек кладёт файлы, оператор поддерживает базу в актуальном состоянии. `index.csv` — источник истины о том, что уже проиндексировано.

## Структура папки

```
RAG/
  CLAUDE.md          -- этот файл: как устроен пайплайн
  rag-operator.md    -- runbook: как запускать синхронизацию (запускает человек)
  .env               -- конфигурация (строка БД, ключ, модель, чанкинг) — не коммитить
  .ragignore         -- glob-шаблоны файлов, которые не индексировать
  index.csv          -- источник истины: path, mtime, status, chunk_count
  schema.sql         -- DDL базы (для справки и ручного применения)
  scripts/
    rag_common.py    -- общий модуль (конфиг, БД, эмбеддинги, чанкинг, извлечение текста)
    rag_sync.py      -- синхронизация папки с векторной БД
    rag_query.py     -- семантический поиск по базе
    requirements.txt -- зависимости Python
  <твои файлы>        -- контент для векторизации (рекурсивно, любые подпапки)
```

## Схема БД

Таблица `{{RAG_TABLE}}`: `id`, `content`, `embedding vector({{EMBEDDING_DIM}})`, `source_file`, `chunk_index`, `metadata jsonb`, `created_at`. HNSW-индекс по cosine. Функция `match_documents(query_embedding, match_count, filter)` для поиска через RPC.

## Как обновлять базу

Смотри `rag-operator.md`. Коротко: положил/поменял/удалил файлы → `python scripts/rag_sync.py`. Диф считается по `index.csv` (mtime), синхронизируется только разница.

## Как искать

`python scripts/rag_query.py "вопрос"` локально, либо RPC `match_documents` из приложения.

## Правила

- **`index.csv` ведёт оператор.** Руками не редактировать.
- **`.env` не коммитить.** В нём пароль от БД и API-ключ.
- Модель эмбеддингов и `EMBEDDING_DIM` меняются только вместе. Смена размерности на наполненной базе требует переиндексации.
- Файлы кладутся прямо в папку (рекурсия по подпапкам). Исключения — через `.ragignore`.
- Никогда не удаляй строки из БД руками в обход оператора: рассинхронишь `index.csv` и базу.
