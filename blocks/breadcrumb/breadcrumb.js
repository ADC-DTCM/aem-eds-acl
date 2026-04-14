export default function decorate(block) {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);

  // don't show breadcrumb on homepage
  if (!segments.length) {
    block.textContent = '';
    return;
  }

  const nav = document.createElement('nav');
  nav.classList.add('breadcrumb-nav');
  nav.setAttribute('aria-label', 'Breadcrumb');

  const ol = document.createElement('ol');
  ol.classList.add('breadcrumb-list');

  // Home link
  const homeLi = document.createElement('li');
  homeLi.classList.add('breadcrumb-item');
  const homeLink = document.createElement('a');
  homeLink.href = '/';
  homeLink.textContent = 'Home';
  homeLi.append(homeLink);
  ol.append(homeLi);

  // Build breadcrumb from URL segments
  let href = '';
  segments.forEach((segment, index) => {
    href += `/${segment}`;
    const li = document.createElement('li');
    li.classList.add('breadcrumb-item');

    const label = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    if (index === segments.length - 1) {
      // last item = current page, no link
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
