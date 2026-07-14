---
name: iishenka-runner
description: Build and schedule a personalized Operator prompt that runs the user's second brain on a recurring cadence. The skill is invoked from inside the vault folder locally — it reads `Context/` and `CLAUDE.md` first to infer org, team, brand voice, and paths, then asks ONLY the gaps it can't determine (cadence, connectors, DM recipient, budgets, signature). Fills `references/operator-prompt-template.md`, writes the rendered prompt locally, then invokes the `schedule` skill to wire up the recurring trigger automatically. All user-facing questions and summaries are in Russian. Use when the user says "set up the operator", "build my operator prompt", "operate my second brain", "schedule my OS", "настрой оператора", "запусти мой второй мозг", "поставь OS на расписание", "раннер", or runs /iishenka-runner.
---

# OS Operator (iishenka-runner)

Build a personalized Operator prompt that runs the user's second brain on a recurring schedule. The Operator is a fully autonomous maintenance agent — one session = one run, no questions, no confirmations, executes and reports.

> [!important] Язык общения
> Всё, что видит пользователь, должно быть **на русском** — сводка discovery (Phase 0), вопросы Q1–Q6 (`AskUserQuestion`), блоки подтверждения коннекторов, превью и финальные сообщения. Внутренние инструкции SKILL.md, имена плейсхолдеров `{{...}}`, технические значения, cron-выражения и имена MCP-инструментов остаются как есть. Где ниже дан английский текст вопроса — переводи его на естественный русский при показе.

This skill does **four** jobs, in order:

1. **Discover** what the vault already knows. Read `Context/` and `CLAUDE.md` silently — extract org name, team scope, brand voice, vault folders, runtime conventions.
2. **Ask only the gaps.** Cadence, connectors, DM recipient, budgets, signature. Don't re-ask anything Phase 0 already pulled out of the vault.
3. **Render and save** the personalized prompt locally.
4. **Schedule it.** Hand off to the `schedule` skill (via the `Skill` tool) so the trigger is wired before the run ends — the user does not need to manually run `/schedule create`.

## Reference files

- `references/operator-prompt-template.md` — the parameterized prompt. ~400 lines, preserves every critical rule from the source spec.
- `references/connector-fragments.md` — spliceable body blocks per connector (transcripts, chat, community).

Read both before generating output.

---

## Phase 0 — Silent discovery (no questions, no MCP calls)

The user invokes this skill **from inside their vault folder locally**. Everything here is filesystem-only — and so is the rendered Operator at runtime: it reads and writes the vault with **local file tools** (`Read`, `Write`, `Edit`, `Glob`, `Grep`), not through any vault MCP. The vault is plain local storage. (External *sources* — transcripts, chat, community — are still MCP connectors; only vault access is local.)

1. **Verify the cwd is a vault.** `claude.md` or `CLAUDE.md` must exist at the cwd root. If neither exists, ask the user to `cd` into their vault and re-run. Do not proceed.
2. **List top-level folders.** `Glob` pattern `*/` at cwd. Cache the result as `{{VAULT_FOLDERS}}` (one folder name per line).
3. **Read `CLAUDE.md`.** Pull conventions: signature style, em-dash rule, voice rules, folder routing, any explicit operator paths, `os-mode` (professional vs business).
4. **Read every file in `Context/`.** Whichever exist:
   - `Context/me.md` — operator profile (name, role, focus)
   - `Context/operator.md` — same, business-mode equivalent
   - `Context/business.md` / `Context/organization.md` — **org name**, mission, products, locations
   - `Context/team.md` — **team member full names**, roles, who handles what
   - `Context/brand.md` — voice, colors (look for hex codes that could seed the signature)
   - `Context/strategy.md` — current focus, OKRs (informs which workstreams the operator emphasises)
   - `Context/stakeholders.md` — external people the operator should be aware of (not in team scope, but referenced)
