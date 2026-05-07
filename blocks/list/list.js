import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Decorates the list block.
 * @param {Element} block the block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    ul.append(li);
  });
  block.replaceChildren(ul);
}
