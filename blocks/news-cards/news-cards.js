import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row, index) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    if (index === 0) li.classList.add('news-cards-featured');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'news-cards-card-image';
      } else {
        div.className = 'news-cards-card-body';
      }
    });

    // wrap entire card in a link if there's an anchor in the body
    const link = li.querySelector('.news-cards-card-body a');
    if (link) {
      const cardLink = document.createElement('a');
      cardLink.href = link.href;
      cardLink.className = 'news-cards-card-link';
      cardLink.append(...li.childNodes);
      li.append(cardLink);
    }

    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });

  block.replaceChildren(ul);
}
