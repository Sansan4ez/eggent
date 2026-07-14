---
type: wiki-log
topic: "{{WIKI_TOPIC}}"
status: active
tags: [wiki, log]
updated: {{TODAY}}
---

# Wiki Log

Append-only record of every ingest and edit. Newest at the bottom. Never rewrite past entries.

Format per entry:

```
## YYYY-MM-DD — {short title}
- Source: {filename or "n/a"}
- Pages: [[page-a]], [[page-b]]
- Change: one line on what happened
```

---

## {{TODAY}} — Wiki created
- Source: n/a
- Pages: index.md, scheme.md
- Change: Wiki initialized for topic "{{WIKI_TOPIC}}" via iishenka-wiki-llm.
