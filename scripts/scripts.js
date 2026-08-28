import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

const BUTTON_VARIANTS = [
  'primary',
  'secondary',
  'outline',
  'ghost',
  'ghost-inverted',
  'destructive',
  'link',
];

const BUTTON_MODIFIERS = [
  'round',
  'new-tab',
  'icon-left',
  'icon-right',
  'disabled',
];

const MODIFIER_TEXT_VALUES = new Set(['round', 'rounded', 'new-tab', 'disabled']);

const RESERVED_ICON_CLASSES = new Set(['icon-left', 'icon-right', 'icon-only']);

/** Longest labels first so "Ghost Inverted" wins over "Ghost". */
const VARIANT_LABELS = [
  ['ghost inverted', 'ghost-inverted'],
  ['ghost-inverted', 'ghost-inverted'],
  ['destructive', 'destructive'],
  ['secondary', 'secondary'],
  ['outline', 'outline'],
  ['primary', 'primary'],
  ['ghost', 'ghost'],
  ['link', 'link'],
];

/**
 * Maps visible link text to a button variant (UE labels without published classes).
 * @param {string} label
 * @returns {string|null}
 */
function getVariantFromLabel(label) {
  const normalized = label.toLowerCase().trim();
  const match = VARIANT_LABELS.find(([text]) => text === normalized);
  return match ? match[1] : null;
}

/**
 * Turns `:iconname:` tokens in a button into `span.icon` (DA and UE text).
 * @param {Element} root
 */
function materializeIconTokens(root) {
  const tokenRe = /:([a-z0-9-]+):/gi;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    tokenRe.lastIndex = 0;
    if (tokenRe.test(node.textContent)) textNodes.push(node);
    node = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const frag = document.createDocumentFragment();
    const parts = textNode.textContent.split(/:([a-z0-9-]+):/gi);
    parts.forEach((part, index) => {
      if (!part) return;
      if (index % 2 === 1) {
        const icon = document.createElement('span');
        icon.className = `icon icon-${part}`;
        frag.append(icon);
      } else {
        frag.append(document.createTextNode(part));
      }
    });
    textNode.replaceWith(frag);
  });
}

/**
 * Icon name from a dedicated Icon field that published as data-icon or icon-* class.
 * @param {HTMLAnchorElement} a
 * @returns {string}
 */
function getAuthoredIconName(a) {
  const fromData = a.getAttribute('data-icon') || a.dataset.icon;
  if (fromData) return fromData.replace(/^icon-/, '').trim();

  const fromClass = [...a.classList].find((cls) => (
    cls.startsWith('icon-') && !RESERVED_ICON_CLASSES.has(cls)
  ));
  return fromClass ? fromClass.slice(5) : '';
}

/**
 * Ensures authored icons exist as `span.icon` inside the button.
 * @param {HTMLAnchorElement} a
 * @param {HTMLParagraphElement} p
 */
function ensureButtonIcons(a, p) {
  materializeIconTokens(a);

  p.querySelectorAll(':scope > .icon').forEach((icon) => {
    if (!a.contains(icon)) a.append(icon);
  });

  if (!a.querySelector('.icon')) {
    const name = getAuthoredIconName(a);
    if (name) {
      const icon = document.createElement('span');
      icon.className = `icon icon-${name}`;
      a.prepend(icon);
    }
  }

  decorateIcons(a);
}

/**
 * Visible text of a node, ignoring icons and images.
 * @param {Element} el
 * @returns {string}
 */
