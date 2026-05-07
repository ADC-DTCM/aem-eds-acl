/*
 * Breadcrumbs Block
 * Renders a breadcrumb trail based on the current page URL path.
 * Each path segment links to its corresponding page.
 */

export default async function decorate(block) {
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Breadcrumb');

  const ol = document.createElement('ol');

  // Build segments from the current pathname
  const { pathname } = window.location;
  const segments = pathname.split('/').filter(Boolean);

  // Home crumb
  const homeLi = document.createElement('li');
  const homeLink = document.createElement('a');
  homeLink.href = '/';
  homeLink.textContent = 'Home';
  homeLi.append(homeLink);
  ol.append(homeLi);

  // Intermediate + current crumbs
  segments.forEach((segment, i) => {
    const href = `/${segments.slice(0, i + 1).join('/')}`;
    const isLast = i === segments.length - 1;

    // Humanise the slug: replace hyphens with spaces, title-case
    const label = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const li = document.createElement('li');

    if (isLast) {
      // Current page — no link, mark as current
      const span = document.createElement('span');
      span.setAttribute('aria-current', 'page');
      span.textContent = label;
      li.append(span);
    } else {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      li.append(link);
    }

    ol.append(li);
  });

  nav.append(ol);
  block.textContent = '';
  block.append(nav);
}
