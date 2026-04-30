# doc.govt.nz Header — Capture Log

Source: `https://www.doc.govt.nz/` · Component: `header` · Captured: 2026-04-29 via `user-chrome-devtools` MCP.

> Viewport caveat: the MCP browser cannot render below ~485 px width. Mobile artefacts were captured at the actual rendered viewport `500 × 844` (with `<header>` measuring 485 × 152). The mobile breakpoint behaviour was verified separately via `window.matchMedia('(min-width: 768px)')` returning `false` at this width and `true` at 768 — see `breakpoint.json` below.

## 1280 × 900 (desktop)

| State | Screenshot | Snapshot | Notes |
| --- | --- | --- | --- |
| `default` | `1280-default-viewport.png` | `snapshot-1280-default.txt` | Header height 108 px (yellow strip 20 px + green band 88 px). Inner row width capped at 1066 px, centred. |
| `mega-parks-open` | `1280-mega-parks-open.png` | `snapshot-1280-mega-parks-open.txt` | Panel `#nav-parks-recreation` opens at `position: absolute; top: 108px; left: 50%; z-index: 10; max-width: 1024px`, white background, `padding: 16px 20px`, contains a **section-sub-list** column (blue `rgb(21,121,183)` chip rows w/ trailing arrow) and a **popular-chips rail** (outlined chips, `border-maui-600`). Trigger button's `aria-expanded` flips to `"true"`. |
| `mega-nature-open` | `1280-mega-nature-open.png` | (re-uses default snapshot tree) | Identical structure; section colour shifts to green `rgb(80,127,57)`. |
| `search-with-text` | `1280-search-with-text.png` | `snapshot-1280-search-with-text.txt` | Typing "kakapo" surfaces a 3-row autosuggest dropdown (white panel, dark text) anchored below the input: "kakapo", "kakapo cam", "kakapo live cam". |

## 1440 × 900 (wide)

| State | Screenshot | Snapshot | Notes |
| --- | --- | --- | --- |
| `default` | `1440-default.png` | (re-uses desktop tree) | Header height still 108 px; inner row still capped at 1066 px and centred. No layout change vs 1280. |

## 768 × 1024 (tablet) — md breakpoint boundary

| State | Screenshot | Snapshot | Notes |
| --- | --- | --- | --- |
| `default` | `768-default.png` | (re-uses desktop tree at md+) | Header height 160 px. Hamburger button is **not present**. Top-level nav items wrap into a vertical column inside the green band because the inner row is still capped at 1066 px / centred but the available width forces wrapping. Mega menus still operate the same way. |

## 500 × 844 (mobile, viewport-capped — represents `< 768 px` / mobile mode)

| State | Screenshot | Snapshot | Notes |
| --- | --- | --- | --- |
| `default` | `500-mobile-default-clean.png` | `snapshot-500-mobile-default.txt` | Header height 152 px. Brand row: logo · login icon · hamburger. Search row beneath: full-width input + magnifier submit button. ABN badge overlaps right side. Top-level nav links and chevron buttons are present in DOM but `display: none` until drawer opens. |
| `mobile-drawer-open` | `500-mobile-drawer-open.png` | `snapshot-500-mobile-drawer-open.txt` | Hamburger flips to a white-bordered "X" (`aria-expanded="true"`). Below the green band, four full-width section-colour bars stack vertically: Parks & rec (blue), Nature (green), Get involved (purple), Our work (brown). Each row has a trailing chevron-down. Hero/main content is pushed below the drawer. |
| `mobile-drawer-parks-expanded` | `500-mobile-drawer-parks-expanded.png` | (re-uses mobile-drawer-open tree with `aria-expanded="true"` on the row's button) | Tapping the "Parks & recreation" bar expands an inline list of section sub-links (white background rows with bottom border and trailing arrow), followed by a "Popular" chip rail (outlined chips). Other section bars remain visible below this expanded section. |

## Breakpoint probe

```json
{
  "matchMedia(min-width:768px)": { "at_500px": false, "at_768px": true, "at_1280px": true },
  "burgerButton_present_at_500": true,
  "burgerButton_present_at_768": false,
  "burgerButton_present_at_1280": false
}
```

Result: the layout flips from drawer-mode to mega-menu-mode at exactly **768 px** (`min-width: 768px` media query).

## Skip-link

Live measurement at 1440 px:

```json
{
  "text": "Skip to main content",
  "href": "#main-heading",
  "box": { "x": 26, "y": -62, "w": 148, "h": 24 },
  "color": "rgb(0, 102, 164)",
  "position": "static",
  "visibility": "visible"
}
```

The link is in the DOM as the first focusable child of `<body>`, rendered at `y: -62` (off-screen above the viewport) and only repositioned on focus. No measurement of the focused position was captured — flagged as Open Question in the spec.

## Console messages

```
[error] Failed to load resource: net::ERR_CONNECTION_REFUSED  ×4
```

Stack traces did not touch the `header` subtree. Out of scope for this spec.
