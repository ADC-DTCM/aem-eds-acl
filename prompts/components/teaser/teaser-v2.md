<!-- This prompt was to build the Teaser component using the skills from Agentic implementation -->

Invoke the building-blocks skill to build a Teaser component in this AEM EDS project.
It should follow the best practices set out by adobe.
Model/Authoring Fields:
* Variant Selector with the options "Half & Half" (default) and "9x3"
* Image: reference field to image asset
* Alt Text: text field for image alt text
* Title: Title field, required
* Description: Rich text editor, required
* CTA 1 and CTA 2: Each CTA has three fields. AEM-content link, text label and select style field with the options primary, secondary, black. All use the textContent_prefix for EDS element grouping
Examples:9x3 example can be found with the component that has the title "Nature's in trouble": https://www.doc.govt.nz/parks-and-recreation/places-to-go/taranaki/places/te-papa-kura-o-taranaki/?tab-id=Skiing-and-ski-touringHalf and half example with title "Nature looks different from here": https://www.doc.govt.nz/news/media-releases/2025-media-releases/incredibly-selfish-brand-new-picnic-table-destroyed-stolen-from-doc-campground/
JS Behaviour:
* Provide default image if none is authored. Image path: https://author-p28003-e1277044.adobeaemcloud.com/adobe/dynamicmedia/deliver/dm-aid--ce6825e2-e556-4c63-95fd-07d377db730b/peak-performance.png. Remove domain and anything else if necessary
* The title field will be rendered as an h3
* The remaining text content is description content
* Links become CTA buttons with the style coming from the style select for the CTA e.g. "primary"
* If the CTA doesn't have any text, then nothing is rendered
CSS:Following the styling from the examples found on live pagesHalf-and-half variant (default):
* Mobile: image on top (16:9 aspect ratio), content below with background colour.
* Desktop (≥768px): side-by-side, image 50% / content 50%, image fills height.
* Fonts: Body text and CTAs use "Afacad", sans-serif. Titles (h1–h6) use "Newake", sans-serif.
9x3 variant:
* Image is positioned absolutely as a full background, content overlaid with z-index.
* White text on the image. Minimum height 300px.
* Desktop (≥768px): content switches to row layout — text 66.6%, CTA area 33.3% aligned to the right.
* Fonts: Uses the site-wide default fonts (no variant-specific overrides).
Use the google mcp to confirm styles and component is correct.
Use any other skills from .agents to implement this component in this EDS project following best practices.

