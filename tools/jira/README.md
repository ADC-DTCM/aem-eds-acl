# Jira Story Creator

Iterates every `*.md` file under `analysis/components/`, parses the
component spec (Epic heading + `### Story <id>:` blocks under
`## 5. User stories`), refines each story via the Atlassian Rovo agent
API, and creates the corresponding Epics and Stories in Jira Cloud via
the REST API v3.

Story keys in Jira are prefixed with the source file stem to keep them
globally unique, e.g. story `H1` in `header2.md` becomes `header2-H1` in
the Jira summary.

Each story's parent Epic can be declared in either of two places:

- **`## Epic: KEY — Name`** at file scope (used by `teaser.md`). Acts as
  the default Epic for every story in the file.
- **`### Epic: KEY — Name`** placed immediately under the
  `### Story <id>: ...` heading (used by `header2.md`). Overrides the
  file-level default for that story only.

Stories with no epic declared (neither file-level nor per-story) are
still created — they appear in Jira **without** a parent / Epic Link
field. See [Auditing orphan stories](#auditing-orphan-stories) below
for the JQL queries that surface them.

## Setup

```bash
cd tools/jira
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env with your token, email, base URL and project key
```

You can also let `python-dotenv` load `.env` automatically — the script
calls `load_dotenv()` at startup.

## Usage

```bash
# Dry run — parses, refines, prints the planned Jira writes, but does not
# call the Jira create endpoint.
python3 tools/jira/create_stories.py --dry-run --limit 5

# Real run against the whole analysis/components/ directory.
python3 tools/jira/create_stories.py

# Run against a single spec file.
python3 tools/jira/create_stories.py --input analysis/components/header2.md

# Skip Rovo refinement entirely (post stories as-authored).
python3 tools/jira/create_stories.py --no-refine
```

### CLI flags

| flag           | default                      | description                                                                       |
| -------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `--input PATH` | `analysis/components`        | Directory of `*.md` spec files (or a single `.md` file). `_*.md` drafts skipped.  |
| `--dry-run`    | off                          | Parse + refine only, no Jira writes                                               |
| `--limit N`    | unlimited                    | Process only the first N stories                                                  |
| `--no-refine`  | off                          | Skip Rovo, post stories as-authored                                               |
| `--verbose`    | off                          | DEBUG-level logging                                                               |
| `--summary-out`| `tools/jira/run-summary.json`| Path for the structured run summary                                               |

### Environment variables

See [`.env.example`](./.env.example). Required: `JIRA_API_TOKEN`,
`USER_EMAIL`, `ATLASSIAN_BASE_URL`, `JIRA_PROJECT_KEY`.

## Behaviour

For the full input-format contract (recognised keys, file-discovery
rules, parser internals, edge cases) see [SPEC-FORMAT.md](./SPEC-FORMAT.md).

- **Per-story or per-file Epic.** Each `### Story <id>: <title>` block
  becomes a Jira Story whose key is `<file-stem>-<id>` (e.g.
  `header2-H1`). Its parent Epic is resolved from a `### Epic:` line
  directly under the story heading, or — if absent — from the file's
  top-level `## Epic:` line. Stories that resolve no epic are created
  as orphans. Multiple Epics per file are supported.
- **Two-pass creation.** Pass 1 finds-or-creates each unique Epic. Pass
  2 creates each Story and links it to its parent Epic via the modern
  `parent` field (or via `JIRA_EPIC_LINK_FIELD` for legacy
  company-managed projects). Orphan Stories skip both fields.
- **Idempotent.** Both passes run a JQL search by the story/epic key
  (e.g. `header2-H1`) before creating, so re-running the script reuses
  Epics and skips already-created Stories.
- **Resilient.** Transient errors (`429`, `502`, `503`, `504`) are
  retried with exponential backoff. Non-retryable errors are recorded in
  the summary; one bad story never aborts the run. If an Epic fails,
  every child Story is recorded as `SKIPPED (epic unavailable)` instead
  of being orphaned.
- **Rovo-optional.** If `ROVO_AGENT_URL` is unset or the agent call
  fails, the script logs a warning and falls back to the original
  authored text.

### Auditing orphan stories

Stories created without a parent Epic are tagged with the `no-epic`
label and surfaced in the run summary's orphan count. They can be
re-found in Jira at any time with the following JQL queries — paste
into **Filters → Advanced search** in Jira Cloud and replace `<KEY>`
with your `JIRA_PROJECT_KEY`:

```jql
-- Modern team-managed projects (uses the `parent` field)
project = "<KEY>" AND issuetype = Story AND parent is EMPTY

-- Legacy company-managed projects (uses the Epic Link custom field)
project = "<KEY>" AND issuetype = Story AND "Epic Link" is EMPTY

-- Catch-all (covers both, useful while migrating)
project = "<KEY>"
  AND issuetype = Story
  AND parent is EMPTY
  AND "Epic Link" is EMPTY

-- Or filter just to the ones the script created
project = "<KEY>" AND issuetype = Story AND labels = "no-epic"
```

You can save any of these as a Filter and add it to a dashboard via the
**Filter Results** gadget for an ongoing "stories missing an Epic"
widget. The script also logs each orphan creation at INFO level
(`Story <key> has no Epic — will be created without a parent`) and
records `orphan: true` per story in `tools/jira/run-summary.json`.

## Output

At the end of the run, the script prints a summary and writes
`tools/jira/run-summary.json` with the full structured report:
counts, epic-key → Jira-key map, story-key → Jira-key + parent + url,
and any failure reasons.

Exit codes: `0` on full success, `1` if any failures, `2` on
configuration error.