5. **Cache inferred values:**
   - `{{ORG_NAME}}` ← from `Context/business.md` or `organization.md` (title heading or `name:` frontmatter). If none, fall back to the cwd folder name.
   - `{{TEAM_MEMBERS}}` ← comma-separated full names from `Context/team.md`. If solo (`os-mode: professional`), use the operator's own name from `Context/me.md`.
   - `{{EXAMPLE_TEAM_MEMBER}}` ← first name in `{{TEAM_MEMBERS}}`.
   - `{{OPERATOR_NAME}}` (default) ← `{{ORG_NAME}} Vault Operator`.
   - `{{OPERATOR_HANDLE}}` ← slugified, e.g. `Vault-Operator`.
   - `{{OPERATOR_BASE_PATH}}` ← `/Team/{{ORG_NAME}}/Profiles/Vault-Operator/` if `Team/` is one of the discovered top-level folders, else `/{{ORG_NAME}}/Vault-Operator/`.
   - `{{PROFILE_BASE_PATH_PATTERN}}` ← `/Team/{{ORG_NAME}}/Profiles/{Name}/` if applicable.
   - `{{SIGNATURE_BG_COLOR}}` ← any brand color hex found in `Context/brand.md`, else `#D2ECD0`.
   - `{{SIGNATURE_FG_COLOR}}` ← `#020309`.

After Phase 0, summarise to the user in 4–6 short lines what you found — **на русском**. Format:

> **Что я нашёл в твоём vault:**
> - Организация: `{{ORG_NAME}}`
> - Команда: `{{TEAM_MEMBERS}}`
> - Папок верхнего уровня: `{count}` ({первые 5})
> - Путь оператора (предлагаю): `{{OPERATOR_BASE_PATH}}`
> - Цвет подписи бренда (предлагаю): `{{SIGNATURE_BG_COLOR}}`
>
> Что-то поправить? (Напиши название поля, или скажи «всё ок», чтобы продолжить.)

If the user wants overrides, accept them inline (one short follow-up) and update the cache. If "всё ок" / "looks good", proceed straight to Phase 1.

**Do not re-ask any of the above as standalone questions.** They were inferred. Phase 1 is for things the vault genuinely cannot tell you.

---

## Phase 1 — Ask only the gaps

These are the questions the vault cannot answer. Ask one at a time with `AskUserQuestion`.

### Q1 — Cadence

`AskUserQuestion` (на русском). Question: `Как часто запускать оператора?`

- **`Каждый час`** — каждый час, макс. пропускная способность. Для активных команд.
- **`Каждые 4 часа`** — баланс. Ловит новые транскрипты/чаты без спама.
- **`Раз в день`** — один прогон в день. Для соло или низкого объёма.
- **`Свой вариант`** — пользователь вводит cron-выражение или фразу.

Save as `{{CADENCE_HUMAN}}` and `{{CADENCE_TAG}}`.

### Q2 — Источники (опросник, без авто-детекта)

**Не зондируй среду. Спрашивай пользователя напрямую**, какими источниками он пользуется, а затем по каждому выбранному дай рекомендацию, какой доступ нужно предоставить, чтобы оператор реально мог его читать в рантайме. Vault считается подключённым всегда (на нём держится всё файловое I/O).

#### Step 2a — Спросить, какими источниками пользуется

`AskUserQuestion`, **multiSelect: true**, header `Источники` (на русском):

- Question: `Какими источниками будет пользоваться оператор? Vault подключён всегда — отметь дополнительные.`
- Options:
  - `Транскрипты встреч` — `Fireflies, Otter, Granola, Read.ai и т.п. Оператор тянет транскрипты и делает заметки о встречах.`
  - `Рабочий чат` — `Slack, Telegram, Teams, Discord. Дайджест активности + личные эскалации одному человеку.`
  - `Комьюнити` — `Circle, Discourse. Оператор просматривает посты и эскалирует требующие действия.`
  - `Свой источник` — `Любой другой источник: база данных, API, CRM, аналитика (например Supabase). Оператор каждый прогон читает его и пишет дайджест в vault. Без DM-эскалаций.`

Пользователь может выбрать несколько или ни одного. Невыбранные категории → отключены, их секции вырезаются при рендере (Phase 2). Категорий-источников теперь не три, а четыре — `Свой источник` существует именно для того, чтобы пользователь мог указать произвольный источник, не вписывающийся в транскрипты/чат/комьюнити.

#### Step 2b — По каждому выбранному источнику: продукт + метод доступа

Для каждой выбранной категории задай уточняющий `AskUserQuestion` «Какой продукт?» (варианты из таблицы ниже + `Свой вариант`). Затем покажи рекомендацию: что именно нужно подключить и какой доступ выдать, чтобы оператор работал. Это **рекомендация для пользователя** (он настраивает MCP/коннектор у себя), а не действие скилла.

