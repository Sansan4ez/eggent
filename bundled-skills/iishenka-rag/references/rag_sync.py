#!/usr/bin/env python3
"""
rag_sync.py — keep the vector database in sync with the RAG folder.

index.csv is the source of truth. Each run:

  1. Ensure the schema exists (extension, table, indexes, match function).
  2. Load index.csv (create it empty if missing).
  3. Recursively scan the RAG folder for content files + their mtimes.
  4. Diff disk against index.csv:
       - on disk, not in index      -> NEW      -> embed + insert
       - mtime on disk > index mtime -> MODIFIED -> delete old rows, re-embed
       - in index, missing on disk   -> DELETED  -> delete rows
       - mtime unchanged             -> skip
  5. Rewrite index.csv (path, mtime, status, chunk_count).

Usage:
    python rag_sync.py            # apply changes
    python rag_sync.py --dry-run  # report the plan, touch nothing
"""

import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

import rag_common as rc


INDEX_FIELDS = ["path", "mtime", "status", "chunk_count"]


def mtime_iso(path: Path) -> str:
    ts = path.stat().st_mtime
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def load_index():
    """Return {path: {mtime, status, chunk_count}} from index.csv."""
    index = {}
    if not rc.INDEX_PATH.exists():
        return index
    with rc.INDEX_PATH.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            index[row["path"]] = {
                "mtime": row.get("mtime", ""),
                "status": row.get("status", ""),
                "chunk_count": row.get("chunk_count", "0"),
            }
    return index


def write_index(index):
    with rc.INDEX_PATH.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=INDEX_FIELDS)
        w.writeheader()
        for path in sorted(index):
            r = index[path]
            w.writerow({
                "path": path,
                "mtime": r["mtime"],
                "status": r["status"],
                "chunk_count": r["chunk_count"],
            })


def build_metadata(cfg, rel_path, path: Path):
    """Build the metadata jsonb payload from the configured fields."""
    meta = {}
    for field in cfg.metadata_fields:
        if field == "file":
            meta["file"] = path.name
        elif field == "path":
            meta["path"] = rel_path
        elif field == "folder":
            parent = str(Path(rel_path).parent)
            meta["folder"] = "" if parent == "." else parent
        elif field == "ext":
            meta["ext"] = path.suffix.lower()
        elif field == "modified":
            meta["modified"] = mtime_iso(path)
        # Unknown fields are ignored; extend here for custom metadata.
    return meta


def vectorize_file(conn, cfg, embed, rel_path):
    """Chunk, embed, and insert one file. Returns chunk count."""
    abs_path = rc.RAG_ROOT / rel_path
    text = rc.extract_text(abs_path)
    if text is None:
        return None  # extraction failed / dependency missing
    chunks = rc.chunk_text(text, cfg.chunk_size, cfg.chunk_overlap)
    if not chunks:
        print(f"  - {rel_path}: empty, no chunks")
        return 0
    embeddings = embed(chunks)
    base_meta = build_metadata(cfg, rel_path, abs_path)
    rc.insert_chunks(conn, cfg, rel_path, chunks, embeddings, base_meta)
    return len(chunks)


def main():
    dry_run = "--dry-run" in sys.argv[1:]
    cfg = rc.Config()

    print(f"RAG sync {'(dry run) ' if dry_run else ''}| table={cfg.table} "
          f"model={cfg.model} dim={cfg.dim}")
    print(f"Folder: {rc.RAG_ROOT}")

    conn = None
    embed = None
    if not dry_run:
        conn = rc.connect(cfg)
        rc.ensure_schema(conn, cfg)
        embed = rc.get_embedder(cfg)

    index = load_index()
    disk_files = rc.discover_files(cfg)
    disk_set = set(disk_files)

    plan_new, plan_modified, plan_deleted = [], [], []

    for rel in disk_files:
        abs_path = rc.RAG_ROOT / rel
        disk_mtime = mtime_iso(abs_path)
        if rel not in index:
            plan_new.append((rel, disk_mtime))
        elif disk_mtime > index[rel]["mtime"]:
            plan_modified.append((rel, disk_mtime))

    for rel in index:
        if rel not in disk_set:
            plan_deleted.append(rel)

    print(f"\nPlan: {len(plan_new)} new, {len(plan_modified)} modified, "
          f"{len(plan_deleted)} deleted, "
          f"{len(disk_files) - len(plan_new) - len(plan_modified)} unchanged")

    if dry_run:
        for rel, _ in plan_new:
            print(f"  NEW      {rel}")
        for rel, _ in plan_modified:
            print(f"  MODIFIED {rel}")
        for rel in plan_deleted:
            print(f"  DELETED  {rel}")
        print("\nDry run: nothing written.")
        return

    # --- Apply deletions ---
    for rel in plan_deleted:
        rc.delete_file_rows(conn, cfg, rel)
        index.pop(rel, None)
        print(f"  DELETED  {rel}")

    # --- Apply modifications (delete old rows, then re-vectorize) ---
    for rel, disk_mtime in plan_modified:
        rc.delete_file_rows(conn, cfg, rel)
        count = vectorize_file(conn, cfg, embed, rel)
        if count is None:
            print(f"  SKIP     {rel} (extraction failed)")
            continue
        index[rel] = {"mtime": disk_mtime, "status": "vectorized",
                      "chunk_count": str(count)}
        print(f"  MODIFIED {rel} ({count} chunks)")

    # --- Apply new files ---
    for rel, disk_mtime in plan_new:
        count = vectorize_file(conn, cfg, embed, rel)
        if count is None:
            print(f"  SKIP     {rel} (extraction failed)")
            continue
        index[rel] = {"mtime": disk_mtime, "status": "vectorized",
                      "chunk_count": str(count)}
        print(f"  NEW      {rel} ({count} chunks)")

    write_index(index)
    conn.close()

    total_chunks = sum(int(r["chunk_count"]) for r in index.values())
    print(f"\nDone. {len(index)} files tracked, {total_chunks} chunks in `{cfg.table}`.")


if __name__ == "__main__":
    main()
