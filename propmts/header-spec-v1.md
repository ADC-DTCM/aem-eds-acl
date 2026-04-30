# Role and context

You are working in the AEM Edge Delivery (Helix-style) repo at:

`/Users/gennadyshifris/Code/eds-accelerator/aem-eds-acl`

## Objective

Implement or update the site header so it matches Department of Conservation (NZ) (<https://www.doc.govt.nz/>) closely enough for stakeholders: layout, typography rhythm, spacing, responsive behavior, and core nav interactions. The local dev site is already running at <http://localhost:3000/> — use that for verification; do not assume a different port.

## Authoritative references (source of truth)

- **Live reference:** <https://www.doc.govt.nz/>
- **Primary check:** homepage header
- **Secondary check** (if the header differs): [e.g. one inner content page URL]
- **Target code — prioritize:**
  - `blocks/header/header.js`
  - `blocks/header/header.css`
- Touch `styles/`, `scripts/`, or `models/` only when needed for structure, authoring, or globals — justify each touch in your summary.

## Skills and conventions

Apply the following skill files (full paths on this machine). If a skill conflicts with existing patterns in this repo, prefer this repository and note the conflict.

**Building blocks**

- `/Users/gennadyshifris/Code/adobe-ai-skills/plugins/aem/edge-delivery-services/skills/building-blocks/SKILL.md`
- `/Users/gennadyshifris/Code/adobe-ai-skills/plugins/aem/edge-delivery-services/skills/building-blocks/resources/js-guidelines.md`
- `/Users/gennadyshifris/Code/adobe-ai-skills/plugins/aem/edge-delivery-services/skills/building-blocks/resources/css-guidelines.md`

**Page and content structure**

- `/Users/gennadyshifris/Code/adobe-ai-skills/plugins/aem/edge-delivery-services/skills/identify-page-structure/SKILL.md`
- `/Users/gennadyshifris/Code/adobe-ai-skills/plugins/aem/edge-delivery-services/skills/content-driven-development/SKILL.md`
- `/Users/gennadyshifris/Code/adobe-ai-skills/plugins/aem/edge-delivery-services/skills/content-driven-development/resources/html-structure.md`
- `/Users/gennadyshifris/Code/adobe-ai-skills/plugins/aem/edge-delivery-services/skills/content-driven-development/resources/cdd-philosophy.md` (when it affects layout or content order)

## Implementation constraints

- Preserve accessibility patterns already in `blocks/header` (keyboard, ARIA, focus); extend rather than gut unless broken.
- Match the DOC reference without embedding third-party trackers or copying unrelated scripts — CSS, markup, and behavior parity only.
- Keep changes scoped; avoid unrelated refactors.
- Run `npm run lint` and fix issues you introduce before considering the task complete.

## Verification (mandatory — browser MCP)

1. Open <http://localhost:3000/> (and the secondary path if listed).
2. Compare against the reference URLs at 375px, 768px, and ≥1200px width (mobile menu vs desktop nav).
3. Confirm: logo placement, main nav visibility, mobile menu open/close, focus order sanity, no repeated console errors attributable to your changes.
4. Record brief notes of what you checked (viewport and pass/fail).

## Definition of done

- Header visually and interactively matches the DOC reference within [reasonable tolerance: e.g. ± minor font or stack differences are OK].
- Local preview at <http://localhost:3000/> demonstrates the result.
- Lint passes for touched areas.
- MCP verification table attached.
- Short summary: files changed; what was matched vs deferred (with reasons).

## Deferrals / out of scope (remove this section if not needed)

- [e.g. full site search backend, login, non-header footer]

## Mandatory browser verification

“Before you say you’re done, you must verify in Chrome MCP: navigate to <URLs>, resize to 390×844, 768, and 1280 width, capture snapshots, and optionally screenshots. If you skip browser MCP verification, the task is not complete.”
Explicit tooling

“Use cursor-ide-browser / user-chrome-devtools MCP (whatever is enabled): navigate_page → take_snapshot / take_screenshot → resize_page → click where needed.”
Checklist

“Produce a short verification table: viewport × URL × what you checked (layout, hamburger position, mega panel, outline/focus states, console errors).”
Compare to reference

“Side‑by‑side doc.govt.nz vs localhost — same viewports, note differences, don’t declare parity until MCP confirms.”
Hard gate

“Do not rely only on curl/HTML/CSS inference for visual/UI claims.”