function getButtonLabel(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.icon, img').forEach((node) => node.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

function getButtonUeContainer(a) {
  return a.closest('[data-aue-model="button"]') || a.closest('.button-wrapper') || a.closest('p');
}

/**
 * True when the link is a UE Button (instrumentation or Franklin button resource).
 * @param {HTMLAnchorElement} a
 * @returns {boolean}
 */
function isUeButtonLink(a) {
  if (a.hasAttribute('data-aue-resource')) return true;
  if (a.closest('[data-aue-model="button"]')) return true;
  return [...a.attributes].some(({ name }) => name.startsWith('data-aue-prop-'));
}

/** Maps model field names to UE data-aue-prop-* suffixes. */
const UE_PROP_ALIASES = {
  linkType: 'linktype',
  openInNewTab: 'open-in-new-tab',
};

function toUePropAttr(name) {
  if (UE_PROP_ALIASES[name]) return UE_PROP_ALIASES[name];
  return name.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Reads a UE property from data attributes (supports camelCase dataset keys).
 * @param {Element} el
 * @param {string} prop
 * @returns {string|null}
 */
function readUeProp(el, prop) {
  const attr = el.getAttribute(`data-aue-prop-${prop}`);
  if (attr != null && attr !== '') return attr;
  const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const fromDataset = el.dataset?.[camel];
  return fromDataset != null && fromDataset !== '' ? fromDataset : null;
}

/**
 * Resolves the button variation from classes or DA formatting (bold/italic).
 * @param {HTMLAnchorElement} a
 * @param {Element|null} strong
 * @param {Element|null} em
 * @returns {string|null}
 */
function getButtonVariant(a, strong, em) {
  const fromClass = BUTTON_VARIANTS.find((variant) => (
    a.classList.contains(variant) || a.classList.contains(`button--${variant}`)
  ));
  if (fromClass) return fromClass;

  const container = getButtonUeContainer(a);
  const linkTypeAttr = readUeProp(a, 'linktype')
    || readUeProp(a, 'link-type')
    || readUeProp(container, 'linktype')
    || readUeProp(container, 'link-type')
    || a.getAttribute('data-linktype')
    || a.dataset?.linkType;
  if (linkTypeAttr && BUTTON_VARIANTS.includes(linkTypeAttr)) return linkTypeAttr;

  const fromTitle = getVariantFromLabel(a.getAttribute('title') || '');
  if (fromTitle) return fromTitle;

  const fromLabel = getVariantFromLabel(getButtonLabel(a));
  if (fromLabel) return fromLabel;
  if (a.classList.contains('accent')) return 'primary';
  if (strong && em) return 'primary';
  if (strong) return 'primary';
  if (em) return 'secondary';
  // UE buttons default to primary; Options (e.g. round) must not drop the variant.
  if (a.classList.contains('button')) return 'primary';
  return null;
}

/**
 * Adds modifier tokens from a classes/shape value (string, CSV, or JSON array).
 * @param {unknown} raw
 * @param {Set<string>} found
 */
function ingestModifierValue(raw, found) {
  if (raw == null || raw === '') return;
  let tokens = [];
  if (Array.isArray(raw)) {
    tokens = raw;
  } else {
    const str = String(raw).trim();
    if (str.startsWith('[')) {
      try {
        tokens = JSON.parse(str);
      } catch {
        tokens = str.split(/[\s,]+/);
      }
    } else {
      tokens = str.split(/[\s,]+/);
    }
  }
  tokens.forEach((cls) => {
    const normalized = String(cls).trim().toLowerCase();
    if (normalized === 'rounded') found.add('round');
    else if (BUTTON_MODIFIERS.includes(normalized)) found.add(normalized);
  });
}

/** UE property names that affect button decoration in the live canvas. */
export const BUTTON_PATCH_PROPS = new Set([
  'classes',
  'classes_shape',
  'classes-shape',
  'linkType',
  'disabled',
  'openInNewTab',
  'link',
  'linkText',
  'linkTitle',
  'icon',
  'iconPosition',
]);

/**
 * Normalizes a UE patch payload from content-patch / content-update events.
 * @param {CustomEvent['detail']} detail
 * @returns {{ name: string, value: unknown }|null}
 */
export function getButtonPatchFromEvent(detail) {
  if (detail?.patch?.name) return detail.patch;
  const target = detail?.request?.target;
  const name = target?.prop ?? target?.property;
  if (!name) return null;
  const value = detail?.request?.value ?? target?.value ?? detail?.request?.body?.value;
  return { name, value };
}

/**
 * Finds the single button container for a patched UE resource node.
 * Never returns sibling buttons from a shared parent.
 * @param {Element|null} root
 * @returns {Element[]}
 */
function findButtonContainers(root) {
  if (!root?.matches) return [];
  if (root.matches('[data-aue-model="button"]')) return [root];
  const owned = root.closest('[data-aue-model="button"]');
  if (owned) return [owned];
  if (root.matches('p') && root.querySelector('a[href]')) return [root];
  const link = root.matches('a[href]') ? root : null;
  if (link) {
    const p = link.closest('p');
    return p ? [p] : [];
  }
  return [];
}

/**
 * Serializes a UE patch value for data-aue-prop-* attributes.
 * @param {unknown} raw
 * @returns {string|null}
 */
function serializePatchValue(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'boolean') return raw ? 'true' : 'false';
  if (Array.isArray(raw)) {
    const joined = raw.filter(Boolean).join(' ').trim();
    return joined || null;
  }
  return String(raw);
}

/**
 * Applies classes/disabled/new-tab from a patch directly on the anchor for instant preview.
 * @param {HTMLAnchorElement|null} anchor
 * @param {string} prop
 * @param {unknown} rawValue
 */
function syncAnchorFromPatch(anchor, prop, rawValue) {
  if (!anchor) return;
  const kebab = toUePropAttr(prop);

  if (kebab === 'classes' || kebab.startsWith('classes-')) {
    const found = new Set();
    ingestModifierValue(rawValue, found);
    if (found.has('round')) anchor.classList.add('round');
    else anchor.classList.remove('round', 'button--round');
  }

  if (kebab === 'linktype') {
    BUTTON_VARIANTS.forEach((variant) => {
      anchor.classList.remove(variant, `button--${variant}`);
    });
    const next = String(rawValue || '').trim();
    if (next && BUTTON_VARIANTS.includes(next)) {
      anchor.classList.add(next, `button--${next}`);
    }
  }

  if (kebab === 'disabled') {
    const on = rawValue === true || rawValue === 'true';
    if (on) anchor.classList.add('disabled', 'button--disabled');
    else anchor.classList.remove('disabled', 'button--disabled');
  }

  if (kebab === 'open-in-new-tab') {
    const on = rawValue === true || rawValue === 'true';
    if (on) {
      anchor.classList.add('new-tab', 'button--new-tab');
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    } else {
      anchor.classList.remove('new-tab', 'button--new-tab');
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
    }
  }
}

/**
 * Applies a UE property-panel patch to button containers before decoration.
 * @param {Element} root
 * @param {{ name?: string, value?: unknown }} patch
 */
export function applyButtonPatchFromUe(root, patch) {
  if (!root?.querySelector && !root?.matches) return;
  if (!patch?.name) return;
  const prop = toUePropAttr(patch.name);
  const targets = findButtonContainers(root);
  if (!targets.length) return;

  const value = serializePatchValue(patch.value);
  const isEmpty = value == null;

  targets.forEach((button) => {
    const anchor = button.querySelector?.('a[href]') || (button.matches?.('a[href]') ? button : null);
    if (isEmpty) {
      button.removeAttribute(`data-aue-prop-${prop}`);
      anchor?.removeAttribute(`data-aue-prop-${prop}`);
    } else {
      button.setAttribute(`data-aue-prop-${prop}`, value);
      anchor?.setAttribute(`data-aue-prop-${prop}`, value);
    }
    syncAnchorFromPatch(anchor, patch.name, patch.value);
    // Other fields (e.g. disabled) must not drop Shape already stored on this button.
    if (patch.name !== 'classes') {
      const classes = readUeProp(button, 'classes') || readUeProp(anchor, 'classes');
      if (classes) syncAnchorFromPatch(anchor, 'classes', classes);
    }
  });
}

/**
 * Copies button UE props from a replaced node so Shape/Variation survive partial patches.
 * @param {Element} from
 * @param {Element} to
 */
export function mergeButtonUeState(from, to) {
  if (!from?.attributes || !to?.attributes) return;

  const fromContainer = findButtonContainers(from)[0] || from;
  const toContainer = findButtonContainers(to)[0] || to;
  if (!fromContainer || !toContainer) return;

  const copyProps = (source, target) => {
    [...source.attributes].forEach(({ name, value }) => {
      if (name.startsWith('data-aue-prop-') && !target.hasAttribute(name)) {
        target.setAttribute(name, value);
      }
    });
  };

  copyProps(fromContainer, toContainer);
  copyProps(from, toContainer);

  const fromAnchor = fromContainer.querySelector?.('a[href]')
    || (fromContainer.matches?.('a[href]') ? fromContainer : null);
  const toAnchor = toContainer.querySelector?.('a[href]')
    || (toContainer.matches?.('a[href]') ? toContainer : null);

  if (fromAnchor && toAnchor) {
    copyProps(fromAnchor, toAnchor);
    const classes = readUeProp(toContainer, 'classes')
      || readUeProp(fromContainer, 'classes')
      || readUeProp(fromAnchor, 'classes');
    if (classes?.includes('round') && !toAnchor.classList.contains('round')) {
      toAnchor.classList.add('round');
    }
  }
}

/**
 * Adds modifier hits from classes or UE grouped `classes_*` fields.
 * @param {Element|null} el
 * @param {Set<string>} found
 */
function collectButtonModifiers(el, found) {
  if (!el?.classList) return;
  BUTTON_MODIFIERS.forEach((mod) => {
    if (el.classList.contains(mod) || el.classList.contains(`button--${mod}`)) {
      found.add(mod);
    }
  });

  // Shape / Options from UE (`classes` multiselect, booleans, or patch props).
  ingestModifierValue(readUeProp(el, 'classes'), found);

  [...el.attributes].forEach(({ name, value }) => {
    if (name.startsWith('data-aue-prop-') && name.includes('classes')) {
      ingestModifierValue(value, found);
    }
  });

  if (readUeProp(el, 'classes-shape') === 'round' || readUeProp(el, 'classes_shape') === 'round') {
    found.add('round');
  }

  // Legacy grouped booleans (classes_disabled, classes_new-tab).
  if (readUeProp(el, 'classes-disabled') === 'true' || readUeProp(el, 'classes_disabled') === 'true') {
    found.add('disabled');
  }
  if (readUeProp(el, 'classes-new-tab') === 'true' || readUeProp(el, 'classes_new-tab') === 'true') {
    found.add('new-tab');
  }

  // Button model booleans (persist in UE and publish as data attributes).
  if (readUeProp(el, 'disabled') === 'true') found.add('disabled');
  if (readUeProp(el, 'open-in-new-tab') === 'true' || readUeProp(el, 'openInNewTab') === 'true') {
    found.add('new-tab');
  }
}

/**
 * UE may publish Shape / checkbox values as plain text beside the link (teaser CTA pattern).
 * @param {HTMLAnchorElement} a
 * @param {HTMLParagraphElement} p
 * @param {Set<string>} found
 */
function harvestModifierTextNodes(a, p, found) {
  if (!p) return;

  const absorb = (el) => {
    if (!el || el === a || el.contains(a)) return;
    const text = el.textContent?.trim().toLowerCase();
    if (!text || !MODIFIER_TEXT_VALUES.has(text)) return;
    found.add(text);
    el.remove();
  };

  [...p.childNodes].forEach((node) => {
    if (node === a) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim().toLowerCase();
      if (text === 'rounded') {
        found.add('round');
        node.remove();
      } else if (text && MODIFIER_TEXT_VALUES.has(text)) {
        found.add(text);
        node.remove();
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) absorb(node);
  });

  const next = p.nextElementSibling;
  if (next?.matches('p') && !next.querySelector('a[href]')) absorb(next);
}

/**
 * Collects modifier class names from the link, paragraph, and nearby wrappers.
 * @param {HTMLAnchorElement} a
 * @param {HTMLParagraphElement} p
 * @returns {string[]}
 */
function getButtonModifiers(a, p) {
  const found = new Set();
  collectButtonModifiers(a, found);
  collectButtonModifiers(p, found);
  const ueContainer = getButtonUeContainer(a);
  if (ueContainer && ueContainer !== a && ueContainer !== p) {
    collectButtonModifiers(ueContainer, found);
  }
  harvestModifierTextNodes(a, p, found);
  return BUTTON_MODIFIERS.filter((mod) => found.has(mod));
}

/**
 * Applies BEM aliases, icon placement, new-tab, and disabled behavior.
 * Safe to re-run on already-published Franklin/UE buttons
 * (`class="button primary round"`).
 * @param {HTMLAnchorElement} a
 * @param {HTMLParagraphElement} p
 * @param {object} [precomputed]
 * @param {string|null} [precomputed.variant]
 * @param {string[]} [precomputed.modifiers]
 */
function applyButtonChrome(a, p, precomputed = {}) {
  const variant = precomputed.variant ?? getButtonVariant(a, null, null);
  const modifiers = precomputed.modifiers ?? getButtonModifiers(a, p);

  BUTTON_MODIFIERS.forEach((mod) => {
    a.classList.remove(mod, `button--${mod}`);
  });
  if (!modifiers.includes('new-tab')) {
    a.removeAttribute('target');
    a.removeAttribute('rel');
  }
  if (!modifiers.includes('disabled')) {
    delete a.dataset.buttonDisabled;
    a.removeAttribute('aria-disabled');
    a.removeAttribute('tabindex');
  }

  if (variant) {
    BUTTON_VARIANTS.forEach((v) => a.classList.remove(v, `button--${v}`));
    a.classList.add(variant, `button--${variant}`);
  }
  modifiers.forEach((mod) => {
    a.classList.add(mod, `button--${mod}`);
  });

  if (variant !== 'link') ensureButtonIcons(a, p);

  const label = getButtonLabel(a);
  let icons = [...a.querySelectorAll(':scope > .icon, :scope .icon')];

  if (variant === 'link') {
    icons.forEach((icon) => icon.remove());
    icons = [];
    a.classList.remove('icon-only', 'button--icon-only', 'icon-left', 'button--icon-left', 'icon-right', 'button--icon-right');
  }

  if (label) a.title = a.title || label;

  if (!label && icons.length) {
    a.classList.add('icon-only', 'button--icon-only');
    if (!a.getAttribute('aria-label')) {
      a.setAttribute('aria-label', a.title || 'Button');
    }
  }

  if (modifiers.includes('new-tab')) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }

  if (modifiers.includes('disabled') && a.dataset.buttonDisabled !== 'true') {
    a.dataset.buttonDisabled = 'true';
    a.setAttribute('aria-disabled', 'true');
    a.setAttribute('tabindex', '-1');
    a.addEventListener('click', (event) => event.preventDefault());
  }

  if (icons.length) {
    if (modifiers.includes('icon-right')) {
      icons.forEach((icon) => a.append(icon));
    } else {
      [...icons].reverse().forEach((icon) => a.prepend(icon));
    }
  }
}

