---
type: wiki-config
topic: "{{WIKI_TOPIC}}"
status: active
tags: [wiki, llm, knowledge-base]
updated: {{TODAY}}
---

## Purpose

This folder is an LLM-maintained wiki: a structured, interlinked knowledge base on a single topic.

**Topic:** {{WIKI_TOPIC}}
**Scope:** {{WIKI_SCOPE}}

Claude maintains the wiki. The human curates sources, asks questions, and guides the analysis. The wiki compounds over time: good answers get filed back as pages, so the base keeps getting richer on this one topic.

## When to consult this wiki

Read this wiki **only when both hold**:

1. The user's question is **complex** (needs synthesis across multiple facts, sources, or concepts. Not a quick lookup).
2. The question is **on this wiki's topic** ({{WIKI_TOPIC}}).

For simple questions, or questions outside this topic, do not load the wiki. It is a deep store for hard, on-topic questions, not a general-purpose memory. (The root `CLAUDE.md` routing entry enforces the same gate.)

## Folder structure

```
{{WIKI_DIR}}/
  CLAUDE.md      -- this file: how to work with the wiki (behavior + workflow)
  scheme.md      -- the data schema: page types, naming, link + citation conventions
  index.md       -- table of contents for every wiki page, with one-line descriptions
  log.md         -- append-only record of every ingest and edit
  raw/           -- source documents (immutable: never modify or delete these)
  {page}.md      -- wiki pages maintained by Claude (concepts, entities, summaries)
```

All paths in this file are relative to this folder (`{{WIKI_DIR}}/`). This vault may hold
several wikis on different topics; each lives in its own folder with its own `CLAUDE.md`.
The root `CLAUDE.md` registry says which topic routes to which folder.

`scheme.md` is the source of truth for *how a page is shaped*. This file is the source of truth for *what to do*. Read `scheme.md` before creating or editing any page.

## Ingest workflow

When the user drops a new source into `raw/` and asks you to ingest it:

1. Read the full source document.
2. Discuss key takeaways with the user before writing anything.
3. Create a summary page named after the source (see naming in `scheme.md`).
4. Create or update a concept page for each major idea or entity.
5. Add wikilinks (`[[page-name]]`) to connect related pages, woven into sentences.
6. Update `index.md` with new pages and a one-line description each.
7. Append an entry to `log.md`: date, source name, pages touched, what changed.

A single source may touch 10 to 15 wiki pages. That is normal.

## Question answering

When the user asks an on-topic, complex question:

1. Read `index.md` first to find relevant pages.
2. Read those pages and synthesize an answer.
3. Cite the specific wiki pages you used.
4. If the answer is not in the wiki, say so plainly. Do not invent.
5. If the answer is valuable, offer to file it back as a new or updated page.

Good answers get filed back into the wiki so they compound over time.

## Citation rules

- Every factual claim references its source file: `(source: filename.pdf)` right after the claim.
- If two sources disagree, note the contradiction explicitly rather than picking one silently.
- If a claim has no source, mark it `> [!warning] Needs verification`.
- Page-to-page references use wikilinks, not prose page names.

## Lint

When the user asks you to lint or audit the wiki:

- Contradictions between pages.
- Orphan pages (no inbound wikilinks from any other page).
- Concepts mentioned across pages that lack their own page.
- Claims that may be stale given newer sources in `raw/`.
- Pages that do not follow `scheme.md`.
- Stale `index.md` (pages on disk missing from the index, or index entries with no page).

Report findings as a numbered list, each with a concrete suggested fix.

## Rules

- **Never modify or delete anything in `raw/`.** Sources are immutable.
- Always update `index.md` and `log.md` after any change.
- Page filenames: lowercase, hyphenated (`machine-learning.md`).
- Write in clear, plain language. Short paragraphs. No em dashes.
- One concept per page. Split a page that drifts into two topics.
- When unsure how to categorize something, ask the user rather than guessing.
- Stay on topic: this wiki is only about {{WIKI_TOPIC}}. Off-topic material belongs elsewhere in the vault.
