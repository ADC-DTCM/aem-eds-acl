import { readBlockConfig } from '../../scripts/aem.js';

/**
 * Resolves manual image URL from block table config (Universal Editor / Franklin)
 * or data-image-url on the block wrapper.
 * @param {Record<string, string>} config
 * @param {DOMStringMap} dataset
 * @returns {string}
 */
function resolveManualImageUrl(config, dataset) {
  const fromDataset = dataset.imageUrl?.trim();
  if (fromDataset) return fromDataset;

  const keys = ['imageUrl', 'image-url', 'imageurl'];
  const hit = keys.map((k) => config[k]).find((v) => typeof v === 'string' && v.trim());
  return hit ? hit.trim() : '';
}

/**
 * When set, replaces the rendered image src with the manual URL (external or absolute).
 * DAM-optimized <source> elements are removed so the browser loads the given URL.
 * @param {Element} block
 * @param {string} rawUrl
 */
function applyManualImageUrl(block, rawUrl) {
  let href;
  try {
    const u = new URL(rawUrl, window.location.href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    href = u.href;
  } catch {
    return;
  }

  const img = block.querySelector('img');
  if (!img) return;

  const picture = block.querySelector('picture');
  if (picture) {
    picture.querySelectorAll('source').forEach((s) => s.remove());
  }

  img.src = href;
  img.removeAttribute('srcset');
}

export default function decorate(block) {
  const config = readBlockConfig(block);
  const manualUrl = resolveManualImageUrl(config, block.dataset);
  if (manualUrl) {
    applyManualImageUrl(block, manualUrl);
  }
}