/** Props stored on instrumented button nodes that must be applied before decoration. */
const BUTTON_STORED_PROPS = [
  ['classes', 'classes'],
  ['linktype', 'linkType'],
  ['disabled', 'disabled'],
  ['open-in-new-tab', 'openInNewTab'],
];

/**
 * Applies persisted UE props from data-aue-prop-* onto the button anchor.
 * @param {Element} container
 * @param {HTMLAnchorElement} anchor
 */
function applyStoredButtonProps(container, anchor) {
  BUTTON_STORED_PROPS.forEach(([prop, patchName]) => {
    const value = readUeProp(container, prop) || readUeProp(anchor, prop);
    if (value == null || value === '') return;
    if (prop === 'disabled' || prop === 'open-in-new-tab') {
      syncAnchorFromPatch(anchor, patchName, value === 'true');
      return;
    }
    syncAnchorFromPatch(anchor, patchName, value);
  });
}

/**
 * Syncs persisted UE props onto anchors before decoration (author reload).
 * @param {HTMLElement} main
 */
function primeButtonProps(main) {
  main.querySelectorAll('[data-aue-model="button"]').forEach((container) => {
    const anchor = container.querySelector('a[href]');
    if (anchor) applyStoredButtonProps(container, anchor);
  });

  main.querySelectorAll('[data-aue-prop-classes], [data-aue-prop-linktype], [data-aue-prop-disabled], [data-aue-prop-open-in-new-tab]').forEach((el) => {
    const container = findButtonContainers(el)[0];
    if (!container) return;
    const anchor = container.querySelector('a[href]') || (el.matches('a[href]') ? el : null);
    if (anchor) applyStoredButtonProps(container, anchor);
  });
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
export function decorateButtons(main) {
  primeButtonProps(main);

  main.querySelectorAll('p a[href]').forEach((a) => {
    const p = a.closest('p');
    if (!p) return;

    // Published / UE buttons already have .button; still map Options classes.
    if (a.classList.contains('button')) {
      applyButtonChrome(a, p);
      return;
    }

    const hasNonIconImage = [...a.querySelectorAll('img')]
      .some((img) => !img.closest('.icon'));
    if (hasNonIconImage) return;

    const ueButton = isUeButtonLink(a);
    if (ueButton) {
      const container = a.closest('[data-aue-model="button"]') || p;
      applyStoredButtonProps(container, a);
      harvestModifierTextNodes(a, p, new Set());
    }

    const label = getButtonLabel(a);
    if (!ueButton && getButtonLabel(p) !== label) return;

    const strong = a.closest('strong');
    const em = a.closest('em');
    const icons = [...a.querySelectorAll(':scope > .icon, :scope .icon')];
    const variant = getButtonVariant(a, strong, em);

    // Icon-only links still become buttons; plain text links stay default links
    if (!variant && !icons.length) return;
    const resolvedVariant = variant || 'primary';

    try {
      if (label && new URL(a.href).href === new URL(label, window.location).href) return;
    } catch { /* continue */ }

    const modifiers = getButtonModifiers(a, p);

    p.classList.add('button-wrapper');
    a.classList.add('button');
    applyButtonChrome(a, p, {
      variant: resolvedVariant,
      modifiers,
    });

    if (strong && em) {
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      strong.replaceWith(a);
    } else if (em) {
      em.replaceWith(a);
    }
  });
}

/**
 * Re-decorates buttons after UE adds data-aue-prop-* on load or reload.
 * @param {Document|Element} [root]
 */
export function applyButtonInstrumentation(root = document) {
  const main = root.querySelector?.('main') || (root.matches?.('main') ? root : null);
  if (!main) return;

  main.querySelectorAll('[data-aue-model="button"]').forEach((container) => {
    const anchor = container.querySelector('a[href]');
    if (anchor) applyStoredButtonProps(container, anchor);
  });

  main.querySelectorAll('[data-aue-prop-classes], [data-aue-prop-linktype], [data-aue-prop-disabled], [data-aue-prop-open-in-new-tab]').forEach((el) => {
    const container = findButtonContainers(el)[0];
    if (!container) return;
    const anchor = container.querySelector('a[href]') || (el.matches('a[href]') ? el : null);
    if (anchor) applyStoredButtonProps(container, anchor);
  });

  decorateButtons(main);
}

/**
 * Applies a live UE patch to the in-canvas button and redecorates nearby content.
 * @param {CustomEvent} event
 * @returns {boolean}
 */
export function applyButtonLivePatch(event) {
  const patch = getButtonPatchFromEvent(event?.detail);
  if (!patch?.name || !BUTTON_PATCH_PROPS.has(patch.name)) return false;

  const resource = event.detail?.request?.target?.resource;
  if (!resource) return false;

  const element = document.querySelector(`[data-aue-resource="${resource}"]`);
  if (!element) return false;

  applyButtonPatchFromUe(element, patch);
  const scope = element.closest('.section') || element.closest('main') || element.parentElement;
  if (scope) decorateButtons(scope);
  return true;
}

/**
 * Re-runs decoration when UE writes data-aue-prop-* after initial page load.
 */
function watchButtonInstrumentation() {
  let scheduled = false;
  const rerun = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const main = document.querySelector('main');
      if (main) applyButtonInstrumentation(main);
    });
  };

  new MutationObserver(rerun).observe(document, {
    attributeFilter: [
      'data-aue-prop-classes',
      'data-aue-prop-linktype',
      'data-aue-prop-disabled',
      'data-aue-prop-open-in-new-tab',
      'data-aue-model',
      'data-aue-resource',
    ],
    subtree: true,
  });

  [100, 500, 1500, 3000, 5000, 8000].forEach((ms) => {
    window.setTimeout(rerun, ms);
  });

  window.addEventListener('load', rerun, { once: true });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  watchButtonInstrumentation();
  await loadLazy(document);
  loadDelayed();
}

loadPage();
