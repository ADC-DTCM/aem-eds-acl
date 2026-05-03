#!/usr/bin/env python3
"""Create Jira Epics and Stories from analysis/user-stories.md.

Two-pass workflow:

1. Parse the markdown into Epic and Story records.
2. Pass 1 — ensure each Epic exists in Jira (find-or-create by key).
3. Pass 2 — for each Story, optionally refine via the Atlassian Rovo agent
   API, then create it in Jira and link it to its parent Epic.

The script is idempotent: re-running reuses existing Epics and skips
already-created Stories. Failures are recorded but never abort the run;
a structured summary is written to tools/jira/run-summary.json.

Usage:
    python tools/jira/create_stories.py --dry-run --limit 3
    python tools/jira/create_stories.py
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests
from requests.auth import HTTPBasicAuth

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover - dotenv is optional at runtime
    pass


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s — %(message)s"
logger = logging.getLogger("create_stories")


def configure_logging(verbose: bool) -> None:
    level_name = os.getenv("LOG_LEVEL", "DEBUG" if verbose else "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(level=level, format=LOG_FORMAT)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Config:
    user_email: str
    api_token: str
    base_url: str
    project_key: str
    rovo_agent_url: str | None
    rovo_agent_id: str | None
    story_type: str
    epic_type: str
    epic_link_field: str | None

    @property
    def auth(self) -> HTTPBasicAuth:
        return HTTPBasicAuth(self.user_email, self.api_token)


def load_config() -> Config:
    """Load config from env. Raises SystemExit(2) on missing required vars."""
    required = {
        "USER_EMAIL": os.getenv("USER_EMAIL"),
        "JIRA_API_TOKEN": os.getenv("JIRA_API_TOKEN"),
        "ATLASSIAN_BASE_URL": os.getenv("ATLASSIAN_BASE_URL"),
        "JIRA_PROJECT_KEY": os.getenv("JIRA_PROJECT_KEY"),
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        logger.error("Missing required env vars: %s", ", ".join(missing))
        logger.error("See tools/jira/.env.example for the full list.")
        raise SystemExit(2)

    base_url = required["ATLASSIAN_BASE_URL"].rstrip("/")
    return Config(
        user_email=required["USER_EMAIL"],
        api_token=required["JIRA_API_TOKEN"],
        base_url=base_url,
        project_key=required["JIRA_PROJECT_KEY"],
        rovo_agent_url=os.getenv("ROVO_AGENT_URL") or None,
        rovo_agent_id=os.getenv("ROVO_AGENT_ID") or None,
        story_type=os.getenv("JIRA_STORY_TYPE", "Story"),
        epic_type=os.getenv("JIRA_EPIC_TYPE", "Epic"),
        epic_link_field=os.getenv("JIRA_EPIC_LINK_FIELD") or None,
    )


# ---------------------------------------------------------------------------
# Markdown parsing
# ---------------------------------------------------------------------------


@dataclass
class Epic:
    key: str
    name: str

    @property
    def summary(self) -> str:
        return f"{self.key}: {self.name}"


@dataclass
class Story:
    """A user story parsed from a component spec file.

    Optional fields hold raw markdown text (preserved verbatim with
    newlines) so the ADF builder can render them as plain-text blocks
    in the Jira description.
    """

    key: str
    title: str
    epic: Epic | None
    user_story: str
    acceptance_criteria: list[str] = field(default_factory=list)
    persona: str = ""
    story_type: str = ""
    size: str = ""
    depends_on: str = ""
    blocks: str = ""
    context: str = ""
    scope: str = ""
    content_model: str = ""
    visual_spec: str = ""
    a11y_contract: str = ""
    verification: str = ""
    evidence: str = ""
    open_questions: str = ""
    source_file: str = ""

    @property
    def summary(self) -> str:
        return f"{self.key}: {self.title}"


# Regex patterns are anchored to start-of-line (re.MULTILINE).
EPIC_HEADING_RE = re.compile(
    r"^##\s+Epic:\s+(?P<key>[A-Z][A-Z0-9-]+)\s*[—–-]\s*(?P<name>.+?)\s*$",
    re.MULTILINE,
)
# `### Epic: ...` placed immediately under a `### Story ...` heading. Same
# capture-group names as EPIC_HEADING_RE so callers can use either match.
EPIC_HEADING_H3_RE = re.compile(
    r"^###\s+Epic:\s+(?P<key>[A-Z][A-Z0-9-]+)\s*[—–-]\s*(?P<name>.+?)\s*$",
    re.MULTILINE,
)
# `### Story <id>: <title>` — id is alphanumeric (e.g. H1, T1, ABC-2).
STORY_HEADING_RE = re.compile(
    r"^###\s+Story\s+(?P<id>[A-Za-z][A-Za-z0-9-]*?):\s+(?P<title>.+?)\s*$",
    re.MULTILINE,
)
# Heading that opens the user-stories section. Tolerant of "## 5. User stories",
# "## User Stories", trailing punctuation, etc.
USER_STORIES_SECTION_RE = re.compile(
    r"^##\s+(?:\d+\.\s*)?user\s+stories\b.*$",
    re.MULTILINE | re.IGNORECASE,
)
# Inline `**Key:** value` (single line)
INLINE_FIELD_RE = re.compile(
    r"^\s*\*\*(?P<key>[A-Za-z][A-Za-z /]+?)\s*[:：]\s*\*\*\s*(?P<value>.*?)\s*$"
)
# A block heading: `**Key:**` on its own line (multi-line block follows)
BLOCK_FIELD_RE = re.compile(
    r"^\s*\*\*(?P<key>[A-Za-z][A-Za-z (),/]+?)\s*[:：]\s*\*\*\s*$"
)
# Numbered list item: `1. text` or `12. text`.
NUMBERED_ITEM_RE = re.compile(r"^\s*(\d+)\.\s+(?P<text>.+?)\s*$")


def iter_component_files(path: Path) -> list[Path]:
    """Expand --input to an ordered list of *.md files.

    Accepts either a directory (returns sorted *.md, skipping `_*.md`
    drafts) or a single file path (returned as a one-item list).
    """
    if path.is_file():
        return [path]
    if not path.is_dir():
        return []
    files = sorted(p for p in path.glob("*.md") if not p.name.startswith("_"))
    return files


def parse_component_file(path: Path) -> list[Story]:
    """Parse a single component spec file into a list of stories.

    Epic resolution rules:

    - `## Epic: KEY — Name` (level-2) anywhere in the file is an
      **optional file-level default** for any story that does not
      declare its own epic.
    - `### Epic: KEY — Name` (level-3) placed immediately under a
      `### Story ...` heading is a **per-story override** that wins
      over the file-level default.
    - Stories without either are returned with `story.epic = None` and
      will be created as orphans (no `parent` field) by the Jira
      client.
    """
    text = path.read_text(encoding="utf-8")

    file_epic_match = EPIC_HEADING_RE.search(text)
    file_epic: Epic | None = None
    if file_epic_match:
        file_epic = Epic(
            key=file_epic_match.group("key"),
            name=file_epic_match.group("name").strip(),
        )

    # Locate the user-stories section anywhere in the file. If absent,
    # scan the whole document (some spec files may put the stories at
    # the top).
    section_match = USER_STORIES_SECTION_RE.search(text)
    section_start = section_match.end() if section_match else 0
    section_text = text[section_start:]

    file_stem = _file_stem_slug(path)
    stories: list[Story] = []

    headings = list(STORY_HEADING_RE.finditer(section_text))
    for i, heading in enumerate(headings):
        block_start = heading.end()
        block_end = headings[i + 1].start() if i + 1 < len(headings) else len(section_text)
        raw_block = section_text[block_start:block_end]
        block, story_epic = _strip_leading_story_epic(raw_block)
        resolved_epic = story_epic or file_epic

        local_id = heading.group("id").strip()
        title = heading.group("title").strip()
        story = _parse_story_block(
            key=f"{file_stem}-{local_id}",
            title=title,
            epic=resolved_epic,
            block=block,
            source_file=str(path),
        )
        stories.append(story)

    logger.debug("Parsed %d stories from %s", len(stories), path)
    return stories


def _strip_leading_story_epic(block: str) -> tuple[str, Epic | None]:
    """If the block opens with a `### Epic: ...` line, peel it off.

    The header2 spec format places the Epic immediately under each
    Story heading; that line should not be parsed as story body content.
    Leading blank lines before the Epic heading are tolerated. Returns
    the trimmed block plus the parsed Epic (or None if no epic line was
    found at the top of the block).
    """
    lines = block.splitlines(keepends=True)
    cursor = 0
    # Skip leading blank lines.
    while cursor < len(lines) and not lines[cursor].strip():
        cursor += 1
    if cursor >= len(lines):
        return block, None

    match = EPIC_HEADING_H3_RE.match(lines[cursor].rstrip("\n"))
    if not match:
        return block, None

    epic = Epic(key=match.group("key"), name=match.group("name").strip())
    # Drop the epic line itself.
    cursor += 1
    # Drop one trailing blank line so the body reads naturally.
    if cursor < len(lines) and not lines[cursor].strip():
        cursor += 1
    return "".join(lines[cursor:]), epic


def _file_stem_slug(path: Path) -> str:
    """Kebab-case slug of the file stem, suitable as a Jira key prefix."""
    stem = path.stem
    return re.sub(r"[^A-Za-z0-9-]+", "-", stem).strip("-").lower() or "spec"


def _parse_story_block(
    *, key: str, title: str, epic: Epic, block: str, source_file: str
) -> Story:
    """Walk a single story block and pull out structured fields."""
    lines = block.splitlines()

    inline_fields: dict[str, str] = {}
    block_fields: dict[str, list[str]] = {}
    acceptance: list[str] = []

    current_block: str | None = None
    in_acceptance = False
    pending_ac: list[str] | None = None

    def flush_pending_ac() -> None:
        nonlocal pending_ac
        if pending_ac is not None:
            acceptance.append(" ".join(s.strip() for s in pending_ac).strip())
            pending_ac = None

    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()

        # `---` ends the block (also defensive; we already slice between headings).
        if stripped == "---":
            break

        # Blank lines: terminate any in-progress acceptance criterion line wrap,
        # but stay inside the current block until a new heading appears.
        if not stripped:
            flush_pending_ac()
            continue

        # Single-line `**Key:** value` always wins over the block detector.
        inline = INLINE_FIELD_RE.match(line)
        if inline and inline.group("value"):
            key_norm = _normalise_field_key(inline.group("key"))
            inline_fields[key_norm] = inline.group("value").strip()
            current_block = None
            in_acceptance = False
            flush_pending_ac()
            continue

        # `**Key:**` on its own line opens a multi-line block (e.g. Context,
        # Visual specification, Verification, etc.).
        block_open = BLOCK_FIELD_RE.match(line)
        if block_open:
            flush_pending_ac()
            key_norm = _normalise_field_key(block_open.group("key"))
            current_block = key_norm
            block_fields.setdefault(current_block, [])
            in_acceptance = key_norm == "acceptance criteria"
            continue

        # Inside the Acceptance Criteria block, parse numbered items.
        if in_acceptance:
            num = NUMBERED_ITEM_RE.match(line)
            if num:
                flush_pending_ac()
                pending_ac = [num.group("text")]
                continue
            if pending_ac is not None:
                # Wrapped continuation of the previous numbered item.
                pending_ac.append(stripped)
                continue
            # Stray line inside the AC block — append to its raw text too.
            block_fields.setdefault("acceptance criteria", []).append(line)
            continue

        # Otherwise, append to whichever block is currently open.
        if current_block is not None:
            block_fields[current_block].append(line)

    flush_pending_ac()

    def block_text(name: str) -> str:
        return "\n".join(block_fields.get(name, [])).strip()

    return Story(
        key=key,
        title=title,
        epic=epic,
        user_story=inline_fields.get("goal", "").strip(),
        acceptance_criteria=[item for item in acceptance if item],
        persona=inline_fields.get("persona", ""),
        story_type=inline_fields.get("type", ""),
        size=inline_fields.get("size", ""),
        depends_on=inline_fields.get("depends on", ""),
        blocks=inline_fields.get("blocks", ""),
        context=block_text("context (what was observed)") or block_text("context"),
        scope=block_text("scope"),
        content_model=block_text("content model"),
        visual_spec=block_text("visual specification"),
        a11y_contract=block_text("accessibility contract"),
        verification=block_text("verification"),
        evidence=block_text("evidence"),
        open_questions=block_text("open questions / unknowns")
        or block_text("open questions"),
        source_file=source_file,
    )


def _normalise_field_key(key: str) -> str:
    """Normalise a `**Key:**` token: lowercase, single-spaced, trimmed."""
    return re.sub(r"\s+", " ", key.strip().lower())


def parse_components(input_path: Path) -> tuple[list[Epic], list[Story]]:
    """Iterate every component spec file under input_path and aggregate.

    Distinct Epic keys are collected from each story's resolved epic
    (per-story `### Epic:` wins over file-level `## Epic:`). Stories
    that have no epic at all (orphans) keep `story.epic = None` and are
    counted separately — they are downstream-created without a `parent`
    field.
    """
    files = iter_component_files(input_path)
    if not files:
        logger.warning("No component spec files found at %s", input_path)
        return [], []

    epics: list[Epic] = []
    epics_by_key: dict[str, Epic] = {}
    stories: list[Story] = []

    for path in files:
        file_stories = parse_component_file(path)
        for story in file_stories:
            if story.epic is None:
                continue
            canonical = epics_by_key.get(story.epic.key)
            if canonical is None:
                epics.append(story.epic)
                epics_by_key[story.epic.key] = story.epic
            else:
                # Re-point the story at the canonical Epic instance so
                # every sibling story shares a single object identity.
                story.epic = canonical
        stories.extend(file_stories)

    orphan_count = sum(1 for s in stories if s.epic is None)
    logger.info(
        "Parsed %d epics and %d stories from %d file(s) (%d orphan)",
        len(epics),
        len(stories),
        len(files),
        orphan_count,
    )
    return epics, stories


# ---------------------------------------------------------------------------
# Rovo refinement
# ---------------------------------------------------------------------------


@dataclass
class RefinedStory:
    description: str
    acceptance_criteria: list[str]
    refined: bool  # True if Rovo successfully refined; False on fallback


class RovoClient:
    """Best-effort client for the Atlassian Rovo agent API.

    The Rovo agent surface area varies by deployment, so this client is
    deliberately defensive: any non-2xx response, network error, or
    unexpected payload triggers a fallback to the original story text
    with a logged warning. The script keeps running.
    """

    def __init__(self, *, config: Config, session: requests.Session) -> None:
        self.config = config
        self.session = session

    @property
    def enabled(self) -> bool:
        return bool(self.config.rovo_agent_url)

    def refine(self, story: Story) -> RefinedStory:
        original = RefinedStory(
            description=story.user_story,
            acceptance_criteria=list(story.acceptance_criteria),
            refined=False,
        )

        if not self.enabled:
            return original

        prompt = self._build_prompt(story)
        body: dict[str, Any] = {"prompt": prompt}
        if self.config.rovo_agent_id:
            body["agent_id"] = self.config.rovo_agent_id

        try:
            resp = self.session.post(
                self.config.rovo_agent_url,  # type: ignore[arg-type]
                json=body,
                auth=self.config.auth,
                timeout=30,
                headers={"Accept": "application/json"},
            )
        except requests.RequestException as exc:
            logger.warning("Rovo refine failed for %s: %s — using original", story.key, exc)
            return original

        if resp.status_code >= 400:
            logger.warning(
                "Rovo refine for %s returned %s — using original. body=%s",
                story.key,
                resp.status_code,
                _truncate(resp.text, 300),
            )
            return original

        try:
            payload = resp.json()
        except ValueError:
            logger.warning("Rovo refine for %s returned non-JSON — using original", story.key)
            return original

        refined = self._extract_refined(payload, fallback=original)
        if refined.refined:
            logger.debug(
                "Rovo refined %s (description %d -> %d chars, %d -> %d AC items)",
                story.key,
                len(original.description),
                len(refined.description),
                len(original.acceptance_criteria),
                len(refined.acceptance_criteria),
            )
        return refined

    @staticmethod
    def _build_prompt(story: Story) -> str:
        ac_block = "\n".join(f"- {item}" for item in story.acceptance_criteria)
        return (
            "You are a senior product manager. Rewrite the following Jira "
            "story so the description is concise, action-oriented, and the "
            "acceptance criteria are testable. Respond as JSON with two "
            'keys: "description" (string) and "acceptance_criteria" '
            "(array of strings). Do not invent new requirements.\n\n"
            f"Story key: {story.key}\n"
            f"Title: {story.title}\n"
            f"Original description: {story.user_story}\n"
            f"Original acceptance criteria:\n{ac_block}\n"
        )

    @staticmethod
    def _extract_refined(payload: Any, *, fallback: RefinedStory) -> RefinedStory:
        """Best-effort extraction of {description, acceptance_criteria}.

        The Rovo response schema is not standardised, so we probe a few
        common shapes (top-level, nested under `result` / `output` /
        `message`, or a stringified JSON inside a `content` field).
        """
        candidates: list[Any] = []
        if isinstance(payload, dict):
            candidates.append(payload)
            for key in ("result", "output", "message", "data"):
                value = payload.get(key)
                if value is not None:
                    candidates.append(value)
            content = payload.get("content")
            if isinstance(content, str):
                try:
                    candidates.append(json.loads(content))
                except ValueError:
                    pass

        for cand in candidates:
            if not isinstance(cand, dict):
                continue
            description = cand.get("description")
            ac = cand.get("acceptance_criteria") or cand.get("acceptanceCriteria")
            if isinstance(description, str) and isinstance(ac, list):
                return RefinedStory(
                    description=description.strip() or fallback.description,
                    acceptance_criteria=[str(x).strip() for x in ac if str(x).strip()]
                    or fallback.acceptance_criteria,
                    refined=True,
                )
        return fallback


# ---------------------------------------------------------------------------
# Jira client
# ---------------------------------------------------------------------------


RETRYABLE_STATUSES = {429, 502, 503, 504}


class JiraError(RuntimeError):
    """Raised when a Jira API call fails irrecoverably."""

    def __init__(self, message: str, *, status: int | None = None, body: str = "") -> None:
        super().__init__(message)
        self.status = status
        self.body = body


class JiraClient:
    def __init__(self, *, config: Config, session: requests.Session) -> None:
        self.config = config
        self.session = session

    # --- Public API ------------------------------------------------------

    def preflight(self) -> None:
        """Verify base URL, credentials and project up front.

        Raises JiraError on any failure so the run can abort before
        attempting to create issues. Catches typical user mistakes:
          - placeholder base URL still in .env
          - wrong API token / email
          - wrong project key (or no permission on the project)
        """
        if "yourorg" in self.config.base_url.lower():
            raise JiraError(
                f"ATLASSIAN_BASE_URL is still the placeholder ({self.config.base_url}). "
                "Set it to your actual Atlassian Cloud URL, e.g. "
                "https://acme.atlassian.net"
            )

        # 1. Auth check — /myself returns the current user.
        try:
            me = self._request_with_retry("GET", "/rest/api/3/myself").json()
            account = me.get("emailAddress") or me.get("displayName") or "unknown"
            logger.info("Authenticated as %s", account)
        except JiraError as exc:
            if exc.status == 401:
                raise JiraError(
                    "Authentication failed (401). Check USER_EMAIL and "
                    "JIRA_API_TOKEN in tools/jira/.env."
                ) from exc
            raise

        # 2. Project check — /project/{key} confirms the project exists
        # and the user can browse it.
        try:
            project = self._request_with_retry(
                "GET", f"/rest/api/3/project/{self.config.project_key}"
            ).json()
            logger.info(
                "Project %s found: %s", self.config.project_key, project.get("name", "?")
            )
        except JiraError as exc:
            if exc.status in (404, 403):
                raise JiraError(
                    f"Project '{self.config.project_key}' was not found or you lack "
                    f"permission. Verify JIRA_PROJECT_KEY and that "
                    f"{self.config.user_email} has Browse access."
                ) from exc
            raise

    def ensure_epic(self, epic: Epic) -> tuple[str, str]:
        """Return (jira_key, action) where action is 'reused' or 'created'."""
        existing = self._find_issue_by_key_token(epic.key, issue_type=self.config.epic_type)
        if existing:
            logger.info("Epic %s already exists as %s (reused)", epic.key, existing)
            return existing, "reused"

        fields = {
            "project": {"key": self.config.project_key},
            "summary": epic.summary,
            "issuetype": {"name": self.config.epic_type},
            "description": _adf_paragraph(
                f"Epic for {epic.name} — auto-created from analysis/user-stories.md."
            ),
            "labels": ["doc-eds-ai", _label_safe(epic.key)],
        }
        created = self._create_issue(fields)
        logger.info("Created epic %s as %s", epic.key, created)
        return created, "created"

    def find_existing_story(self, story: Story) -> str | None:
        return self._find_issue_by_key_token(story.key, issue_type=self.config.story_type)

    def create_story(
        self,
        story: Story,
        *,
        refined: RefinedStory,
        epic_jira_key: str | None,
    ) -> str:
        """Create a Story in Jira.

        When ``epic_jira_key`` is None the Story is created **without**
        a parent / Epic Link field — i.e. as an orphan. Authors can find
        such stories later via JQL (see tools/jira/README.md → "Auditing
        orphan stories").
        """
        labels = ["doc-eds-ai"]
        if story.epic is not None:
            labels.append(_label_safe(story.epic.key))
        else:
            labels.append("no-epic")

        fields: dict[str, Any] = {
            "project": {"key": self.config.project_key},
            "summary": story.summary,
            "issuetype": {"name": self.config.story_type},
            "description": _build_story_adf(story, refined),
            "labels": labels,
        }
        if epic_jira_key is not None:
            if self.config.epic_link_field:
                fields[self.config.epic_link_field] = epic_jira_key
            else:
                fields["parent"] = {"key": epic_jira_key}

        return self._create_issue(fields)

    def issue_url(self, jira_key: str) -> str:
        return f"{self.config.base_url}/browse/{jira_key}"

    # --- Internal --------------------------------------------------------

    def _find_issue_by_key_token(self, key: str, *, issue_type: str) -> str | None:
        """Look up an existing issue whose summary contains the given key.

        Uses the POST /rest/api/3/search/jql endpoint — the legacy
        GET /rest/api/3/search was removed by Atlassian in 2025.
        See https://developer.atlassian.com/changelog/#CHANGE-2046
        """
        jql = (
            f'project = "{self.config.project_key}" '
            f'AND issuetype = "{issue_type}" '
            f'AND summary ~ "\\"{key}\\""'
        )
        resp = self._request_with_retry(
            "POST",
            "/rest/api/3/search/jql",
            json={"jql": jql, "fields": ["summary"], "maxResults": 5},
        )
        data = resp.json()
        for issue in data.get("issues", []):
            summary = issue.get("fields", {}).get("summary", "")
            # Guard against partial matches (e.g. DOCEDS-1 matching DOCEDS-10).
            if re.search(rf"\b{re.escape(key)}\b", summary):
                return issue.get("key")
        return None

    def _create_issue(self, fields: dict[str, Any]) -> str:
        resp = self._request_with_retry(
            "POST",
            "/rest/api/3/issue",
            json={"fields": fields},
        )
        try:
            data = resp.json()
        except ValueError as exc:
            raise JiraError("Jira create returned non-JSON response") from exc
        key = data.get("key")
        if not key:
            raise JiraError(f"Jira create response missing key: {data!r}")
        return key

    def _request_with_retry(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        max_attempts: int = 3,
    ) -> requests.Response:
        url = f"{self.config.base_url}{path}"
        headers = {"Accept": "application/json", "Content-Type": "application/json"}

        last_exc: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                resp = self.session.request(
                    method,
                    url,
                    params=params,
                    json=json,
                    auth=self.config.auth,
                    headers=headers,
                    timeout=30,
                )
            except requests.RequestException as exc:
                last_exc = exc
                logger.warning(
                    "%s %s network error (attempt %d/%d): %s",
                    method,
                    path,
                    attempt,
                    max_attempts,
                    exc,
                )
                if attempt == max_attempts:
                    raise JiraError(f"Network error: {exc}") from exc
                time.sleep(_backoff(attempt))
                continue

            if resp.status_code < 400:
                return resp

            if resp.status_code in RETRYABLE_STATUSES and attempt < max_attempts:
                logger.warning(
                    "%s %s -> %s (attempt %d/%d), retrying",
                    method,
                    path,
                    resp.status_code,
                    attempt,
                    max_attempts,
                )
                time.sleep(_backoff(attempt))
                continue

            body = _truncate(resp.text, 500)
            raise JiraError(
                f"{method} {path} failed with {resp.status_code}: {body}",
                status=resp.status_code,
                body=body,
            )

        # Defensive — the loop should always return or raise above.
        raise JiraError(f"Unreachable: {method} {path} exhausted retries: {last_exc!r}")


def _backoff(attempt: int) -> float:
    return min(8.0, 0.5 * (2 ** (attempt - 1)))


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "…"


def _label_safe(value: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-") or "untagged"


# ---------------------------------------------------------------------------
# ADF builders
# ---------------------------------------------------------------------------


def _adf_paragraph(text: str) -> dict[str, Any]:
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text}],
            }
        ],
    }


def _adf_heading(text: str, *, level: int = 3) -> dict[str, Any]:
    return {
        "type": "heading",
        "attrs": {"level": level},
        "content": [{"type": "text", "text": text}],
    }


def _adf_multiline_paragraph(text: str) -> dict[str, Any]:
    """Render a multi-line string as a single ADF paragraph with hardBreaks.

    ADF does not allow `\\n` characters in `text` nodes, so each newline
    in the source becomes a `hardBreak` mark between adjacent text runs.
    """
    parts = text.splitlines()
    content: list[dict[str, Any]] = []
    for i, part in enumerate(parts):
        if i > 0:
            content.append({"type": "hardBreak"})
        if part:
            content.append({"type": "text", "text": part})
    if not content:
        content.append({"type": "text", "text": ""})
    return {"type": "paragraph", "content": content}


def _adf_text_block(label: str, body: str) -> list[dict[str, Any]]:
    """Render `label` as a heading followed by `body` as a multi-line paragraph."""
    body = body.strip()
    if not body:
        return []
    return [_adf_heading(label), _adf_multiline_paragraph(body)]


def _adf_metadata_paragraph(story: Story) -> dict[str, Any] | None:
    """Render Persona/Type/Size/Depends on/Blocks as one paragraph w/ hardBreaks."""
    rows: list[tuple[str, str]] = []
    for label, value in (
        ("Persona", story.persona),
        ("Type", story.story_type),
        ("Size", story.size),
        ("Depends on", story.depends_on),
        ("Blocks", story.blocks),
    ):
        if value:
            rows.append((label, value))
    if not rows:
        return None

    content: list[dict[str, Any]] = []
    for i, (label, value) in enumerate(rows):
        if i > 0:
            content.append({"type": "hardBreak"})
        content.extend(
            [
                {"type": "text", "text": f"{label}: ", "marks": [{"type": "strong"}]},
                {"type": "text", "text": value},
            ]
        )
    return {"type": "paragraph", "content": content}


def _build_story_adf(story: Story, refined: RefinedStory) -> dict[str, Any]:
    content: list[dict[str, Any]] = [
        {
            "type": "paragraph",
            "content": [{"type": "text", "text": refined.description or story.user_story}],
        },
    ]

    metadata = _adf_metadata_paragraph(story)
    if metadata is not None:
        content.append(metadata)

    if story.context:
        content.extend(_adf_text_block("Context", story.context))

    if story.scope:
        content.extend(_adf_text_block("Scope", story.scope))

    if story.content_model:
        content.extend(_adf_text_block("Content model", story.content_model))

    content.append(_adf_heading("Acceptance Criteria"))
    ac_items = refined.acceptance_criteria or story.acceptance_criteria
    if ac_items:
        content.append(
            {
                "type": "bulletList",
                "content": [
                    {
                        "type": "listItem",
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": item}],
                            }
                        ],
                    }
                    for item in ac_items
                ],
            }
        )
    else:
        content.append(_adf_multiline_paragraph("(none captured in source spec)"))

    if story.visual_spec:
        content.extend(_adf_text_block("Visual specification", story.visual_spec))
    if story.a11y_contract:
        content.extend(_adf_text_block("Accessibility contract", story.a11y_contract))
    if story.verification:
        content.extend(_adf_text_block("Verification", story.verification))
    if story.evidence:
        content.extend(_adf_text_block("Evidence", story.evidence))
    if story.open_questions:
        content.extend(_adf_text_block("Open questions / Unknowns", story.open_questions))

    if story.source_file:
        content.append(
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "Source: ", "marks": [{"type": "strong"}]},
                    {"type": "text", "text": story.source_file},
                ],
            }
        )

    return {"type": "doc", "version": 1, "content": content}


# ---------------------------------------------------------------------------
# Run report
# ---------------------------------------------------------------------------


@dataclass
class EpicOutcome:
    key: str
    name: str
    status: str  # 'reused' | 'created' | 'failed' | 'dry_run'
    jira_key: str | None = None
    error: str | None = None


@dataclass
class StoryOutcome:
    key: str
    title: str
    epic_key: str | None  # None when the story has no resolved epic (orphan)
    status: str  # 'created' | 'skipped_duplicate' | 'skipped_no_epic' | 'failed' | 'dry_run'
    refined: bool = False
    refine_fallback: bool = False
    orphan: bool = False  # True when created (or planned) without a parent epic
    jira_key: str | None = None
    jira_url: str | None = None
    error: str | None = None


@dataclass
class RunReport:
    started_at: str
    finished_at: str | None = None
    project_key: str = ""
    dry_run: bool = False
    epics: list[EpicOutcome] = field(default_factory=list)
    stories: list[StoryOutcome] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "project_key": self.project_key,
            "dry_run": self.dry_run,
            "epics": [asdict(e) for e in self.epics],
            "stories": [asdict(s) for s in self.stories],
        }


def _print_summary(report: RunReport) -> None:
    epic_counts = _count(report.epics, "status")
    story_counts = _count(report.stories, "status")
    refined_total = sum(1 for s in report.stories if s.refined)
    fallback_total = sum(1 for s in report.stories if s.refine_fallback)

    print()
    print("SUMMARY")
    print(
        f"  Epics:    parsed {len(report.epics)}  "
        f"created {epic_counts.get('created', 0)}  "
        f"reused {epic_counts.get('reused', 0)}  "
        f"failed {epic_counts.get('failed', 0)}"
        + (f"  (dry-run {epic_counts.get('dry_run', 0)})" if report.dry_run else "")
    )
    orphan_total = sum(1 for s in report.stories if s.orphan)
    print(
        f"  Stories:  parsed {len(report.stories)}  "
        f"refined {refined_total}  ({fallback_total} fallback)  "
        f"orphan {orphan_total}"
    )
    print(
        f"            created {story_counts.get('created', 0)}  "
        f"skipped {story_counts.get('skipped_duplicate', 0) + story_counts.get('skipped_no_epic', 0)}  "
        f"failed {story_counts.get('failed', 0)}"
        + (f"  (dry-run {story_counts.get('dry_run', 0)})" if report.dry_run else "")
    )

    if report.epics:
        print()
        print("Epics:")
        for e in report.epics:
            target = e.jira_key or "—"
            print(f"  {e.key:<18} -> {target} ({e.status})")

    failures = [
        f"  - {e.key}: {e.error}" for e in report.epics if e.status == "failed" and e.error
    ] + [
        f"  - {s.key}: {s.error}" for s in report.stories if s.status == "failed" and s.error
    ]
    if failures:
        print()
        print("Failures:")
        for line in failures:
            print(line)


def _count(items: Iterable[Any], attr: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        value = getattr(item, attr)
        counts[value] = counts.get(value, 0) + 1
    return counts


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def run(args: argparse.Namespace) -> int:
    configure_logging(args.verbose)

    input_path = Path(args.input)
    if not input_path.exists():
        logger.error(
            "Input path not found: %s (expected a directory of *.md spec "
            "files, or a single .md file)",
            input_path,
        )
        return 2

    config = load_config()
    logger.info(
        "Loaded config: base_url=%s project=%s rovo=%s",
        config.base_url,
        config.project_key,
        "on" if config.rovo_agent_url else "off",
    )

    epics, stories = parse_components(input_path)
    if not stories:
        logger.error("No stories parsed from %s — aborting.", input_path)
        return 2

    if args.limit is not None and args.limit >= 0:
        stories = stories[: args.limit]
        relevant_epic_keys = {s.epic.key for s in stories if s.epic is not None}
        epics = [e for e in epics if e.key in relevant_epic_keys]
        logger.info(
            "Limit=%d -> processing %d stories across %d epics",
            args.limit,
            len(stories),
            len(epics),
        )

    report = RunReport(
        started_at=datetime.now(timezone.utc).isoformat(),
        project_key=config.project_key,
        dry_run=args.dry_run,
    )

    session = requests.Session()
    rovo = RovoClient(config=config, session=session)
    if args.no_refine:
        logger.info("Refinement disabled via --no-refine")
    elif not rovo.enabled:
        logger.info("ROVO_AGENT_URL not set — refinement disabled, using original text")

    jira = JiraClient(config=config, session=session)

    # --- Preflight (skipped on dry-run) ---------------------------------
    if not args.dry_run:
        try:
            jira.preflight()
        except JiraError as exc:
            logger.error("Preflight failed: %s", exc)
            return 2

    # --- Pass 1: epics ---------------------------------------------------
    epic_jira_keys: dict[str, str] = {}
    for epic in epics:
        if args.dry_run:
            outcome = EpicOutcome(key=epic.key, name=epic.name, status="dry_run")
            report.epics.append(outcome)
            logger.info("[dry-run] would ensure epic %s", epic.key)
            epic_jira_keys[epic.key] = f"DRY-RUN-{epic.key}"
            continue
        try:
            jira_key, action = jira.ensure_epic(epic)
            epic_jira_keys[epic.key] = jira_key
            report.epics.append(
                EpicOutcome(key=epic.key, name=epic.name, status=action, jira_key=jira_key)
            )
        except JiraError as exc:
            logger.error("Failed to ensure epic %s: %s", epic.key, exc)
            report.epics.append(
                EpicOutcome(
                    key=epic.key,
                    name=epic.name,
                    status="failed",
                    error=str(exc),
                )
            )

    # --- Pass 2: stories -------------------------------------------------
    for story in stories:
        is_orphan = story.epic is None
        epic_key = story.epic.key if story.epic is not None else None
        epic_jira_key: str | None = (
            None if is_orphan else epic_jira_keys.get(story.epic.key)  # type: ignore[union-attr]
        )

        # Pass-1 outage: a non-orphan story whose parent epic failed to
        # be created/found cannot be linked. Skip with a clear marker
        # instead of silently orphaning it.
        if not is_orphan and epic_jira_key is None:
            logger.warning("Skipping %s: parent epic %s unavailable", story.key, epic_key)
            report.stories.append(
                StoryOutcome(
                    key=story.key,
                    title=story.title,
                    epic_key=epic_key,
                    status="skipped_no_epic",
                    error=f"Epic {epic_key} unavailable",
                )
            )
            continue

        if is_orphan:
            logger.info("Story %s has no Epic — will be created without a parent", story.key)

        # Refine
        if args.no_refine:
            refined = RefinedStory(
                description=story.user_story,
                acceptance_criteria=list(story.acceptance_criteria),
                refined=False,
            )
        else:
            refined = rovo.refine(story)
        was_fallback = rovo.enabled and not args.no_refine and not refined.refined

        if args.dry_run:
            report.stories.append(
                StoryOutcome(
                    key=story.key,
                    title=story.title,
                    epic_key=epic_key,
                    status="dry_run",
                    refined=refined.refined,
                    refine_fallback=was_fallback,
                    orphan=is_orphan,
                )
            )
            logger.info(
                "[dry-run] would create %s %s (refined=%s)",
                story.key,
                "as orphan" if is_orphan else f"under {epic_jira_key}",
                refined.refined,
            )
            continue

        # Idempotency
        try:
            existing = jira.find_existing_story(story)
        except JiraError as exc:
            logger.error("Duplicate-check for %s failed: %s", story.key, exc)
            report.stories.append(
                StoryOutcome(
                    key=story.key,
                    title=story.title,
                    epic_key=epic_key,
                    status="failed",
                    refined=refined.refined,
                    refine_fallback=was_fallback,
                    orphan=is_orphan,
                    error=str(exc),
                )
            )
            continue

        if existing:
            logger.info("Story %s already exists as %s (skipped)", story.key, existing)
            report.stories.append(
                StoryOutcome(
                    key=story.key,
                    title=story.title,
                    epic_key=epic_key,
                    status="skipped_duplicate",
                    refined=refined.refined,
                    refine_fallback=was_fallback,
                    orphan=is_orphan,
                    jira_key=existing,
                    jira_url=jira.issue_url(existing),
                )
            )
            continue

        # Create
        try:
            jira_key = jira.create_story(
                story, refined=refined, epic_jira_key=epic_jira_key
            )
            if is_orphan:
                logger.info("Created %s as %s (orphan, no parent epic)", story.key, jira_key)
            else:
                logger.info(
                    "Created %s as %s under epic %s",
                    story.key,
                    jira_key,
                    epic_jira_key,
                )
            report.stories.append(
                StoryOutcome(
                    key=story.key,
                    title=story.title,
                    epic_key=epic_key,
                    status="created",
                    refined=refined.refined,
                    refine_fallback=was_fallback,
                    orphan=is_orphan,
                    jira_key=jira_key,
                    jira_url=jira.issue_url(jira_key),
                )
            )
        except JiraError as exc:
            logger.error("Failed to create %s: %s", story.key, exc)
            report.stories.append(
                StoryOutcome(
                    key=story.key,
                    title=story.title,
                    epic_key=epic_key,
                    status="failed",
                    refined=refined.refined,
                    refine_fallback=was_fallback,
                    orphan=is_orphan,
                    error=str(exc),
                )
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Unexpected error creating %s", story.key)
            report.stories.append(
                StoryOutcome(
                    key=story.key,
                    title=story.title,
                    epic_key=epic_key,
                    status="failed",
                    refined=refined.refined,
                    refine_fallback=was_fallback,
                    orphan=is_orphan,
                    error=f"unexpected: {exc}",
                )
            )

    report.finished_at = datetime.now(timezone.utc).isoformat()

    # --- Output ----------------------------------------------------------
    summary_path = Path(args.summary_out)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(report.to_dict(), indent=2), encoding="utf-8")
    logger.info("Wrote run summary to %s", summary_path)

    _print_summary(report)

    failed = any(e.status == "failed" for e in report.epics) or any(
        s.status == "failed" for s in report.stories
    )
    return 1 if failed else 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument(
        "--input",
        default="analysis/components",
        help=(
            "Path to a component spec directory or a single .md file. "
            "Defaults to analysis/components — every *.md file (excluding "
            "_*.md drafts) is iterated and one Jira Story is created per "
            "### Story block, linked to the file's ## Epic heading."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and refine only — do not call Jira create endpoints.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process only the first N stories (and the epics that contain them).",
    )
    parser.add_argument(
        "--no-refine",
        action="store_true",
        help="Skip Rovo refinement and post stories as-authored.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable DEBUG logging.",
    )
    parser.add_argument(
        "--summary-out",
        default="tools/jira/run-summary.json",
        help="Where to write the structured run summary.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
