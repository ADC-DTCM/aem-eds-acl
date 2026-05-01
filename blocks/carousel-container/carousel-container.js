import { decorateBlock, loadBlock } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Block names that may appear inside a slide (nested blocks).
 * Must match folders under /blocks with a .js module.
 */
const NESTED_BLOCK_CLASSES = new Set([
  'cards',
  'columns',
  'feedback',
  'fragment',
  'image',
  'teaser',
  'carousel-container',
]);

/**
 * Decorate and load nested blocks inside slides
 * (not picked up by the top-level `decorateBlocks` selector).
 * @param {HTMLElement} root
 */
async function decorateNestedBlocksInSlides(root) {
  const pending = [];
  root.querySelectorAll('.carousel-slide div').forEach((div) => {
    const name = div.classList[0];
    if (
      name
      && NESTED_BLOCK_CLASSES.has(name)
      && !div.classList.contains('block')
    ) {
      decorateBlock(div);
      pending.push(loadBlock(div));
    }
  });
  await Promise.all(pending);
}

/**
 * @param {HTMLElement} viewport
 * @param {HTMLElement[]} slides
 * @param {number} index
 * @param {boolean} smooth
 */
function scrollToSlide(viewport, slides, index, smooth) {
  if (!slides.length) return;
  const clamped = Math.max(0, Math.min(slides.length - 1, index));
  const left = slides[clamped].offsetLeft;
  viewport.scrollTo({
    left,
    behavior:
      smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'smooth'
        : 'auto',
  });
}

export default async function decorate(block) {
  const rows = [...block.children];
  const shell = document.createElement('div');
  shell.className = 'carousel-shell';

  const controls = document.createElement('div');
  controls.className = 'carousel-controls';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'carousel-prev';
  prevBtn.setAttribute('aria-label', 'Previous slide');
  prevBtn.innerHTML = '<span aria-hidden="true">&#8249;</span>';

  const viewport = document.createElement('div');
  viewport.className = 'carousel-viewport';
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-roledescription', 'carousel');
  viewport.setAttribute('tabindex', '0');

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'carousel-next';
  nextBtn.setAttribute('aria-label', 'Next slide');
  nextBtn.innerHTML = '<span aria-hidden="true">&#8250;</span>';

  const dotsNav = document.createElement('nav');
  dotsNav.className = 'carousel-dots';
  dotsNav.setAttribute('aria-label', 'Carousel pagination');

  /** @type {HTMLElement[]} */
  const slides = [];

  rows.forEach((row, rowIndex) => {
    const slide = document.createElement('section');
    slide.className = 'carousel-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.dataset.slideIndex = String(rowIndex);
    moveInstrumentation(row, slide);
    while (row.firstElementChild) slide.append(row.firstElementChild);
    viewport.append(slide);
    slides.push(slide);
  });

  const total = slides.length;
  viewport.setAttribute(
    'aria-label',
    total ? `Slide carousel, ${total} slides` : 'Empty carousel',
  );

  slides.forEach((slide, i) => {
    slide.setAttribute('aria-label', `Slide ${i + 1} of ${total}`);
    slide.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
  });

  controls.append(prevBtn, viewport, nextBtn);

  /** @type {HTMLButtonElement[]} */
  const dotButtons = [];
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', `Go to slide ${i + 1} of ${total}`);
    dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
    dot.addEventListener('click', () => {
      scrollToSlide(viewport, slides, i, true);
    });
    dotsNav.append(dot);
    dotButtons.push(dot);
  });

  shell.append(controls, dotsNav);
  block.replaceChildren(shell);

  let activeIndex = 0;

  function syncChrome() {
    const atStart = activeIndex <= 0;
    const atEnd = activeIndex >= total - 1;
    prevBtn.disabled = total <= 1 || atStart;
    nextBtn.disabled = total <= 1 || atEnd;
    slides.forEach((slide, i) => {
      const on = i === activeIndex;
      slide.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    dotButtons.forEach((dot, i) => {
      dot.setAttribute('aria-current', i === activeIndex ? 'true' : 'false');
      dot.classList.toggle('is-active', i === activeIndex);
    });
  }

  function updateIndexFromScroll() {
    if (!slides.length) return;
    const { scrollLeft } = viewport;
    let best = 0;
    let bestDist = Infinity;
    slides.forEach((slide, i) => {
      const d = Math.abs(slide.offsetLeft - scrollLeft);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best !== activeIndex) {
      activeIndex = best;
      syncChrome();
    }
  }

  let scrollScheduled = false;
  viewport.addEventListener('scroll', () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => {
      scrollScheduled = false;
      updateIndexFromScroll();
    });
  });

  prevBtn.addEventListener('click', () => {
    scrollToSlide(viewport, slides, activeIndex - 1, true);
  });
  nextBtn.addEventListener('click', () => {
    scrollToSlide(viewport, slides, activeIndex + 1, true);
  });

  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollToSlide(viewport, slides, activeIndex - 1, true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollToSlide(viewport, slides, activeIndex + 1, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      scrollToSlide(viewport, slides, 0, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      scrollToSlide(viewport, slides, total - 1, true);
    }
  });

  /** Mouse drag to scroll (touch uses native horizontal pan + scroll-snap) */
  let dragStartX = 0;
  let dragStartScroll = 0;
  let dragging = false;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.target instanceof HTMLButtonElement || e.target.closest('button')) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartScroll = viewport.scrollLeft;
    try {
      viewport.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    viewport.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerType !== 'mouse') return;
    const dx = e.clientX - dragStartX;
    viewport.scrollLeft = dragStartScroll - dx;
  });
  viewport.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') return;
    dragging = false;
    viewport.classList.remove('is-dragging');
  });
  viewport.addEventListener('pointercancel', () => {
    dragging = false;
    viewport.classList.remove('is-dragging');
  });

  const ro = new ResizeObserver(() => {
    scrollToSlide(viewport, slides, activeIndex, false);
  });
  ro.observe(viewport);

  syncChrome();
  updateIndexFromScroll();

  await decorateNestedBlocksInSlides(block);
}
