import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import feedbackDecorate from '../feedback/feedback.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  // add feedback component before footer content
  const feedbackBlock = document.createElement('div');
  feedbackBlock.classList.add('feedback', 'block');
  feedbackDecorate(feedbackBlock);
  block.prepend(feedbackBlock);

  block.append(footer);
}
