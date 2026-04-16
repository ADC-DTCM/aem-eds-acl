import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const DEFAULT_IMAGE = '/media_1c9306d7674c0b8ee54457c9ac52f817a0d3410ae.png';

export default function decorate(block) {
  // With field collapse + element grouping, EDS renders:
  //   row[0] -> <div> with <picture> (image + imageAlt collapsed)
  //   row[1] -> <div> with text content (all textContent_ fields grouped: title, description, CTAs)
  const rows = [...block.children];
  const [imageRow, textContentRow] = rows;

  // Build image container
  const imageContainer = document.createElement('div');
  imageContainer.className = 'teaser-image';

  if (imageRow) {
    moveInstrumentation(imageRow, imageContainer);
    const pic = imageRow.querySelector('picture');
    if (pic) {
      const img = pic.querySelector('img');
      if (img) {
        const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [
          { width: '750' },
        ]);
        moveInstrumentation(img, optimizedPic.querySelector('img'));
        imageContainer.append(optimizedPic);
      }
    } else {
      const optimizedPic = createOptimizedPicture(
        `${window.hlx.codeBasePath}${DEFAULT_IMAGE}`,
        'Default teaser image',
        false,
        [{ width: '750' }],
      );
      imageContainer.append(optimizedPic);
    }
  }

  // Build content container from the grouped textContent div
  const contentContainer = document.createElement('div');
  contentContainer.className = 'teaser-content';

  if (textContentRow) {
    moveInstrumentation(textContentRow, contentContainer);
    const innerDiv = textContentRow.querySelector('div') || textContentRow;

    const textContainer = document.createElement('div');
    textContainer.className = 'teaser-text';

    const ctaContainer = document.createElement('div');
    ctaContainer.className = 'teaser-cta';

    // Known CTA style values that should be applied as button classes, not rendered
    const ctaStyles = ['primary', 'secondary'];

    // Collect all child elements into a static array to avoid mutation issues
    const children = [...innerDiv.querySelectorAll(':scope > *')];

    // First non-link element is the title — convert to <h2>
    let titleFound = false;
    let lastCta = null;
    children.forEach((child) => {
      // Links (or wrappers containing only a link) → CTA
      if (child.tagName === 'A') {
        child.classList.add('button');
        ctaContainer.append(child);
        lastCta = child;
        return;
      }

      // A <p> wrapping only an <a> is a CTA (EDS button pattern)
      const innerLink = child.querySelector(':scope > a');
      if (innerLink && child.children.length === 1 && child.tagName === 'P') {
        innerLink.classList.add('button');
        ctaContainer.append(innerLink);
        lastCta = innerLink;
        return;
      }

      // If we just processed a CTA and this element is a style value, apply it
      const text = child.textContent.trim().toLowerCase();
      if (lastCta && ctaStyles.includes(text)) {
        lastCta.classList.add(text);
        lastCta = null;
        return;
      }
      lastCta = null;

      // First text element becomes the title
      if (!titleFound && child.textContent.trim()) {
        titleFound = true;
        const h2 = document.createElement('h2');
        h2.textContent = child.textContent.trim();
        moveInstrumentation(child, h2);
        textContainer.append(h2);
        return;
      }

      // Everything else is description content
      textContainer.append(child);
    });

    if (textContainer.children.length) contentContainer.append(textContainer);
    if (ctaContainer.children.length) contentContainer.append(ctaContainer);
  }

  block.replaceChildren(imageContainer, contentContainer);
}
