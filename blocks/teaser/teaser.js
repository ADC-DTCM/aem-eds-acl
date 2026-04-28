import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const DEFAULT_IMAGE = '/media_1c9306d7674c0b8ee54457c9ac52f817a0d3410ae.png';
const CTA_STYLES = ['primary', 'secondary', 'black'];

function createDiv(className) {
  const div = document.createElement('div');
  div.className = className;
  return div;
}

function buildImage(imageRow) {
  const container = createDiv('teaser-image');
  if (!imageRow) return container;

  moveInstrumentation(imageRow, container);
  const img = imageRow.querySelector('picture img');

  const src = img?.src || `${window.hlx.codeBasePath}${DEFAULT_IMAGE}`;
  const alt = img?.alt || 'Default teaser image';
  const optimized = createOptimizedPicture(src, alt, false, [{ width: '750' }]);

  if (img) moveInstrumentation(img, optimized.querySelector('img'));
  container.append(optimized);
  return container;
}

function extractCta(child) {
  if (child.tagName === 'A') return child;
  if (child.tagName === 'P' && child.children.length === 1) {
    const link = child.querySelector(':scope > a');
    if (link) return link;
  }
  return null;
}

function buildContent(textContentRow) {
  const container = createDiv('teaser-content');
  if (!textContentRow) return container;

  moveInstrumentation(textContentRow, container);
  const innerDiv = textContentRow.querySelector('div') || textContentRow;
  const children = [...innerDiv.querySelectorAll(':scope > *')];

  const textContainer = createDiv('teaser-text');
  const ctaContainer = createDiv('teaser-cta');

  let titleFound = false;
  let lastCta = null;

  children.forEach((child) => {
    const link = extractCta(child);
    if (link) {
      if (link.textContent.trim()) {
        link.classList.add('button');
        ctaContainer.append(link);
        lastCta = link;
      } else {
        lastCta = null;
      }
      return;
    }

    const text = child.textContent.trim();

    if (CTA_STYLES.includes(text.toLowerCase())) {
      if (lastCta) lastCta.classList.add(text.toLowerCase());
      lastCta = null;
      return;
    }
    lastCta = null;

    if (!titleFound && text) {
      titleFound = true;
      const h2 = document.createElement('h2');
      h2.textContent = text;
      moveInstrumentation(child, h2);
      textContainer.append(h2);
      return;
    }

    textContainer.append(child);
  });

  if (textContainer.children.length) container.append(textContainer);
  if (ctaContainer.children.length) container.append(ctaContainer);
  return container;
}

export default function decorate(block) {
  const [imageRow, textContentRow] = [...block.children];
  block.replaceChildren(buildImage(imageRow), buildContent(textContentRow));
}
