import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/* doc.govt.nz uses Tailwind's md breakpoint (768px) for the mobile→desktop split */
const isDesktop = window.matchMedia('(min-width: 768px)');

/* Resolve the local logo asset via import.meta.url so it works under any deploy path. */
const LOGO_URL = new URL('./doc-logo.svg', import.meta.url).href;

/*
 * Material Symbols glyphs used by the hamburger.
 * - menu: three horizontal bars
 * - close: clean X
 */
const MENU_ICON_SVG = '<svg class="nav-hamburger-glyph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 18v-2h18v2zm0-5v-2h18v2zm0-5V6h18v2z"/></svg>';
const CLOSE_ICON_SVG = '<svg class="nav-hamburger-glyph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"/></svg>';

/**
 * Finds the primary nav list inside .nav-sections (flexible for updated /nav fragment markup).
 * @param {Element} navSections The .nav-sections container
 * @returns {HTMLUListElement|HTMLOListElement|null}
 */
function resolvePrimaryNavList(navSections) {
  if (!navSections) return null;
  const tries = [
    () => navSections.querySelector(':scope > .default-content-wrapper > ul'),
    () => navSections.querySelector(':scope > .default-content-wrapper > ol'),
    () => navSections.querySelector('.default-content-wrapper > ul'),
    () => navSections.querySelector('.default-content-wrapper > ol'),
    () => navSections.querySelector(':scope > ul'),
    () => navSections.querySelector(':scope > ol'),
    () => navSections.querySelector('ul'),
    () => navSections.querySelector('ol'),
  ];
  for (let i = 0; i < tries.length; i += 1) {
    const list = tries[i]();
    if (list) return list;
  }
  return null;
}

/**
 * @param {Element} sections The .nav-sections element
 * @returns {NodeListOf<Element>|Element[]}
 */
function queryNavTopLevelItems(sections) {
  const root = sections?.querySelector?.('.nav-root-list') || resolvePrimaryNavList(sections);
  if (!root) return [];
  return root.querySelectorAll(':scope > li');
}

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav?.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector(
      '[aria-expanded="true"]',
    );
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      const hb = nav.querySelector('.nav-hamburger button');
      if (hb) hb.focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector(
      '[aria-expanded="true"]',
    );
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused?.classList?.contains('nav-drop');
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The nav sections element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  const value = expanded ? 'true' : 'false';
  queryNavTopLevelItems(sections).forEach((section) => {
    section.setAttribute('aria-expanded', value);
  });
}

/**
 * Toggles the mobile nav drawer, or syncs closed after resize/init.
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {boolean|null} syncFromMedia Resize/init sync flag, or null to toggle (hamburger)
 */
