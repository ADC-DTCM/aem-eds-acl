<!-- Summary of prompts used to build the Teaser component iteratively -->

Create a teaser block component for AEM Edge Delivery Services with the following specifications:

Model / Authoring Fields (_teaser.json):
* Variant selector — A select field on classes with options: "Half and Half" (default, empty value) and "9x3".
* Image — A reference field for the image asset, plus a text field for alt text.
* Title — A text field (textContent_title), required.
* Description — A richtext field (textContent_description), required.
* CTA 1 & CTA 2 — Each CTA has three fields: an aem-content link field, a text label field, and a select style field with options like "primary", "secondary", "black". All use the textContent_ prefix for EDS element grouping.

JavaScript behaviour (teaser.js):
* EDS renders two rows: row 0 = image, row 1 = grouped text content. Restructure the DOM into .teaser-image and .teaser-content (containing .teaser-text and .teaser-cta).
* Optimise the image using createOptimizedPicture. Provide a default fallback image if none is authored.
* The first text element becomes an <h3> title. Remaining text elements are description content.
* Links (bare <a> or <p> wrapping a single <a>) become CTA buttons with class button, placed in .teaser-cta.
* CTA style handling: The style select field renders its value (e.g. "primary") as a text element after each CTA link. The JS must detect these values, apply them as CSS classes on the preceding button (e.g. <a class="button primary">), and not render them as visible text. Maintain an allowlist of known style values for matching.
* Preserve moveInstrumentation calls for Universal Editor support.

CSS layout (teaser.css):
Shared styles:
* .teaser: flexbox column, rounded corners, overflow hidden.
* .teaser-cta: flex column (vertical stack), align-items: flex-start so buttons fit their content width rather than stretching full width. Buttons must stay inside the teaser container.
* .teaser-cta a.button: min-width: 150px, no margin.
Half-and-half variant (default):
* Mobile: image on top (16:9 aspect ratio), content below with background colour.
* Desktop (≥768px): side-by-side, image 50% / content 50%, image fills height.
* Fonts: Body text and CTAs use "Afacad", sans-serif. Titles (h1–h6) use "Newake", sans-serif.
9x3 variant:
* Image is positioned absolutely as a full background, content overlaid with z-index.
* White text on the image. Minimum height 300px.
* Desktop (≥768px): content switches to row layout — text 66.6%, CTA area 33.3% aligned to the right.
* Fonts: Uses the site-wide default fonts (no variant-specific overrides).
Button styles (in global styles.css, not in the teaser):
* .button.primary — uses --primary-color background, white text.
* .button.secondary — uses --secondary-color background, --text-color text.
* Additional styles (e.g. "black") follow the same pattern.
Fonts (in fonts.css):
* Import Afacad from Google Fonts.
* Import Newake via a local @font-face declaration pointing to an .otf file in the fonts directory.
* Site-wide heading font and body font are set via --heading-font-family and --body-font-family CSS custom properties in styles.css. Component-level font overrides are applied directly in the component CSS for the relevant variant.