| Категория | Продукт | Что предоставить (метод доступа) | MCP-префикс по умолчанию |
|---|---|---|---|
| Транскрипты | Fireflies | Подключить Fireflies MCP, выдать API-ключ Fireflies (read) | `fireflies` |
| | Otter | Otter MCP/коннектор + токен доступа | `otter` |
| | Granola | Granola MCP + ключ | `granola` |
| | Read.ai | Read.ai коннектор + API-ключ | `read_ai` |
| Чат | Slack | Slack MCP + OAuth-токен с правами на чтение каналов/DM и отправку 1:1 DM | `slack` |
| | Telegram | Telegram MCP (bot token или user-session) с доступом к нужным чатам | `telegram` |
| | Teams | Teams/Graph MCP + токен с read-доступом | `teams` |
| | Discord | Discord MCP + bot token | `discord` |
| Комьюнити | Circle | Circle MCP + API-токен Circle | `circle` |
| | Discourse | Discourse MCP + API-ключ | `discourse` |

Покажи рекомендацию одним блоком на русском, например:

> Чтобы оператор читал транскрипты из **Fireflies**, тебе нужно подключить **Fireflies MCP** и выдать ему API-ключ Fireflies (доступ на чтение). Сделай это в настройках коннекторов до первого запуска по расписанию — иначе шаг транскриптов будет падать и логироваться в Errors.

Затем спроси точное имя MCP-инструмента (префикс), которое оператор будет вызывать в рантайме. Если пользователь не знает — поставь префикс по умолчанию из таблицы. Это и пойдёт в `{{*_MCP_NAME}}`.

**Для категории `Свой источник`** (таблицы для неё нет — источник произвольный) задай три коротких уточнения:

1. Название источника (например, `Supabase`) → `{{CUSTOM_SOURCE_NAME}}`.
2. Точное имя MCP-инструмента / префикс (например, `supabase`) → `{{CUSTOM_SOURCE_MCP_NAME}}`. Не знает — предложи разумный префикс от названия.
3. Что именно тянуть каждый прогон, свободным текстом: какие таблицы/эндпоинты/сущности и за какой период (например, `новые строки в signups и orders за последние 24ч`) → `{{CUSTOM_SOURCE_PULL_DESC}}`.

Поведение этого источника **фиксированное**: читать → писать дайджест в vault (root daily и/или профиль), **без DM-эскалаций**. Покажи рекомендацию по аналогии: «Чтобы оператор читал {{CUSTOM_SOURCE_NAME}}, подключи соответствующий MCP (`{{CUSTOM_SOURCE_MCP_NAME}}`) и выдай токен на чтение до первого запуска по расписанию.»

#### Step 2c — Подтвердить сводку

Покажи один итоговый блок на русском и попроси подтвердить (да / поправить):

> **Источники оператора:**
> - ✅ Vault — локальная файловая система (`Read`/`Write`/`Edit`/`Glob`/`Grep`, подключён всегда)
> - ✅ Транскрипты — Fireflies (`fireflies`) — *не забудь подключить MCP + ключ*
> - ✅ Чат — Telegram (`telegram`) — *не забудь подключить MCP + доступ*
> - ⬜ Комьюнити — не используется
> - ✅ Свой источник — Supabase (`supabase`) — *читать + дайджест, без DM*
>
> Всё верно? (да / поправить)

#### Save

- `{{TRANSCRIPT_PRODUCT_NAME}}` and `{{TRANSCRIPT_MCP_NAME}}`
- `{{CHAT_PRODUCT_NAME}}` and `{{CHAT_MCP_NAME}}`
- `{{COMMUNITY_PRODUCT_NAME}}` and `{{COMMUNITY_MCP_NAME}}`
- `{{CUSTOM_SOURCE_NAME}}`, `{{CUSTOM_SOURCE_MCP_NAME}}`, `{{CUSTOM_SOURCE_PULL_DESC}}` (only if `Свой источник` selected)

Vault access is always **local filesystem** — there is no vault MCP to name or configure. Do not ask for a vault MCP name or a root-folder convention.

This step makes no tool calls — it's a questionnaire. The access recommendations are guidance for the user to wire up before the scheduled run; the skill does not connect anything itself.