function toggleMenu(nav, navSections, syncFromMedia = null) {
  const wasOpen = nav.getAttribute('aria-expanded') === 'true';
  /* On load/resize, always start with the mobile drawer closed; on hamburger click, toggle. */
  const isOpen = syncFromMedia !== null ? false : !wasOpen;
  /* Pre-toggle state: used only for global nav key/focus listener registration (legacy shape) */
  const expanded = syncFromMedia !== null
    ? !syncFromMedia
    : wasOpen;
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = isOpen && !isDesktop.matches ? 'hidden' : '';
  nav.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  /* Reset subsection panels whenever main menu toggles (mobile opens with nested collapsed) */
  toggleAllNavSections(navSections, false);
  if (button) {
    button.setAttribute(
      'aria-label',
      isOpen ? 'Close navigation' : 'Open navigation',
    );
  }
  // enable nav dropdown keyboard accessibility
  const navDrops = navSections
    ? navSections.querySelectorAll('.nav-drop')
    : [];
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  if (fragment?.firstElementChild) {
    while (fragment.firstElementChild) nav.append(fragment.firstElementChild);
  }

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  /*
   * Nav fragment links often ship as a.button (blue pills in globals).
   * DOC expects plain white text links on green — strip authoring classes.
   */
  nav.querySelectorAll('.nav-sections a, .nav-tools a').forEach((a) => {
    ['button', 'primary', 'secondary', 'black'].forEach((cls) => a.classList.remove(cls));
    const wrap = a.closest('.button-container');
    if (wrap) wrap.classList.remove('button-container');
  });

  /*
   * DOC parity: ensure tools area has a "Log in" link + search input.
   * The /nav fragment ships only an icon-search marker; we wrap it in a real
   * <form role="search"> and prepend a Log in link if not already authored.
   */
  const navTools = nav.querySelector('.nav-tools');
  if (navTools) {
    const toolsWrapper = navTools.querySelector('.default-content-wrapper') || navTools;

    /* Material Symbols `login` glyph (matches doc.govt.nz) */
    const LOGIN_GLYPH = '<svg class="nav-login-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 21v-2h7V5h-7V3h7q.825 0 1.413.588T21 5v14q0 .825-.587 1.413T19 21zm-2-4l-1.375-1.45l2.55-2.55H3v-2h8.175l-2.55-2.55L10 7l5 5z"/></svg>';
    const decorateLogin = (a) => {
      a.classList.add('nav-login');
      a.setAttribute('title', 'Log in');
      const labelText = (a.textContent || 'Log in').trim() || 'Log in';
      a.innerHTML = `${LOGIN_GLYPH}<span class="nav-login-label">${labelText}</span>`;
    };
    const existingLogin = toolsWrapper.querySelector('a.nav-login, a[href*="login" i]');
    if (!existingLogin) {
      const loginLink = document.createElement('a');
      loginLink.href = '/login';
      loginLink.textContent = 'Log in';
      toolsWrapper.prepend(loginLink);
      decorateLogin(loginLink);
    } else {
      toolsWrapper
        .querySelectorAll('a.nav-login, a[href*="login" i]')
        .forEach(decorateLogin);
    }

    const searchIcon = toolsWrapper.querySelector('.icon-search');
    if (!toolsWrapper.querySelector('.nav-search')) {
      const form = document.createElement('form');
      form.className = 'nav-search';
      form.setAttribute('role', 'search');
      form.action = '/search';
      form.innerHTML = `
        <input name="q" type="search" placeholder="Search..." aria-label="Search" autocomplete="off" />
        <button type="submit" aria-label="Search">
          <span class="nav-search-icon" aria-hidden="true"></span>
        </button>`;
      toolsWrapper.append(form);
      /* /nav fragment wraps the icon in <p>; drop that empty wrapper */
      if (searchIcon) {
        const pWrapper = searchIcon.closest('p');
        (pWrapper || searchIcon).remove();
      }
    }
  }

  const navBrand = nav.querySelector('.nav-brand');
  if (navBrand) {
    const brandLink = navBrand.querySelector('.button');
    if (brandLink) {
      brandLink.className = '';
      const bc = brandLink.closest('.button-container');
      if (bc) bc.className = '';
    }
    /*
     * The /nav fragment ships the brand image as `<img src="about:error">` when no
     * logo asset is configured. Detect that case (or any failed load) and swap to
     * the bundled DOC wordmark so the green band is never empty.
     */
    const brandImg = navBrand.querySelector('img');
    const swapToFallback = () => {
      const fallback = document.createElement('img');
      fallback.src = LOGO_URL;
      fallback.alt = 'Department of Conservation | Te Papa Atawhai';
      fallback.className = 'nav-logo-fallback';
      fallback.loading = 'eager';
      fallback.decoding = 'async';
      if (brandImg && brandImg.parentElement) brandImg.replaceWith(fallback);
      else navBrand.prepend(fallback);
    };
    if (!brandImg) {
      swapToFallback();
    } else if (
      !brandImg.getAttribute('src')
      || brandImg.getAttribute('src') === 'about:error'
    ) {
      swapToFallback();
    } else {
      brandImg.addEventListener('error', swapToFallback, { once: true });
    }
  }

  const navSections = nav.querySelector('.nav-sections');
  const rootList = resolvePrimaryNavList(navSections);
  if (rootList) {
    rootList.classList.add('nav-root-list');
  }

  if (navSections && rootList) {
    rootList.querySelectorAll(':scope > li').forEach((navSection) => {
      const hasSub = navSection.querySelector(':scope > ul, :scope > ol');
      if (hasSub) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', (e) => {
        const sublistRoot = navSection.querySelector(':scope > ul, :scope > ol');
        if (!sublistRoot) return;
        const link = e.target.closest('a');
        if (link && sublistRoot.contains(link)) return;
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute(
            'aria-expanded',
            expanded ? 'false' : 'true',
          );
          return;
        }
        if (!navSection.classList.contains('nav-drop')) return;
        e.preventDefault();
        const nextOpen = navSection.getAttribute('aria-expanded') !== 'true';
        navSections
          .querySelectorAll(':scope .nav-root-list > li.nav-drop')
          .forEach((li) => {
            if (li !== navSection) li.setAttribute('aria-expanded', 'false');
          });
        navSection.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      });
    });
  }

  // hamburger for mobile (uses two Material Symbols glyphs, swapped via aria-expanded)
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon" aria-hidden="true">${MENU_ICON_SVG}${CLOSE_ICON_SVG}</span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  /* Match doc.govt.nz: wordmark left, menu control on the right (LTR) */
  nav.append(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
