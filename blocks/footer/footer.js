import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import feedbackDecorate from '../feedback/feedback.js';

function extractFeedbackContent(footer) {
  const sections = footer.querySelectorAll('.section');
  let feedbackSection = null;
  sections.forEach((section) => {
    const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading && heading.textContent.trim().toLowerCase() === 'feedback') {
      feedbackSection = section;
    }
  });
  if (!feedbackSection) return {};

  const paragraphs = feedbackSection.querySelectorAll('p');
  const texts = Array.from(paragraphs).map((p) => p.textContent.trim());
  feedbackSection.remove();

  const [
    questionText,
    buttonLabels,
    negTitle,
    negLabel,
    submitLabel,
    yesMsg,
    noMsg,
  ] = texts;

  const content = {};
  if (questionText) content.question = questionText;
  if (buttonLabels) {
    const [yesLabel, noLabel] = buttonLabels.split('|').map((l) => l.trim());
    if (yesLabel) content.yesLabel = yesLabel;
    if (noLabel) content.noLabel = noLabel;
  }
  if (negTitle) content.negativeTitle = negTitle;
  if (negLabel) content.negativeLabel = negLabel;
  if (submitLabel) content.submitLabel = submitLabel;
  if (yesMsg) content.yesMessage = yesMsg;
  if (noMsg) content.noMessage = noMsg;
  return content;
}

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

  // extract feedback content from authored footer
  const feedbackContent = extractFeedbackContent(footer);

  // add feedback component before footer content
  const feedbackBlock = document.createElement('div');
  feedbackBlock.classList.add('feedback', 'block');
  feedbackDecorate(feedbackBlock, feedbackContent);
  block.prepend(feedbackBlock);

  block.append(footer);
}