### Q3 — DM escalation recipient (only if chat connector is enabled)

Question (на русском):

> Когда Оператор находит пост в комьюнити или тред в чате, требующий действия человека, кто получает личный эскалационный DM? **Только один человек.** Без каналов и групп.

Default the picker to names in `{{TEAM_MEMBERS}}` so the user can pick rather than retype. Save as `{{DM_RECIPIENT_NAME}}`.

If no chat connector is enabled, skip this question. Set `{{DM_RECIPIENT_NAME}}` to the operator's own name from `Context/me.md`/`operator.md` — the placeholder is referenced in a few sections that will be stripped during render anyway.

### Q4 — Budgets

`AskUserQuestion` (на русском). Question: `Лимиты на один прогон?`

- **`Дефолт`** — 50 чтений, 30 записей, 20 транскриптов, 5 DM, 10 правок-уборки за прогон.
- **`Лёгкий`** — 25 / 15 / 10 / 3 / 5. Соло / низкий объём.
- **`Тяжёлый`** — 100 / 60 / 40 / 10 / 20. Большие команды / ежедневный каденс.
- **`Свой вариант`** — пользователь вводит свои значения.

Save as `{{BUDGET_READS}}`, `{{BUDGET_WRITES}}`, `{{BUDGET_TRANSCRIPTS}}`, `{{BUDGET_DMS}}`, `{{BUDGET_HOUSEKEEPING}}`.

### Q5 — Signature color (only if Phase 0 didn't infer one)

If `Context/brand.md` already gave a brand color, skip this. Otherwise ask (на русском):

> Оператор помечает каждый файл, который правит, цветным спаном. Выбери цвет фона (дефолт: `#D2ECD0`, мягкий мятный). Цвет текста по умолчанию: `#020309`.

Save as `{{SIGNATURE_BG_COLOR}}` and `{{SIGNATURE_FG_COLOR}}`.

---

## Phase 2 — Render

1. Read `references/operator-prompt-template.md`.
2. Read `references/connector-fragments.md`.
3. Replace every `{{PLACEHOLDER}}` with the captured value. For connector-specific placeholders (`{{TRANSCRIPTS_BOOTSTRAP_LINE}}`, `{{CHAT_BOOTSTRAP_LINE}}`, `{{COMMUNITY_BOOTSTRAP_LINE}}`, `{{CUSTOM_SOURCE_BOOTSTRAP_LINE}}`, `{{TRANSCRIPTS_STEP_BODY}}`, `{{COMMUNITY_STEP_BODY}}`, `{{CHAT_STEP_BODY}}`, `{{CUSTOM_SOURCE_STEP_BODY}}`, `{{ENABLED_CONNECTORS_LINE}}`, `{{MCP_BLOCK}}`):
   - Enabled connector → splice in the **Enabled** block from `connector-fragments.md`, then re-run placeholder substitution on any nested placeholders.
   - Disabled → drop the section header AND the placeholder. Strip remaining mentions of that connector's product name from Hard Rules, Failure Handling, and Report Schema.
   - `Свой источник` follows the same splice/strip rule: enabled → splice the custom-source blocks and substitute `{{CUSTOM_SOURCE_NAME}}` / `{{CUSTOM_SOURCE_MCP_NAME}}` / `{{CUSTOM_SOURCE_PULL_DESC}}`; disabled → drop step 2c, its bootstrap line, MCP row, and the Custom Source report section.
4. **Derive path values** (full, vault-root-relative paths — local file tools take a plain path, no `folder`/`subpath` split):
   - `{{OPERATOR_TASK_LIST_PATH}}` = `{{OPERATOR_BASE_PATH}}task-list/Tasks.md`
   - `{{OPERATOR_REPORT_PATH_PATTERN}}` = `{{OPERATOR_BASE_PATH}}Daily/{YYYY-MM-DD}-daily.md`
   - `{{PROFILE_DAILY_PATH_PATTERN}}` = `{{PROFILE_BASE_PATH_PATTERN}}Daily/` and `{{PROFILE_DAILY_PATH_EXAMPLE}}`
5. Sanity pass: scan the rendered output for any `{{...}}` strings. If any remain, fix or flag to the user before saving.

Show the user a short preview (title, cadence line, team scope, the rendered file-access block) and ask one yes/no **на русском**: «Сохранить?»

