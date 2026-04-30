# doc.govt.nz Header — Assets / Icon Inventory

Captured live via `cursor-ide-browser`-equivalent (`user-chrome-devtools`) MCP at `https://www.doc.govt.nz/` on 2026-04-29.

## Logos / Bitmap-shaped assets

| Asset | URL | Natural | Displayed (1280px) | Use |
| --- | --- | --- | --- | --- |
| Brand wordmark | `/static/doc-front-end/assets/resources/doc-main-logo-white-Bat4Fx9A.svg` | 323 × 122 SVG | 148 × 56 px | Header brand link to `/` (alt: `Department of Conservation \| Te Papa Atawhai`) |
| Always Be Naturing badge | `/globalassets/graphics/abn-logos/shape_e-logo-107-px---15-degrees---for-testing-only.svg` | 133 × 129 SVG | 133 × 129 px (overflows the 108 px green band downward) | Decorative campaign badge linking to `/always-be-naturing` |

## Web fonts

- Header-region computed `font-family`: `"Clear sans", "Sans Serif"` (sans-serif fallback)
- Body font-size on inner row: `16px` / line-height `24px`
- Top-level desktop nav links: `font-size: 14px`, `font-weight: 400`

## Inline SVG icon glyphs (Material Symbols, viewBox `0 0 24 24`)

| Glyph | path d | Where used |
| --- | --- | --- |
| chevron-down | `m12 15.4l-6-6L7.4 8l4.6 4.6L16.6 8L18 9.4z` | Each top-level menu trigger button (Parks & recreation, Nature, Get involved, Our work) — 4 instances; mobile drawer section bars |
| arrow-right (long) | `m15 19l-1.425-1.4l4.6-4.6H2v-2h16.175L13.6 6.4L15 5l7 7z` | Trailing icon on every section sub-link (mega menu list and mobile drawer expanded list) |
| login | `M12 21v-2h7V5h-7V3h7q.825 0 1.413.588T21 5v14q0 .825-.587 1.413T19 21zm-2-4l-1.375-1.45l2.55-2.55H3v-2h8.175l-2.55-2.55L10 7l5 5z` | Leading icon on the Log in link (next to "Log in" text on desktop, icon-only on mobile) |
| menu (hamburger) | `M3 18v-2h18v2zm0-5v-2h18v2zm0-5V6h18v2z` | Mobile-only "Open Main Navigation Menu" button (hidden ≥ 768 px) |

## Search button background

The search submit `<button aria-label="Search">` (34 × 42 px) uses a base64-encoded SVG `background-image` rather than an inline glyph. The SVG draws a beige rectangle (`#E0DCCE`) with a dark-green (`#194036`) magnifying-glass icon and a 1 px vertical separator line (`#384246`).

## CSS background utility classes observed

Tailwind-style utility names exposed on header DOM nodes (informational only; downstream is free to use any equivalent tokens):

- `bg-doc-gold-500` → `rgb(255, 197, 29)` (top accent strip)
- `bg-doc-green-500` → `rgb(25, 64, 54)` (main green band)
- `bg-ranginui-digital-500` / `bg-ranginui-digital-700` → `rgb(21, 121, 183)` (Parks & recreation section, hover deeper blue)
- `bg-papatuanuku-500` / `bg-papatuanuku-800` → `rgb(80, 127, 57)` (Nature section)
- `bg-ata-whenua-500` / `bg-ata-whenua-800` → `rgb(76, 54, 87)` (Get involved section)
- `bg-weta-500` / `bg-weta-800` → `rgb(128, 51, 26)` (Our work section)
- `border-maui-600` / `text-maui-600` → `rgb(56, 66, 70)` (popular-chip outline; chip text)

## Console errors during capture

4 `[error] Failed to load resource: net::ERR_CONNECTION_REFUSED` messages were observed; their stacks did **not** touch the `header` subtree. Treated as out-of-scope (analytics/tracking) for this spec.
