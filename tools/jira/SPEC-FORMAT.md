# Component Spec Markdown Format

This document is the input contract for [tools/jira/create_stories.py](./create_stories.py).
For setup and how to *run* the importer see [README.md](./README.md). This
file is the source of truth for **what shape your `.md` spec files must
take** so the parser picks every story up cleanly.

## At a glance

The absolute minimum for a parseable file is a single Story heading:

```markdown
### Story X1: A meaningful title
```

…anywhere in the file. That alone produces one Jira Story (orphan, no
parent Epic, empty description).

A realistic spec file uses the full grammar below. Here is a minimal-but-
complete template that exercises every section the parser knows about:

```markdown
# my-block — Development-Ready Spec

## Epic: DOCEDS-GLOBAL — Global Components & Layout

## 1. Summary
…ignored prose…

## 5. User stories

### Story M1: Render the thing

### Epic: DOCEDS-GLOBAL — Global Components & Layout

**Persona:** Visitor
**Goal:** As a Visitor, I want to see the thing so that I can act on it.
**Type:** Visual
**Size:** S
**Depends on:** none
**Blocks:** none

**Context (what was observed):**
Some background detail.

**Scope:**
- IN: render the thing.
- OUT: anything else.

**Content model:**
| Field | Type | Required |
| ----- | ---- | -------- |
| label | text | Y |

**Acceptance criteria:**
1. First testable criterion.
2. Second criterion that wraps
   onto a continuation line.

**Visual specification:**
Tokens, spacing, colour notes.

**Accessibility contract:**
Keyboard, ARIA, focus, reduced motion.

**Verification:**
How to prove the criteria pass.

**Evidence:**
Screenshots, snapshots, measurement results.

**Open questions / Unknowns:**
Things still to confirm.

---
```

## File discovery

`--input` (default `analysis/components`) accepts:

- A **directory** — every `*.md` file is processed in alphabetical order.
  Files whose name starts with `_` are treated as drafts and **skipped**.
- A **single `.md` file** — processed on its own.

Source: [iter_component_files](./create_stories.py).

## Epic resolution

A Story's parent Epic is resolved with this precedence:

1. **Per-story** `### Epic: KEY — Name` placed as the first non-blank
   line under the `### Story …` heading. **Wins** over anything else.
2. **File-level** `## Epic: KEY — Name` (first match anywhere in the
   file). Used as the **default** for any story that does not declare
   its own.
3. **Orphan** — neither was found. The Story is still created, but
   without a `parent` / `Epic Link` field, and is labelled `no-epic`.
   See README's [Auditing orphan stories](./README.md#auditing-orphan-stories).

Constraints:

- Epic key must match `[A-Z][A-Z0-9-]+` (e.g. `DOCEDS-GLOBAL`).
- The separator between key and name may be em dash (`—`), en dash
  (`–`), or hyphen (`-`).
- Multiple distinct Epics in one file are supported (one per story via
  `### Epic:`).

## User-stories section

The parser scans for stories starting from the **first** heading that
matches `## … User stories` (case-insensitive, optional `5.` numbering),
e.g. `## 5. User stories` or `## User Stories`.

If that heading is **missing**, the parser falls back to scanning the
**entire file** from the top. This is intentional but discouraged —
authoring guidance is to always include the explicit section heading.

## Story headings

Each Story is opened by a level-3 heading in this exact form:

```markdown
### Story <id>: <Title>
```

- `<id>` matches `[A-Za-z][A-Za-z0-9-]*` (e.g. `H1`, `T1`, `ABC-2`).
- `<Title>` is non-empty text after the colon.

The resulting Jira summary is `<file-stem>-<id>: <Title>`, where the
file stem is lowercased and non-alphanumeric runs are collapsed to `-`.
Examples:

| File | Heading | Jira summary |
| ---- | ------- | ------------ |
| `analysis/components/header2.md` | `### Story H1: Render the gold strip` | `header2-H1: Render the gold strip` |
| `analysis/components/teaser.md` | `### Story T1: Render the teaser` | `teaser-T1: Render the teaser` |

The body of one story runs from the end of its heading until the next
`### Story …` heading (or end of section / end of file).

## Story body grammar

Inside a story's body the parser recognises three line shapes plus one
terminator:

| Shape | Pattern | Behaviour |
| ----- | ------- | --------- |
| **Inline field** | `**Key:** value` (single line, value non-empty) | Stored as `inline_fields[key.lower()] = value`. Always wins over the block detector. |
| **Block heading** | `**Key:**` alone on a line | Opens a multi-line block. Subsequent lines are appended until the next inline field, the next block heading, or the body terminator. |
| **Numbered item** | `1. text` *inside* the `**Acceptance criteria:**` block | Becomes one Acceptance Criterion. Wrapped continuation lines (subsequent non-numbered, non-blank lines) fold into the previous item. |
| **Body terminator** | `---` alone on a line | Ends the story body early. Defensive — stories are also split on the next `### Story …` heading. |

Blank lines flush any in-progress acceptance-criteria wrap but do not
close the current block.

## Recognised `**Key:**` names

Only the keys in this table are copied onto the `Story` object and
rendered into the Jira description. Anything else is parsed but
**ignored** (see next section).

