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
  // collect all links and title text from the block
  const allLinks = [...block.querySelectorAll('a')];
  let titleText = '';

  // find title: first div/cell that has no link
  block.querySelectorAll(':scope > div > div').forEach((cell) => {
    if (!cell.querySelector('a') && cell.textContent.trim() && !titleText) {
      titleText = cell.textContent.trim();
    }
  });

  // if no cells found, try direct children
  if (!titleText) {
    [...block.children].forEach((row) => {
      if (!row.querySelector('a') && row.textContent.trim() && !titleText) {
        titleText = row.textContent.trim();
      }
    });
  }

  // first 4 links = pages, 5th = more link
  const pageLinks = allLinks.slice(0, 4);
  const moreLink = allLinks.length > 4 ? allLinks[4] : null;

  const paths = pageLinks.map((a) => new URL(a.href).pathname);
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

  if (moreLink) {
    const moreContainer = document.createElement('div');
    moreContainer.className = 'news-cards-more';
    const btn = document.createElement('a');
    btn.href = moreLink.href;
    btn.className = 'button primary';
    btn.textContent = 'More';
    moreContainer.append(btn);
    wrapper.append(moreContainer);
  }

  block.replaceChildren(wrapper);
}
