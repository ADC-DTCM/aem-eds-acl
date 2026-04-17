import { createOptimizedPicture } from '../../scripts/aem.js';

let indexData;

async function fetchIndex() {
  if (indexData) return indexData;
  const resp = await fetch('/query-index.json');
  if (!resp.ok) return [];
  const json = await resp.json();
  indexData = json.data || [];
  return indexData;
}

async function fetchPageMetadata(path) {
  const resp = await fetch(path);
  if (!resp.ok) return null;
  const html = await resp.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return {
    path,
    title: doc.querySelector('title')?.textContent || '',
    description: doc.querySelector('meta[name="description"]')?.content || '',
    image: doc.querySelector('meta[property="og:image"]')?.content || '',
  };
}

async function getPageMetadata(path) {
  const index = await fetchIndex();
  const entry = index.find((e) => e.path === path);
  if (entry?.title) return entry;
  return fetchPageMetadata(path);
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
  let titleText = '';
  const allLinks = [];

  // scan all cells for title text and links
  block.querySelectorAll(':scope > div > div').forEach((cell) => {
    const a = cell.querySelector('a');
    if (a) {
      allLinks.push(a);
    } else {
      const text = cell.textContent.trim();
      if (text && !titleText) titleText = text;
    }
  });

  // fallback: scan rows directly
  if (!allLinks.length) {
    [...block.children].forEach((row) => {
      const a = row.querySelector('a');
      if (a) {
        allLinks.push(a);
      } else {
        const text = row.textContent.trim();
        if (text && !titleText) titleText = text;
      }
    });
  }

  // last link = more, rest = page cards
  const moreLink = allLinks.length > 1 ? allLinks.pop() : null;
  const pageLinks = allLinks;

  const paths = pageLinks.map((a) => new URL(a.href).pathname);
  const metadataList = await Promise.all(paths.map((p) => getPageMetadata(p)));

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
