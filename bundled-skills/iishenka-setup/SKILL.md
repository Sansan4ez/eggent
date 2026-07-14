---
name: iishenka-setup
description: Bootstrap the iishenka Pro OS Plugin vault structure and run personalized onboarding. Creates all directories, system files, Obsidian config, memory system, hooks, and output styles, then interviews the user to personalize everything. One universal structure — no mode selection. All user-facing questions and forms are in Russian. Use when user says "set up", "bootstrap", "initialize", "onboarding", "настрой", "настройка", "онбординг", "инициализация", or runs /iishenka-setup.
---

# iishenka Pro Obsidian Plugin — Setup + Onboarding

USE WHEN the user runs `/iishenka-setup` or asks to set up their vault, bootstrap the assistant, initialize the system, or configure the iishenka Pro Obsidian Plugin.

> [!important] Язык общения
> Этот скилл работает в России и **всё, что видит пользователь, должно быть на русском** — ориентирующее сообщение, заголовки и буллеты-подсказки в формах Phase B, финальный вопрос Phase B+, любые подтверждения и сводки. Внутренние инструкции этого SKILL.md и технические значения (имена файлов, frontmatter-ключи, `os-mode`, slug'и) остаются как есть. Если ниже приведён английский текст вопроса без русского варианта — переводи его на естественный русский при показе пользователю, сохраняя смысл.

> [!note] Один универсальный режим
> Этот скилл строит **одну усреднённую универсальную структуру** — никакого выбора «индивидуал / компания». База — лёгкая соло-структура (`Context`, `Projects`, `Daily`, `Resources`, `Skills`, `Intelligence`), которая одинаково подходит и одиночке, и малой команде. Никаких `Departments/`, `Team/{org}/Profiles/`, отдельных бизнес-шаблонов. `os-mode` всегда `professional`.

This is a two-phase process:
- **Phase A**: Bootstrap — Create the universal directory structure and system files
- **Phase B**: Onboarding — Interview the user and personalize everything

## Pre-flight Check

Check if `claude.md` or `CLAUDE.md` exists **only** in the current working directory (do NOT search subdirectories or parent directories — check only the exact CWD path).

- **If it exists**: The vault is already set up. Ask the user (по-русски):
  - Вопрос: `Этот vault уже настроен. Что сделать?`
  - **`Перезапустить интервью`** — `Оставить структуру, обновить файлы по новым ответам`
  - **`Полный сброс`** — `Удалить всё и начать с нуля (подтвердить дважды перед удалением)`
  - **`Отмена`** — `Ничего не делать`
- **If it does NOT exist**: Proceed with full setup (Phase A + Phase B)

> [!note] Без выбора режима
> Раньше здесь был Phase 0 (выбор «индивидуал / компания»). Его больше нет — структура всегда одна, универсальная (`os-mode: professional`). Сразу переходи к Phase A. Ничего не спрашивай про режим.

---

## Phase A: Bootstrap

Create the universal directory structure and write all system files. There is one structure — always `os-mode: professional`.

### Resolving reference file paths

Every `references/<file>.md` mentioned below lives in the `references/` subdirectory next to **this SKILL.md** — not in the user's working directory. Two conventions matter:

- **Read paths** (`references/foo.md`) → resolve relative to this SKILL.md's directory.
- **Write paths** (`./Foo/CLAUDE.md`) → resolve relative to the user's current working directory (the vault root).

If the Read tool can't open a `references/...` path directly (some harnesses mount the skill at a path that differs between Read and Bash), run a quick discovery step **once** before Step A.2:

```bash
# Find the references directory; cache the result for the rest of Phase A.
find / -type d -path '*iishenka-setup/references' 2>/dev/null | head -1
```

Use that absolute path as the prefix for every reference read in Phase A and Phase B. Don't retry path resolution per-file — do it once and reuse.

### Step A.1: Create Directory Structure

One universal structure for everyone:

```bash
mkdir -p .claude
mkdir -p Context
mkdir -p Projects
mkdir -p Daily
mkdir -p Resources
mkdir -p Skills
mkdir -p Intelligence/meetings/team-standups
mkdir -p Intelligence/meetings/client-calls
mkdir -p Intelligence/meetings/one-on-ones
mkdir -p Intelligence/meetings/general
mkdir -p Intelligence/competitors
mkdir -p Intelligence/market
mkdir -p Intelligence/decisions
mkdir -p Intelligence/archive
```

No `Departments/`, no `Team/`, no `Onboarding/` — those were business-mode only and are gone.

### Step A.2: Write System Files from References

Read each reference file and write it to the corresponding local path. The reference files contain the complete content for each system file.

**Shared system files:**

| Reference File | Creates at Local Path |
|---|---|
| `references/settings-json-template.md` | `./.claude/settings.json` |
| `references/claudeignore-template.md` | `./.claudeignore` |
| `references/gitignore-template.md` | `./.gitignore` |

**Root CLAUDE.md template:**

| Reference File | Creates at Local Path |
|---|---|
| `references/claude-md-template.md` | `./CLAUDE.md` |

**Per-folder routing indexes** (every major folder gets its own `CLAUDE.md` — matches production vault convention):

| Reference File | Creates at Local Path |
|---|---|
| `references/claude-md-context.md` | `./Context/CLAUDE.md` |
| `references/claude-md-projects.md` | `./Projects/CLAUDE.md` |
| `references/claude-md-daily.md` | `./Daily/CLAUDE.md` |
| `references/claude-md-intelligence.md` | `./Intelligence/CLAUDE.md` |
| `references/claude-md-resources.md` | `./Resources/CLAUDE.md` |
| `references/claude-md-skills.md` | `./Skills/CLAUDE.md` |

For each row: read the reference file, then write its content to the local path.

### Step A.3: Initialize Starter Context Files

**Do NOT create any placeholder skills.** The `Skills/` folder is created empty (with only its `CLAUDE.md` routing index from Step A.2). The user adds their own skills later. No `linkedin-writer`, no `newsletter-writer`, no example scaffolds.

Starter context file:
- Read `references/context-me.md` → write to `./Context/me.md`

That's the only starter context file. Everything else in `Context/` is created later in Phase B Build, only when the onboarding answers actually contain data for it.

### Step A.4: Make Hooks Executable

```bash
chmod +x .claude/hooks/*.sh
```

### Step A.5: Confirm Bootstrap

Tell the user (на русском):
- "Структура vault успешно создана."
- List the main folders created (`Context`, `Projects`, `Daily`, `Resources`, `Skills`, `Intelligence`)
- Recommend opening this folder as a vault in Obsidian
- Recommend installing **TaskNotes** community plugin if they want task management features
- Note that **Bases** (native database views) are built into Obsidian — no plugin needed for queries
- Mention `Resources/` for storing prompts, frameworks, swipe files, and templates
- "Now let's personalize it for you."

Then proceed to Phase B.

---

## Phase B: Onboarding — Guided Brain Dump

This skill runs **inside Cowork**. Phase B uses Cowork's rich-HTML widget tool — **not** AskUserQuestion — to render a real form with stacked categories, free-text textareas, and proper styling (matches the look of `os-optimizer`'s "Audit run details" form).