---

## Phase 3 — Save

If yes:

- Use the `Write` tool against the local filesystem.
- Path: `{{OPERATOR_BASE_PATH}}operator-prompt.md` resolved relative to the cwd (the vault root). Strip the leading `/` from `{{OPERATOR_BASE_PATH}}` when resolving locally.
- `Read` it back to confirm content present.

If the file already exists, ask before overwriting.

---

## Phase 4 — Schedule it (do not stop at "saved")

After the prompt is saved, **immediately invoke the `schedule` skill via the `Skill` tool**. Do not stop at "saved". Do not tell the user to run `/schedule create` themselves — wire the trigger now.

### Map cadence → cron

Convert `{{CADENCE_HUMAN}}` into a cron expression for the schedule skill:

| Cadence | Cron |
|---------|------|
| Hourly | `0 * * * *` |
| Every 4 hours | `0 */4 * * *` |
| Daily | `0 9 * * *` (9am local; ask if they want a different hour) |
| Custom | use what the user typed |

### Build the trigger payload

The `schedule` skill creates a trigger that runs Claude Code on a cron. Because the vault is **local storage**, the scheduled run must execute on the machine where the vault lives (local runner), with the vault as its working directory — a cloud-only runner would not see the files. Hand the schedule skill:

- **Cron expression** — from the table above.
- **Working directory** — the cwd (the vault root). The Operator agent must run inside the vault so its local file ops resolve correctly.
- **Prompt** — a short instruction: `"Run the Operator. Read and execute @{{OPERATOR_BASE_PATH}}operator-prompt.md exactly as written. One run = one report. Stop when done."`
- **Trigger name** — `{{OPERATOR_HANDLE}}-{{CADENCE_TAG}}` (e.g. `Vault-Operator-hourly`).
- **Description** — `"{{OPERATOR_NAME}} — {{CADENCE_HUMAN}}"`.

### Invoke the schedule skill

Call the `Skill` tool with `skill: "schedule"` and pass the args described above. Let the schedule skill do its own confirmation flow with the user (timezone, confirm cron, etc.) — it owns that interaction.

If the schedule skill is not installed in the user's environment, fall back to a clear text instruction with the exact cron expression and prompt to paste. Do not pretend the trigger is wired when it isn't.

### After the schedule skill returns

Tell the user, in one short paragraph **на русском**:

> Промпт оператора сохранён в `{{OPERATOR_BASE_PATH}}operator-prompt.md` и поставлен на расписание `{{CADENCE_HUMAN}}` (cron `{cron}`). Первый прогон запустится на следующем тике. Управлять триггером можно в любой момент через `/schedule list` или `/schedule update`.

Stop. Do not propose other follow-ups.

---

## Hard rules for this skill

- **Discovery first.** Read `Context/` and `CLAUDE.md` before asking anything. Never ask for a value the vault already contains.
- **Local-first for vault content, builder AND runtime.** The vault is local storage. The builder uses `Glob`/`Read`/`Write`; the rendered Operator uses `Read`/`Write`/`Edit`/`Glob`/`Grep`. There is no vault MCP at either stage — never reintroduce one or ask the user to name/configure it.
- **Ask, don't probe.** For Q2 (sources), run the questionnaire — ask the user which sources they use, then recommend the access method to provide per source. Make no tool calls and no live probes during Q2.
- **Always finish by scheduling.** Phase 4 is mandatory. Save → invoke the `schedule` skill in the same run. Do not stop at "saved" and tell the user to schedule it themselves.
- **Never modify `CLAUDE.md`.** The Operator owns that file at runtime, not the builder.
- **Strip disabled connectors fully.** Vault + Fireflies only? `Slack` and `Circle` should not appear anywhere in the rendered prompt.
- **Kanban board is always on.** The rendered Operator always manages a root Obsidian-Kanban board `TODO.md` (create-if-missing with Backlog/Today/Done; append-only `- [ ] {task} #ai @{YYYY-MM-DD}` cards to Backlog for escalations). This is local-vault-based, needs no connector, and adds no Phase 1 question — leave step 5b and its rules intact during render.
- **One sanity pass for `{{` after render.** Catch unfilled placeholders before saving.
- **Default to defaults.** Don't pester for individual budget fields when the user picked "Defaults".
