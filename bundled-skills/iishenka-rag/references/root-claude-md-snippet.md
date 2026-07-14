# Patching the root CLAUDE.md — RAG registry

This skill adds one small section to the vault's root `CLAUDE.md` so the
assistant knows a RAG pipeline exists and where. Surgical and idempotent:
touch only this section, preserve everything else, no em dashes.

The root holds **one** `## RAG pipelines` section with a registry table, one row
per RAG folder (the vault may hold several pipelines on different topics).

## If the section does not exist yet

Add it (place it after the existing routing/knowledge sections, before Anti-Patterns):

```markdown
## RAG pipelines

Semantic-search bases backed by Postgres/pgvector. Each folder has its own
`CLAUDE.md` (schema + rules) and `rag-operator.md` (how to sync). To update a
base, run its operator; to search, use its `rag_query.py` or the
`match_documents` RPC.

| Folder | Topic | Table |
|---|---|---|
| `{{RAG_DIR}}/` | {{RAG_TOPIC}} | `{{RAG_TABLE}}` |
```

## If the section already exists

Add a new row for `{{RAG_DIR}}/`. If a row for this exact folder already exists,
update it in place. Never remove or overwrite another pipeline's row.

Show the user the exact diff (the added/updated row, plus the new section if it
is the first time) and confirm before saving.