It's a guided brain dump across **12 categories** of the user's life and business, batched into **3 rich-HTML forms** (4 categories per form). Bullet points inside each category are **inspiration prompts** — riff on whatever lands.

The pitch to the user: *sit down for an hour or two, pour a beer, order a pizza, and brain-dump. It's not only for the assistant to feel personal on day one — it's a useful exercise in itself.*

### The tool: `mcp__visualize__show_widget` (Cowork-only)

Each of the 3 forms is **one** call to `mcp__visualize__show_widget`. The tool accepts:

| Field | Purpose |
|---|---|
| `title` | Internal widget identifier (e.g. `os_setup_form_1_you_business`) |
| `loading_messages` | Array of short strings shown while the form renders |
| `widget_code` | Raw HTML for the form (uses Cowork's `elicit-*` class conventions) |

The user fills in the form and submits. The submitted values come back to the agent as the tool result. The agent then proceeds to the next form. No AskUserQuestion. No radio buttons. No "Other" box.

### How the user should respond — per category

Inside each category's textarea, the user can:

1. **Paste a Whisper / dictation transcript** — open phone or Mac dictation, ramble for 2–5 minutes, paste the transcript.
2. **Paste documents** — links to PDFs, Notion pages, Google Docs, brand guides, About pages, LinkedIn profiles, OKR docs, decks. Or drop file paths.
3. **Point at connectors** — paste a Notion workspace URL, a wiki link, a Drive folder.
4. **Type long-form free text.**

Two kinds of knowledge: **what lives in your head** (Whisper it) and **what already lives online or in a tool** (paste links / docs). Mix freely per category. Leave a textarea blank to skip that category.

### Before Form 1 — Send one orienting message

Send this verbatim (or close to it), no tool call yet — **на русском**:

> Три коротких формы, по четыре категории в каждой, двенадцать категорий всего. Это не анкета — это управляемый брейн-дамп.
>
> В каждой категории три способа дать мне контекст: **поле для брейн-дампа**, **поле для ссылок и путей к файлам** и **загрузка файлов**. Используй любое или все сразу. Вываливай всё, что приходит в голову вокруг буллетов-подсказок — не обязательно отвечать на каждый. Оставь категорию пустой, чтобы пропустить её.
>
> Лучшие входные данные: транскрипт надиктовки (Whisper / голосовой ввод), ссылка на About-страницу, PDF брендбука, документ с целями (OKR), профиль в LinkedIn, страница в Notion. Чем больше дашь — тем менее шаблонным будет твой vault в первый же день.
>
> Сядь на час-другой. Налей пива. Закажи пиццу. Оно того стоит.
>
> Отправляй каждую форму, когда готов. Напиши «пропустить всё» в любой момент, чтобы перейти к дефолтам.

### Widget HTML template (every category in every form uses this shape)

Each category gets **three inputs**: a brain-dump textarea, a links/paths textarea, and a file upload input. Any or all can be filled. All blank = skip.

Inside `widget_code` for each form, build a `<form class="elicit">` containing one header and four `elicit-group` blocks. Per category:

```html
<div class="elicit-group">
  <label class="elicit-question">{N}/12 — {Category name}</label>
  <div class="elicit-bullets" style="font-size:13px; color:var(--color-text-secondary); margin:8px 0">
    <ul style="margin:0; padding-left:18px">
      <li>{inspiration bullet 1}</li>
      <li>{inspiration bullet 2}</li>
      <li>{inspiration bullet 3}</li>
      <!-- etc -->
    </ul>
    <p style="margin-top:6px; font-style:italic">Вываливай мысли в поле ниже, ИЛИ вставь ссылки / пути к файлам, ИЛИ загрузи документы. Любая комбинация. Оставь всё пустым, чтобы пропустить категорию.</p>
  </div>

  <textarea class="elicit-textarea" name="cat{N}_braindump" rows="6"
    style="width:100%; border-radius:10px; padding:10px; border:1px solid var(--color-border-subtle); font-family:inherit; font-size:13px; margin-bottom:8px"
    placeholder="Брейн-дамп — вставь транскрипт надиктовки или напиши свободным текстом…"></textarea>

  <textarea class="elicit-textarea" name="cat{N}_links" rows="2"
    style="width:100%; border-radius:10px; padding:10px; border:1px solid var(--color-border-subtle); font-family:inherit; font-size:13px; margin-bottom:8px"
    placeholder="Ссылки и пути к файлам — по одному на строку (Notion URL, профиль LinkedIn, /path/to/file.pdf, и т.д.)"></textarea>

  <input class="elicit-file" type="file" name="cat{N}_files" multiple
    accept=".md,.txt,.pdf,.docx,.pptx,.xlsx,.csv,.json,.yaml,.yml,.png,.jpg,.jpeg"
    style="font-size:12px; color:var(--color-text-secondary)">
</div>
```

And one header at the top of `<form class="elicit">`:

```html
<div class="elicit-header">
  <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><!-- pencil/clipboard icon --></svg>
  <span>{Form title}</span>
</div>
<div class="elicit-body">
  <!-- 4 elicit-group blocks -->
</div>
```

Reuse the SVG icon pattern from the optimizer's `Audit run details` widget (clipboard-with-marks icon). Form titles (Russian): «Ты и бизнес», «Клиент и бренд», «Как ты работаешь» (solo) — или «Ты и компания», «Оффер, клиент и бренд», «Как работает компания» (business). The `{N}/12 — {Category name}` label and every bullet must be shown in Russian using the translated category names and bullets defined below.

### Reading form submissions

When the widget returns, the result is a record mapping each input's `name` to its value:

- `cat{N}_braindump` → string (the typed text / transcript)
- `cat{N}_links` → string (newline-separated URLs and file paths)
- `cat{N}_files` → array of file references (Cowork uploads these into the workspace folder; the result gives you the paths or signed URLs)

A category is "skipped" only when all three inputs are empty/blank.

### Ingestion between forms

After each form returns, for each category (N = 1..4 in this form):

1. **`cat{N}_braindump`** — if non-empty, tag and store raw in the working corpus under the category. Don't paraphrase.
2. **`cat{N}_links`** — split on newlines. For each line:
   - HTTP(S) URL → fetch with WebFetch / WebSearch.
   - Local file path → Read it.
   - Folder path → Glob, then Read each file.
3. **`cat{N}_files`** — for each uploaded file:
   - `.md`, `.txt`, `.json`, `.yaml`, `.csv` → Read directly
   - `.pdf` → Read with `pages` param if large
   - `.docx`/`.pptx`/`.xlsx` → use `pandoc` / `textutil` via Bash if available; otherwise note and continue
   - Images → Read (multimodal)

Merge everything into the corpus tagged by category. Then immediately fire the next form. No commentary or summarization between forms.

The 12 categories use Oskar's category breakdown. Bullet inspiration prompts are Oskar's prompt blocks verbatim, plus Ben's framing of "brain-dump anything around any of these bullets."

---

### The 12 categories — 3 forms × 4 categories

This is the single universal onboarding. Слаги в `Title:` — внутренние идентификаторы, оставляй как есть. Заголовки категорий, `Header:` и буллеты показываются пользователю — они на русском.

**Form 1 — Ты и бизнес** — one `mcp__visualize__show_widget` call. Title: `os_setup_form_1_you_business`. Contains Q1–Q4 as stacked `elicit-group` blocks.

**Q1. Ты.** Header: `Ты`
Bullets:
- Имя, роль/должность, локация, ниша
- Когда и как ты работаешь лучше всего (утром? в глубоких блоках? после прогулки?)
- Если бы уважаемый тобой человек представлял тебя в комнате уважаемых тобой людей — как бы ты хотел, чтобы тебя описали?
- 5 качеств, которые тебя описывают (одно-два слова каждое)

**Q2. Твоё начало и позиция (POV).** Header: `POV`
Bullets:
- Почему ты начал или пришёл в то, чем занимаешься сейчас
- Убеждение или позиция, которую ты держишь крепко, даже когда она непопулярна
- «Большая идея», на которой построена твоя работа (клин, тезис)
- Против кого или чего ты воюешь — категория, поведение, архетип конкурента, статус-кво

**Q3. Что ты продаёшь.** Header: `Линейки`
Bullets (по абзацу на каждую линейку дохода, пропусти если их пока нет):
- Название, что делает, для кого, стадия
- Текущая база по выручке, если применимо
- Как оно появилось. Что заставило тебя это начать.

**Q4. Обещание.** Header: `Оффер`
Bullets:
- 1–3 проблемы, которые ты решаешь клиентам
- По каждой проблеме: клиенты уже осознают, что она у них есть, или тебе приходится их этому учить?
- Твоё ценностное предложение в одном предложении
- Обещание или гарантия, которую ты даёшь (явная или подразумеваемая)
- Почему клиенты на самом деле выбирают тебя — их словами, если ты их слышал

**Form 2 — Клиент и бренд** — one `mcp__visualize__show_widget` call. Title: `os_setup_form_2_customer_brand`. Contains Q5–Q8 as stacked `elicit-group` blocks.

**Q5. Клиент.** Header: `Клиент`
Bullets:
- Должность, роль, ниша, зона ответственности
- Как выглядит его день, в каких инструментах он живёт
- Язык и слова, которыми *он* описывает свою проблему
- Желаемый результат мечты, которого он хочет
- Ситуация, в которой он находится *до* прихода к тебе — что запустило поиск
- Сколько времени ему обычно нужно, чтобы решиться на покупку
- Медиа, подкасты, рассылки или авторы, за которыми он следит
- 3–5 реальных примеров (имена, профили LinkedIn или названия компаний)

**Q6. Твой голос и визуал.** Header: `Голос`
Bullets:
- Подходящие дескрипторы тона (прямой, тёплый, сухой, технический, игривый, серьёзный, поддерживающий…)
- 5 качеств, описывающих, как ты звучишь
- Фирменные фразы, которые ты реально используешь
- Слова или фразы, которые ты бы никогда не использовал
- Темы, о которых ты любишь говорить
- Темы, которые ты отказываешься обсуждать публично
- Цвета бренда, шрифты, слоганы, если есть
- Чувство, которое люди должны унести после прочтения твоих материалов
- Или: вставь образец текста / ссылку, и я извлеку из него

**Q7. Твоё позиционирование.** Header: `Позиция`
Bullets:
- Враг, с которым ты воюешь (категория, поведение или архетип конкурента)
- Как ты решаешь проблему *иначе*, чем очевидные альтернативы
- 3–4 чётких сообщения, которые ты хочешь ассоциировать со своим именем или брендом

**Q8. Приоритеты этого года.** Header: `Приоритеты`
Bullets:
- 1–3 результата с привязанной цифрой (выручка, размер аудитории, дата релиза)
- *Почему* за каждым
- Чему ты осознанно говоришь «нет», чтобы сфокусироваться здесь

**Form 3 — Как ты работаешь** — one `mcp__visualize__show_widget` call. Title: `os_setup_form_3_how_you_operate`. Contains Q9–Q12 as stacked `elicit-group` blocks.

**Q9. Активные проекты.** Header: `Проекты`
Bullets (по каждому проекту):
- Название, цель одной строкой, статус, дедлайн если есть
- К какому бизнесу относится (если их несколько)
- Кто ещё вовлечён

**Q10. Люди, с которыми ты работаешь.** Header: `Люди`
Bullets:
- Команда, подрядчики, ключевые внешние контакты
- По каждому: имя, роль, как вы работаете вместе
- Пропусти, если ты полностью соло

**Q11. Твой стек.** Header: `Стек`
Bullets:
- Стек по коммуникациям, встречам, CRM, контенту, финансам, разработке, автоматизации
- Источник правды для каждого основного рабочего процесса — где живут сделки, где живут решения, где реально пишется текст, где живёт календарь

**Q12. Что выматывает и что автоматизировать.** Header: `Дренаж`
Bullets:
- Топ 1–2 болезненных повторяющихся процесса. Используй шаблон:
  Когда происходит **X** → я делаю **Y** → это занимает **Z** времени → результат **W** → а хочу я **V**
- Что прямо сейчас сжирает твоё внимание — незакрытые петли, нерешённые решения, то, что должно быть сделано, но не сделано

---

The user submits each form with one click. Per-category response patterns:
- Type / paste a brain dump, transcript, links, docs, or file paths into the textarea
- Leave the textarea blank to skip that category
- Reply "пропустить всё" / "skip all" between forms — stop asking and move to Phase B+

**Accept whatever they give.** Don't ask follow-ups inside or between forms. Extract what you can.

**If the user submits every form empty** — proceed to build with defaults only.

---

## Phase B+: Additional Context Drop

After Q12 (or "skip all") and **before** Phase B Build, ask one final `AskUserQuestion` to invite any leftover source material that didn't surface during the 12 categories. Most users still have brand decks, About pages, intake forms, LinkedIn URLs, Notion docs, PDFs, slide exports, voice/style guides, OKR docs, org charts, project briefs, etc. Always ask, even if Q1–Q12 looked rich.

**Call AskUserQuestion** (one question, header: `Контекст`, на русском):
- Question: "Есть ещё что-то, из чего мне стоит вытащить контекст перед сборкой? Загрузи файлы (PDF, MD, DOCX), вставь ссылки (LinkedIn, сайты, страницы Notion, Google Docs), укажи локальную папку или вставь сырой текст. Чем больше у меня будет — тем персональнее получится твой vault, а не шаблонные заготовки с заглушками."
- Options:
  - `Да — вставлю ссылки / загружу файлы` — "Проведи меня по шагам"
  - `Да — укажу папку на диске` — "У меня есть локальные файлы"
  - `Нет — собери по ответам выше` — "Строй из того, что есть"
  - `Пропустить` — "Пропустить этот шаг"

**If the user picks a "Yes" option** (or pastes content directly):

1. Collect everything they share. Be greedy — accept anything they offer.
2. **For each link**: call `WebFetch` (or `WebSearch` if the URL is a search). Extract the relevant content.
3. **For each uploaded file or local file path**:
   - `.md`, `.txt`, `.json`, `.yaml`, `.csv` → read directly with `Read`
   - `.pdf` → read with `Read` (use `pages` parameter if >10 pages)
   - `.docx`, `.pptx`, `.xlsx` → use Bash with `pandoc` or `textutil` if available; otherwise tell the user to export as PDF or MD and re-share
   - Images / screenshots → read with `Read` (multimodal)
4. **For a local folder path**: use `Glob` to enumerate, then read each file.
5. **Maintain a context corpus** in working memory — every fact, name, number, quote you find. Tag each by likely target (`me.md`, `brand.md`, `icp.md`, `strategy.md`, `projects/{name}`, etc.).
6. After ingestion, briefly tell the user what you pulled (e.g., "Pulled 4 files: brand-guidelines.pdf, about-page.md, okrs-2026.md, team-roster.csv. 18 links fetched."). One sentence. Then proceed to Build.

**If the user picks `No` or `Skip`**: proceed straight to Build with only the Q1–Q12 answers from Phase B.

---

## Phase B Build: Personalize the Vault

After Q12 + the additional-context drop (or skips), build everything you can from what the user gave you. Work silently — don't narrate each step.

### CRITICAL: real personalization, not template scaffolds

The reference files in `references/` are **scaffolds** — they show the section structure to use. They are **not** the output. Do not copy a template verbatim with placeholders intact.

For every file you write:

1. **Read the reference template** to learn the section structure (headings, frontmatter shape, section order).
2. **Replace every placeholder** (anything in `[brackets]` or marked as TBD) with real data extracted from the 12 Phase B answers + the Phase B+ corpus.
3. **If a section has zero supporting data** after exhausting both Q answers and the corpus: **omit the entire section** rather than writing `[name]` or `TBD`. The output should never contain bracketed placeholders.
4. **If only some bullets in a section have data**: keep the section, drop the empty bullets.
5. **Use the user's actual words, names, numbers, URLs, and quotes** wherever the corpus contains them. Don't paraphrase facts — preserve specificity (exact company names, exact dollar figures, exact dates, exact phrases the user uses).
6. **Cross-reference**: a single fact may belong in multiple files (e.g., "we sell to RevOps leaders at Series B SaaS" belongs in both `icp.md` and `brand.md` positioning). Place it in each file where it's relevant.
7. **Frontmatter `updated:`** = today's date.

A finished context file should read as a real human-written document about the user. If it reads like a fillable form, you did it wrong — go back and fill it.

### Build Step 1: Create Context Files

For every file below, source data from BOTH the Q answers AND the Phase B+ corpus (uploaded files, fetched links, folder reads). The corpus typically contains the depth — Q answers are anchors. Q1–Q12 are the 12 onboarding categories.

- **`Context/me.md`** — Always created. Fill from Q1 (name, role, location, peer-intro line, attributes, working style) + Q2 (origin / POV / wedge / enemy) + Q12 (drains, unclosed loops) + corpus. Read `references/context-me.md` as scaffold.
- **`Context/business.md`** — Only if Q3 had content. Fill from Q3 (revenue lines: name, what it does, who it's for, stage, baseline, origin) + corpus (About page, business overview docs). Read `references/context-business.md` as scaffold.
- **`Context/services.md`** — Only if Q3 lists multiple revenue lines or corpus has product/service docs. Read `references/context-services.md` as scaffold.
- **`Context/pain-points.md`** — Only if Q4 named problems or Q2 surfaced one. Include awareness column (aware vs needs education) using Q4's awareness signal. Read `references/context-pain-points.md` as scaffold.
- **`Context/icp.md`** — Only if Q5 had content or corpus has ICP material. Fill role, day, language, dream outcome, trigger, decision time, media, examples. Read `references/context-icp.md` as scaffold.
- **`Context/brand.md`** — Only if Q6 (voice), Q7 (positioning), or Q4 (why-pick-you) had content, or corpus has brand material. From Q4 take value prop + why-pick-you. From Q6 take voice descriptors, signature phrases, words-to-avoid, feeling, colors/fonts. From Q7 take enemy, differentiation, key messages. Read `references/context-brand.md` as scaffold.
- **`Context/strategy.md`** — Only if Q8 had content. Fill priorities, why, and explicit nos. Read `references/context-strategy.md` as scaffold.
- **`Context/team.md`** — Only if Q10 had content (people / collaborators) or corpus has a team / contractor list. Read `references/context-team.md` as scaffold.
- **`Context/infrastructure.md`** — Only if Q11 (stack) or Q12 (workflows) had content, or corpus has a stack doc. Combine tool stack (Q11) + workflows-to-automate (Q12). Read `references/context-infrastructure.md` as scaffold.

### Build Step 2: Create Project Folders

From Q9 (active projects). Plus any project briefs / Notion exports / project lists in the corpus. Intelligently structure each project based on what the user gave you.

**Analyze the info and decide the right structure:**
- Simple mention ("working on a podcast") → just a `README.md`
- Moderate detail (scope, deadlines, people) → `README.md` + relevant subdirs
- Rich info (briefs, specs, research, multiple workstreams) → full structure with subdirs and files

**Create subdirectories only when the content justifies them:**

| Content type | Goes to |
|---|---|
| Overview, status, deadlines, contacts | `README.md` |
| Research, competitor analysis, references | `research/{topic}.md` |
| Specs, requirements, briefs | `specs/{name}.md` or `briefs/{name}.md` |
| Drafts, scripts, written content | `drafts/{name}.md` |
| Ideas, brainstorms | `ideas/{name}.md` |
| Notes, working docs | `notes/{name}.md` |

**README.md is always the index:**
```markdown
---
type: project
status: active
owner: [name]
business: [business unit if applicable]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
## Overview
[What this project is]

## Current Status
[Where things stand]

## Key Resources
[Links, tools, contacts]

## Next Steps
[What needs to happen]
```

Don't create empty subdirs. Don't cram everything into the README. Distribute content into the right files based on what it actually is.

### Build Step 3: Create First Daily Note

Create `Daily/YYYY-MM-DD.md` (today's date):
```markdown
---
type: daily-note
date: YYYY-MM-DD
---
# YYYY-MM-DD

## Session
- **Focus**: Initial vault setup and onboarding
- **Completed**: Full vault bootstrap + personalized onboarding
- **Next Steps**: [based on what was discussed]
```

### Build Step 4: Confirm Completion

Tell the user (на русском):
- Quick summary of what was created (which context files, how many projects)
- "Open this folder in Obsidian to see your vault"
- "You can add more context anytime — just tell me and I'll update the right files."
- Suggest a next action based on what they told you

## Guidelines

- No mode selection — one universal structure, always `os-mode: professional`
- Phase A is fully automated — no user input needed
- Phase B is **12 categories** (Oskar's structure), batched into **3 rich-HTML forms** rendered via `mcp__visualize__show_widget` (Cowork-only). Each form has 4 stacked categories with title, bullet inspiration, and a single free-text textarea per category. It's a guided **brain dump**, not a Q&A box. The bullets are inspiration, not strict asks. Always recommend Whisper / dictation + pasting docs / links / file paths into the textarea
- No follow-ups, no drilling deeper between forms
- Phase B+ is one final AskUserQuestion (or visualize widget) inviting any leftover files / links / folders — always ask, even if Forms 1–3 looked rich
- Accept any format: typed brain dumps, Whisper transcripts, pasted docs, uploaded files, links (LinkedIn, websites, blog posts, Notion, Drive), local folder paths, or skips
- For every link the user pastes, fetch it (`WebFetch` / `WebSearch`); for every file or folder, read it (`Read` / `Glob`); merge into a single context corpus before building
- **Templates are scaffolds, not outputs.** Replace every `[bracketed placeholder]` with real user data. If a section has no data after exhausting Q answers + corpus, omit the section — never leave placeholders in the written file
- Preserve specificity: use the user's exact names, numbers, URLs, and phrasing
- Only create context files that have real content — don't create empty placeholder files
- Don't narrate every file you're creating — just build it and summarize at the end
