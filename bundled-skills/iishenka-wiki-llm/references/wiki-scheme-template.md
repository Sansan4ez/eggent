---
type: wiki-scheme
topic: "{{WIKI_TOPIC}}"
status: active
tags: [wiki, scheme]
updated: {{TODAY}}
---

# Wiki Scheme

The data schema for this wiki. Every page Claude writes follows this. `CLAUDE.md` says *what to do*; this file says *what a page looks like*.

## Page types

| Type | What it holds | Filename pattern |
|---|---|---|
| `concept` | One idea, term, or model | `{concept-slug}.md` |
| `entity` | One person, org, product, place | `{entity-slug}.md` |
| `summary` | A digest of one source in `raw/` | `source-{source-slug}.md` |
| `answer` | A filed-back answer to a complex question | `q-{question-slug}.md` |

One concept per page. If a page covers two things, split it.

## Page format

Every page:

```markdown
---
type: concept | entity | summary | answer
sources: [filename-1.pdf, filename-2.md]
status: draft | verified
tags: [{{WIKI_TOPIC_TAG}}]
updated: YYYY-MM-DD
---

# Page Title

**Summary**: One or two sentences describing this page.

---

Main content. Clear headings, short paragraphs. Weave [[wikilinks]] to related
pages directly into sentences, never as a bare bullet list.

## Related pages

- [[related-page-1]]
- [[related-page-2]]
```

## Naming

- Lowercase, hyphenated: `gradient-descent.md`, not `Gradient Descent.md`.
- Source summaries are prefixed `source-`: `source-q3-research.md`.
- Filed answers are prefixed `q-`: `q-why-latency-spikes.md`.

## Linking

- Connect every new page to at least one existing page with a `[[wikilink]]`.
- A page with zero inbound links is an orphan: lint flags it.
- Link the first mention of a concept in a page, not every mention.

## Citation

- Factual claim: append `(source: filename.pdf)`.
- Unsourced claim: wrap in `> [!warning] Needs verification`.
- Conflicting sources: state both and the disagreement.

## Frontmatter rules

- `sources` lists the `raw/` files the page draws from. Empty only for pure `answer` pages.
- `status: draft` until every claim is sourced, then `verified`.
- `updated` is the date of the most recent edit.