| Markdown key                 | Inline / Block | `Story` field      | Rendered as in Jira description                           |
| ---------------------------- | -------------- | ------------------ | --------------------------------------------------------- |
| `**Persona:**`               | inline         | `persona`          | Bold-prefixed line in the metadata paragraph              |
| `**Goal:**`                  | inline         | `user_story`       | First paragraph of the description                        |
| `**Type:**`                  | inline         | `story_type`       | Metadata paragraph                                        |
| `**Size:**`                  | inline         | `size`             | Metadata paragraph                                        |
| `**Depends on:**`            | inline         | `depends_on`       | Metadata paragraph                                        |
| `**Blocks:**`                | inline         | `blocks`           | Metadata paragraph                                        |
| `**Context (what was observed):**` *(or `**Context:**`)* | block | `context` | "Context" heading + verbatim body                         |
| `**Scope:**`                 | block          | `scope`            | "Scope" heading + verbatim body                           |
| `**Content model:**`         | block          | `content_model`    | "Content model" heading + verbatim body                   |
| `**Acceptance criteria:**`   | block (special) | `acceptance_criteria` | "Acceptance Criteria" heading + bullet list (one per numbered item) |
| `**Visual specification:**`  | block          | `visual_spec`      | "Visual specification" heading + verbatim body            |
| `**Accessibility contract:**`| block          | `a11y_contract`    | "Accessibility contract" heading + verbatim body          |
| `**Verification:**`          | block          | `verification`     | "Verification" heading + verbatim body                    |
| `**Evidence:**`              | block          | `evidence`         | "Evidence" heading + verbatim body                        |
| `**Open questions / Unknowns:**` *(or `**Open questions:**`)* | block | `open_questions` | "Open questions / Unknowns" heading + verbatim body |

The trailing `Source: <path>` line at the end of every Jira description
is added automatically and does not need to be authored.

## What is silently ignored

The parser intentionally does not error on unknown content; it just
drops it. Things that **will not** make it into Jira:

- **Unrecognised `**Key:**` lines.** Examples: `**Date of refinement:**`,
  `**Owner:**`, `**Estimate:**`. They are read into the parser's
  internal `block_fields` map but never copied onto a `Story` field, so
  `_build_story_adf` never renders them. Add a new mapping in
  `_parse_story_block` if you need one of these to surface.
- **Sections outside the user-stories region.** `## 1. Summary`,
  `## 2. State diagram`, `## 3. Content sequences`, `## 4. Shared atoms`,
  `## 6. Cross-cutting requirements`, `## 7. Out of scope`,
  `## 8. Evidence index`, `## 9. Open questions` — useful context for
  human readers, ignored by the importer.
- **Raw HTML, embedded code blocks, and markdown tables outside a
  recognised block.** They are not extracted into structured fields.
- **Stories with no `**Goal:**`.** The story is still created, but its
  description's first paragraph will be empty.

## Parser internals

The single source of truth lives in
[tools/jira/create_stories.py](./create_stories.py). Reference list of
the regex constants and what each one matches:

| Constant                  | Matches                                              |
| ------------------------- | ---------------------------------------------------- |
| `EPIC_HEADING_RE`         | `## Epic: KEY — Name`                                |
| `EPIC_HEADING_H3_RE`      | `### Epic: KEY — Name`                               |
| `STORY_HEADING_RE`        | `### Story <id>: <title>`                            |
| `USER_STORIES_SECTION_RE` | `## (\d+\.)? User stories …` (case-insensitive)      |
| `INLINE_FIELD_RE`         | `**Key:** value` on a single line                    |
| `BLOCK_FIELD_RE`          | `**Key:**` alone on a line (opens multi-line block)  |
| `NUMBERED_ITEM_RE`        | `<n>. text` (used inside `**Acceptance criteria:**`) |

High-level flow inside `parse_component_file`:

1. Match `EPIC_HEADING_RE` to discover an optional file-level Epic.
2. Find the user-stories section start via `USER_STORIES_SECTION_RE`
   (or fall back to the whole file).
3. For each `STORY_HEADING_RE` match, slice the body until the next
   match.
4. `_strip_leading_story_epic` peels off any `### Epic:` prefix.
5. `_parse_story_block` walks the body line-by-line, classifying each
   line via `INLINE_FIELD_RE`, `BLOCK_FIELD_RE`, or `NUMBERED_ITEM_RE`.
6. The resulting `Story` is added to the file's list with its resolved
   Epic (per-story → file-level → `None`).

## Edge cases and tips

- **Globally unique keys.** Two files can both contain `### Story H1:`
  — the resulting Jira summaries (`fileA-H1`, `fileB-H1`) are still
  unique because of the file-stem prefix.
- **Idempotent re-runs.** Each pass JQL-searches by the prefixed key,
  so re-running the importer after a partial run will reuse existing
  Epics and skip already-created Stories. Updating the Markdown does
  **not** update the Jira issue — manual edit (or delete + re-create)
  is required for content changes.
- **Multiple Epics per file.** Mix per-story `### Epic:` lines freely.
  All distinct keys are aggregated and created in pass 1.
- **Orphan stories.** Created without a `parent` / `Epic Link`,
  labelled `no-epic`, and reported with `orphan: true` in
  [run-summary.json](./run-summary.json). Re-find them later with the
  JQL queries in README's [Auditing orphan stories](./README.md#auditing-orphan-stories).
- **Bullets inside non-AC blocks.** Lines like `- IN: …` under
  `**Scope:**` are kept as raw text (preserving the dash) in the
  description. Only `**Acceptance criteria:**` numbered items become a
  Jira bullet list.
- **Em / en / hyphen dashes.** All three are accepted as the separator
  between an Epic key and its name. Authors may use whichever their
  editor produces.
- **`---` rules.** A horizontal rule in source is fine *between*
  stories (it terminates the previous story's body early). Inside a
  story body it will cut the body off.

## See also

- [README.md](./README.md) — setup, environment variables, CLI usage,
  and orphan-story audit JQL.
- [analysis/components/header2.md](../../analysis/components/header2.md)
  — example using per-story `### Epic:` lines.
- [analysis/components/teaser.md](../../analysis/components/teaser.md)
  — example using a single file-level `## Epic:` line.
