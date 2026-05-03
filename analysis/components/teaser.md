# teaser — Development-Ready Spec (test harness)

> **Test artifact:** This spec intentionally reuses the `header.md` path for pipeline and authoring checks. Component under test: **`teaser`** (promo / editorial teaser block). Structure mirrors `header2.md` (header component analyst output).
> Source: synthetic / design intent  ·  Component: `teaser`  ·  Generated: 2026-05-04

## 1. Summary

- The **teaser** block is a bounded content region for promoting a destination page: optional eyebrow, required headline, supporting body copy, optional media, and a primary call-to-action (text + URL).
- Layout is a single-column stack at all viewports for this test scope; no carousel, no tabs, no video autoplay.
- Authors configure all strings and links in the block table; the block must not hard-code production URLs.
- Audience: content authors (primary), visitors scanning hub pages (read headline and CTA), keyboard and screen-reader users (semantic headings and link affordance).

## 2. State diagram

| From state | Trigger | To state | Notes |
| --- | --- | --- | --- |
| `default` | Page load | `default` | Block is static; no client-side state machine beyond optional hover on CTA. |
| `default` | Hover / focus on primary CTA | `cta-active` | Visual focus ring and hover styles only; no overlay. |
| `cta-active` | Blur / pointer leave | `default` | Revert to resting styles. |

## 3. Content sequences (within the `.teaser` region)

1. **Optional eyebrow** — short uppercase or muted label above the headline; may be empty.
2. **Headline** — single `<h2>`–`<h4>` level per project heading policy (default `<h3>`) wrapping authored title text.
3. **Body copy** — one or more paragraphs of rich text or plain text per project convention.
4. **Optional media** — image (lazy-loaded) or decorative omission; alt text required when image present.
5. **Primary CTA** — text link or button-styled anchor with external or internal `href`; opens in same tab unless `target` / authoring option specifies otherwise (out of scope for minimal test).

## 4. Shared atoms

- **Eyebrow text style** — smaller than headline; neutral colour token from theme (e.g. `--color-text-muted`).
- **CTA affordance** — must meet WCAG contrast against background; focus-visible outline required.
- **Heading level** — exactly one heading element per block instance for this test story.

## 5. User stories

### Story T1: Render an authored teaser with headline, body, and primary CTA
## Epic: DOCEDS-TEST — Sandbox & Component Verification

**Persona:** Visitor  
**Goal:** As a Visitor, I want to scan a concise headline and a clear “next step” link on hub pages so that I can decide whether to open the promoted content.  
**Type:** Authoring (visual + content-bearing)  
**Size:** S  
**Depends on:** none  
**Blocks:** none (test harness; downstream stories may add variants)

**Context (what was observed):**  
Synthetic test scenario (no live URL). The block must map first-row / column semantics from the EDS block table to DOM: eyebrow (optional), headline, body, CTA label + href.

**Scope:**

- IN: render eyebrow (optional), headline, body, primary CTA link with authored `href` and visible label; basic responsive padding; semantic heading + paragraph + anchor.
- OUT: multi-CTA layouts, background video, personalization, analytics beacons, card grids, and header/global navigation (covered by real `header` spec in `header2.md`).

**Content model:**

| Field name | UE component | valueType | Required | Notes |
| --- | --- | --- | --- | --- |
| `eyebrow` | `text` | `string` | N | Short label; omit row or leave empty to skip. |
| `title` | `text` | `string` | Y | Maps to the single heading in the block. |
| `body` | `richtext` | `string` | Y | One primary copy block. |
| `ctaLabel` | `text` | `string` | Y | Visible CTA text. |
| `ctaUrl` | `aem-content` | `string` | Y | Destination for primary CTA. |
| `image` | `reference` | `string` | N | Optional; requires `imageAlt` when set. |
| `imageAlt` | `text` | `string` | N | Required when `image` is set. |

**Acceptance criteria:**

1. **Given** a page with the teaser block authored with `title`, `body`, `ctaLabel`, and `ctaUrl`, **When** the page is rendered, **Then** the visible headline text equals `title` and appears inside exactly one heading element.
2. **Given** the same page, **When** the body region is inspected, **Then** it contains the authored `body` content without dropping required line breaks defined by the content pipeline.
3. **Given** the same page, **When** the primary CTA is inspected, **Then** there is an `<a href>` (or project-approved button-as-link pattern) whose `href` equals `ctaUrl` and whose accessible name includes `ctaLabel`.
4. **Given** `eyebrow` is empty or omitted, **When** the block renders, **Then** no eyebrow wrapper is exposed in the accessibility tree (or the eyebrow element is `aria-hidden="true"` with no visible text—pick one approach per project and document it in implementation).
5. **Given** `eyebrow` is non-empty, **When** the block renders, **Then** eyebrow text appears above the headline and is announced before the heading in reading order.
6. **Given** `image` is omitted, **When** the block renders, **Then** no `<img>` is present and layout does not reserve a broken image box.
7. **Given** `image` and `imageAlt` are set, **When** the block renders, **Then** the `<img>` exposes `alt` equal to `imageAlt` and `loading="lazy"`.
8. **Given** keyboard focus, **When** the user Tabs to the CTA, **Then** a visible `:focus-visible` outline appears and Enter activates the link.

**Visual specification:**

- Layout: vertical stack; comfortable vertical rhythm between eyebrow → headline → body → media → CTA.
- Spacing: block padding uses theme section spacing tokens (document actual pixel values in implementation PR).
- Typography: headline larger than body; CTA distinct (e.g. bold or button style).
- Colour: text and CTA meet WCAG 2.1 AA contrast on default section background.
- Iconography: none required for T1.
- Breakpoint switch: none required for T1 beyond fluid width (100% of section column).

**Accessibility contract:**

- Keyboard: headline is not focusable unless linked; CTA is focusable and activatable.
- ARIA: no `role="heading"` needed if native heading is used; CTA must not rely on colour alone.
- Focus: visible focus on CTA.
- Reduced motion: no auto-playing motion in T1.

**Verification:**

1. Author a fragment with only required fields; load `LOCAL_DEV_URL` and assert heading text, first paragraph substring, and `document.querySelector('.teaser a[href="…"]')` matches `ctaUrl`.
2. Repeat with optional eyebrow and image; assert `alt` and reading order via automated a11y scan or manual VoiceOver pass.

**Evidence:**

- Attach screenshots from local Franklin preview (`teaser-default.png`, `teaser-with-image.png`) when running the test plan.
- Block table fixture checked into repo or pasted in PR description.

**Open questions / Unknowns:**

- Exact heading level (`h2` vs `h3`) is project-specific—confirm with `scripts.js` decoration and page outline.
- Whether eyebrow should be a `<p>` vs `<span>` for semantics—align with design system.

---

### Story T2 (optional follow-up, out of scope for minimal test): Teaser on dark section variant

Deferred: background variant tokens and inverted text colours can be added once T1 passes in CI and manual smoke.
