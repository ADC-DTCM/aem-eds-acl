const DEFAULT_IMAGE = '/adobe/dynamicmedia/deliver/dm-aid--ce6825e2-e556-4c63-95fd-07d377db730b/peak-performance.png';

export default function decorate(block) {
  const rows = [...block.children];

  // Extract image from first cell (picture element)
  let picture = block.querySelector('picture');
  if (!picture) {
    picture = document.createElement('picture');
    const img = document.createElement('img');
    img.src = DEFAULT_IMAGE;
    img.alt = '';
    img.loading = 'lazy';
    picture.append(img);
  }

  // Extract text content: first heading becomes h3 title, rest is description
  const textContent = [];
  rows.forEach((row) => {
    [...row.children].forEach((cell) => {
      if (!cell.querySelector('picture')) {
        textContent.push(...cell.children);
      }
    });
  });

  // Separate title (first heading) from description and CTAs
  let title = null;
  const description = [];
  const ctas = [];

  [...textContent].forEach((el) => {
    if (!title && el.matches && el.matches('h1, h2, h3, h4, h5, h6')) {
      title = el;
    } else if (el.matches && el.matches('p') && el.querySelector('a')) {
      // Paragraphs containing links are CTAs
      const links = el.querySelectorAll('a');
      links.forEach((link) => ctas.push(link));
    } else if (el.matches) {
      description.push(el);
    }
  });

  // Ensure title is rendered as h3
  if (title && title.tagName !== 'H3') {
    const h3 = document.createElement('h3');
    h3.innerHTML = title.innerHTML;
    title = h3;
  }

  // Build image container
  const imageContainer = document.createElement('div');
  imageContainer.className = 'teaserv2-image';
  imageContainer.append(picture);

  // Build content container
  const contentContainer = document.createElement('div');
  contentContainer.className = 'teaserv2-content';

  if (title) contentContainer.append(title);
  description.forEach((el) => contentContainer.append(el));

  // Build CTA container - only render CTAs that have text
  const ctaContainer = document.createElement('div');
  ctaContainer.className = 'teaserv2-ctas';
  let hasVisibleCtas = false;

  ctas.forEach((link) => {
    const text = link.textContent.trim();
    if (text) {
      link.classList.add('button');
      hasVisibleCtas = true;
      ctaContainer.append(link);
    }
  });

  if (hasVisibleCtas) contentContainer.append(ctaContainer);

  block.replaceChildren(imageContainer, contentContainer);
}
