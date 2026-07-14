# Root CLAUDE.md patch (multi-wiki registry)

The skill makes the vault's root `CLAUDE.md` aware of **every** wiki, so the assistant knows
which topic routes to which folder. The design is a single **registry table** that holds one
row per wiki. Adding a wiki = adding a row. Nothing else is clobbered.

## The registry section

Maintain exactly one section named `## Wikis (LLM knowledge bases)` in the root `CLAUDE.md`.
It contains one shared rule plus a table with one row per wiki:

```markdown
## Wikis (LLM knowledge bases)

These folders are LLM-maintained, single-topic knowledge bases. Each is a deep store for
hard questions on its topic, not general memory.

| Topic | Folder | Consult when |
|---|---|---|
| {{WIKI_TOPIC}} | `{{WIKI_DIR}}/` | question is complex AND about {{WIKI_TOPIC}} |

**Rule:** open a wiki **only when both hold** — the question is complex (needs synthesis
across facts or sources) AND on that wiki's topic. Match the topic to the right folder in
the table above, read its `index.md` first, then the relevant pages, then answer with
citations. For simple questions, or anything off every listed topic, do not open any wiki.
Each folder's own `CLAUDE.md` explains how to maintain it.
```

## How the skill edits it (idempotent, additive)

1. **Read the root `CLAUDE.md`.**
2. **If no `## Wikis (LLM knowledge bases)` section exists:** create it (the block above) with
   a single row for the wiki being set up.
3. **If the section already exists:** insert a new row into its table.
   - If a row for this exact `{{WIKI_DIR}}/` already exists, **update that row in place**
     (refresh the topic / consult-when text). Never duplicate a row.
   - Otherwise **append a new row**, leaving all existing rows untouched. This is the
     multi-wiki case: old wikis stay, the new one is added.
4. **Routing table (optional):** if the vault has a separate top-level routing/knowledge
   table, also add/refresh one row there pointing complex `{{WIKI_TOPIC}}` questions to
   `{{WIKI_DIR}}/`. Same idempotency rule.

## Hard rules for the patch

- **Never overwrite another wiki's row.** Re-running for a new topic must only add a row.
- **One section only.** Do not create a second `## Wikis` section. There is exactly one
  registry table; every wiki is a row in it.
- **Surgical.** Touch only the registry section (and the optional routing row). Preserve all
  other content of the root `CLAUDE.md` byte-for-byte.
- **Voice.** No em dashes; match the vault's heading style.
- Show the user the exact diff (added/updated row + any new section) before saving.
