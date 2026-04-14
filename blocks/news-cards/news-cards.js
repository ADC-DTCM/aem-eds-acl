import { createOptimizedPicture } from '../../scripts/aem.js';

async function fetchPageMetadata(path) {
  const resp = await fetch(path);
  if (!resp.ok) return null;
  const html = await resp.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const title = doc.querySelector('title')?.textContent || '';
  const description = doc.querySelector('meta[name="description"]')?.content || '';
  const image = doc.querySelector('meta[property="og:image"]')?.content || '';

  return {
    title,
    description,
    image,
    path,
  };
}

function buildCard(meta) {
  const li = document.createElement('li');

  const card = document.createElement('a');
  card.href = meta.path;
  card.className = 'news-cards-card-link';

  if (meta.image) {
    const imageDiv = document.createElement('div');
    imageDiv.className = 'news-cards-card-image';
    const pic = createOptimizedPicture(meta.image, meta.title, false, [{ width: '750' }]);
    imageDiv.append(pic);
    card.append(imageDiv);
  }

  const body = document.createElement('div');
  body.className = 'news-cards-card-body';

  const h3 = document.createElement('h3');
  h3.textContent = meta.title;
  body.append(h3);

  if (meta.description) {
    const p = document.createElement('p');
    p.textContent = meta.description;
    body.append(p);
  }

  card.append(body);
  li.append(card);
  return li;
}

export default async function decorate(block) {
  const rows = [...block.children];
  const titleRow = rows.shift();
  const titleText = titleRow?.textContent?.trim();

  const links = [...block.querySelectorAll('a')];
  const paths = links.map((a) => new URL(a.href).pathname);

  const metadataList = await Promise.all(paths.map((p) => fetchPageMetadata(p)));

  const wrapper = document.createDocumentFragment();

  if (titleText) {
    const heading = document.createElement('h2');
    heading.className = 'news-cards-title';
    heading.textContent = titleText;
    wrapper.append(heading);
  }

  const ul = document.createElement('ul');
  metadataList.forEach((meta) => {
    if (meta) {
      ul.append(buildCard(meta));
    }
  });

  wrapper.append(ul);
  block.replaceChildren(wrapper);
}
