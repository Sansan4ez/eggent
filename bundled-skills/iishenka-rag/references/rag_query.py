#!/usr/bin/env python3
"""
rag_query.py — semantic search over the vector database.

Embeds the query with the same model used for ingestion, then returns the most
similar chunks by cosine distance. This is the retrieval half of the pipeline;
wire it into any app, or run it from the terminal to sanity-check the base.

By default the terminal output shows a 300-char PREVIEW of each chunk for
readability. The full chunk is always stored in the DB and returned by the
query. Use --full to print whole chunks, or --json for machine consumption.

Usage:
    python rag_query.py "your question here"
    python rag_query.py "your question" -k 8
    python rag_query.py "your question" --filter '{"file": "notes.md"}'
    python rag_query.py "your question" --full     # whole chunks, no preview
    python rag_query.py "your question" --json      # JSON, full content
"""

import argparse
import json

import rag_common as rc


def search(cfg, conn, query, k, filter_json):
    embed = rc.get_embedder(cfg)
    q_emb = embed([query])[0]
    q_vec = rc.to_pgvector(q_emb)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT content, source_file, metadata,
                   1 - (embedding <=> %s::vector) AS similarity
            FROM {cfg.table}
            WHERE metadata @> %s::jsonb
            ORDER BY embedding <=> %s::vector
            LIMIT %s;
            """,
            (q_vec, json.dumps(filter_json), q_vec, k),
        )
        return cur.fetchall()


def main():
    ap = argparse.ArgumentParser(description="Semantic search over the RAG base.")
    ap.add_argument("query", help="the search query")
    ap.add_argument("-k", type=int, default=5, help="number of results (default 5)")
    ap.add_argument("--filter", default="{}",
                    help='metadata filter as JSON, e.g. \'{"file": "notes.md"}\'')
    ap.add_argument("--full", action="store_true",
                    help="print full chunk content instead of a preview")
    ap.add_argument("--json", action="store_true",
                    help="emit results as JSON (always full content)")
    args = ap.parse_args()

    cfg = rc.Config()
    conn = rc.connect(cfg)
    rows = search(cfg, conn, args.query, args.k, json.loads(args.filter))
    conn.close()

    if args.json:
        # Machine-readable: never truncate. This is the retrieval output apps consume.
        print(json.dumps([
            {"content": content, "source_file": source_file,
             "metadata": metadata, "similarity": similarity}
            for content, source_file, metadata, similarity in rows
        ], ensure_ascii=False, indent=2))
        return

    if not rows:
        print("No results. Is the base populated? Run: python rag_sync.py")
        return

    for i, (content, source_file, metadata, similarity) in enumerate(rows, 1):
        print(f"\n[{i}] {source_file}  (similarity {similarity:.3f})")
        if args.full:
            # Full chunk, exactly as stored in the DB.
            print(content.strip())
        else:
            # Terminal preview only. The DB row is complete; use --full or --json
            # to get the whole chunk. Truncation here is display, not data loss.
            snippet = content.strip().replace("\n", " ")
            if len(snippet) > 300:
                snippet = snippet[:300] + "…  (preview, use --full)"
            print(f"    {snippet}")


if __name__ == "__main__":
    main()
