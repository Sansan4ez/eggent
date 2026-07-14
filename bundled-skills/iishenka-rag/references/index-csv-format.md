# index.csv — source of truth for what is vectorized.

The operator (`rag_sync.py`) creates and maintains this file. Do not edit it by
hand. On deploy it starts as a header-only file:

```csv
path,mtime,status,chunk_count
```

## Columns

| Column | Meaning |
|---|---|
| `path` | File path relative to the RAG folder, POSIX style (`notes/plan.md`). |
| `mtime` | Last modified time on disk, ISO-8601 UTC, at the moment it was vectorized. |
| `status` | `vectorized` once synced. Transient states (new/modified/deleted) are computed each run by diffing disk against this file, not stored. |
| `chunk_count` | How many chunks/rows this file produced in the vector table. |

## How the diff works

Each run compares the folder on disk to the rows here:

- path on disk, absent here → **new** → embed + insert, add row.
- disk `mtime` newer than the row's `mtime` → **modified** → delete old rows, re-embed, update row.
- row here, path missing on disk → **deleted** → delete rows, drop row.
- `mtime` unchanged → skip.
