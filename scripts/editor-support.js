import {
  decorateBlock,
  decorateBlocks,
  decorateIcons,
  decorateSections,
  loadBlock,
  loadScript,
  loadSections,
} from './aem.js';
import { decorateRichtext } from './editor-support-rte.js';
import {
  decorateMain,
  decorateButtons,
  applyButtonPatchFromUe,
  applyButtonLivePatch,
  getButtonPatchFromEvent,
  mergeButtonUeState,
} from './scripts.js';

let promiseChanges$ = Promise.resolve();

function applyPatchAfterDecorate(scope, event) {
  const patch = getButtonPatchFromEvent(event?.detail);
  if (!patch?.name || !scope) return;
  applyButtonPatchFromUe(scope, patch);
  decorateButtons(scope.closest('.section') || scope.closest('main') || scope);
}

async function applyChanges(event) {
  await promiseChanges$;

  // redecorate default content and blocks on patches (in the properties rail)
  const { detail } = event;

  const resource = detail?.request?.target?.resource // update, patch components
    || detail?.request?.target?.container?.resource // update, patch, add to sections
    || detail?.request?.to?.container?.resource; // move in sections
  if (!resource) return false;
  const updates = detail?.response?.updates;
  if (!updates?.length) return false;
  const { content } = updates[0];
  if (!content) return false;

  // load dompurify
  await loadScript(`${window.hlx.codeBasePath}/scripts/dompurify.min.js`);

  const sanitizedContent = window.DOMPurify.sanitize(content, { USE_PROFILES: { html: true } });
  const parsedUpdate = new DOMParser().parseFromString(sanitizedContent, 'text/html');
  const element = document.querySelector(`[data-aue-resource="${resource}"]`);

  if (element) {
    if (element.matches('main')) {
      const newMain = parsedUpdate.querySelector(`[data-aue-resource="${resource}"]`);
      if (!newMain) return false;
      newMain.style.display = 'none';
      element.insertAdjacentElement('afterend', newMain);
      decorateMain(newMain);
      decorateRichtext(newMain);
      await loadSections(newMain);
      element.remove();
      newMain.style.display = null;
      applyPatchAfterDecorate(newMain, event);
      // eslint-disable-next-line no-use-before-define
      attachEventListeners(newMain);
      return true;
    }

    const block = element.parentElement?.closest('.block[data-aue-resource]') || element?.closest('.block[data-aue-resource]');
    if (block) {
      const blockResource = block.getAttribute('data-aue-resource');
      const newBlock = parsedUpdate.querySelector(`[data-aue-resource="${blockResource}"]`);
      if (newBlock) {
        newBlock.style.display = 'none';
        block.insertAdjacentElement('afterend', newBlock);
        const patch = getButtonPatchFromEvent(detail);
        const oldButton = block.querySelector(`[data-aue-resource="${resource}"]`);
        const newButton = newBlock.querySelector(`[data-aue-resource="${resource}"]`);
        if (oldButton && newButton) mergeButtonUeState(oldButton, newButton);
        applyButtonPatchFromUe(newBlock, patch);
        decorateButtons(newBlock);
        decorateIcons(newBlock);
        decorateBlock(newBlock);
        decorateRichtext(newBlock);
        await loadBlock(newBlock);
        block.remove();
        newBlock.style.display = null;
        applyPatchAfterDecorate(newBlock, event);
        return true;
      }
    } else {
      // sections and default content, may be multiple in the case of richtext
      const newElements = parsedUpdate.querySelectorAll(`[data-aue-resource="${resource}"],[data-richtext-resource="${resource}"]`);
      if (newElements.length) {
        const { parentElement } = element;
        if (element.matches('.section')) {
          const [newSection] = newElements;
          newSection.style.display = 'none';
          element.insertAdjacentElement('afterend', newSection);
          decorateButtons(newSection);
          decorateIcons(newSection);
          decorateRichtext(newSection);
          decorateSections(parentElement);
          decorateBlocks(parentElement);
          await loadSections(parentElement);
          element.remove();
          newSection.style.display = null;
          applyPatchAfterDecorate(newSection, event);
        } else {
          newElements.forEach((newEl) => mergeButtonUeState(element, newEl));
          element.replaceWith(...newElements);
          newElements.forEach((el) => applyButtonPatchFromUe(el, getButtonPatchFromEvent(detail)));
          const decorateScope = parentElement?.closest('.section') || parentElement?.closest('main') || parentElement;
          decorateButtons(decorateScope);
          decorateIcons(parentElement);
          decorateRichtext(parentElement);
          applyPatchAfterDecorate(parentElement, event);
        }
        return true;
      }
    }
  }

  return false;
}

function attachEventListeners(main) {
  [
    'aue:content-patch',
    'aue:content-update',
    'aue:content-add',
    'aue:content-move',
    'aue:content-remove',
    'aue:content-copy',
  ].forEach((eventType) => main?.addEventListener(eventType, async (event) => {
    event.stopPropagation();
    applyButtonLivePatch(event);
    promiseChanges$ = applyChanges(event);
    const applied = await promiseChanges$;
    if (applied) {
      applyButtonLivePatch(event);
    } else if (!applyButtonLivePatch(event)) {
      window.location.reload();
    }
  }));
}

attachEventListeners(document.querySelector('main'));

const BUTTON_UE_ATTRS = [
  'data-aue-model',
  'data-aue-prop-linktype',
  'data-aue-prop-link-type',
  'data-aue-prop-linkType',
  'data-aue-prop-classes',
  'data-aue-prop-disabled',
  'data-aue-prop-open-in-new-tab',
];

function scheduleButtonDecorate() {
  const main = document.querySelector('main');
  if (!main) return;
  decorateButtons(main);
  [50, 250, 1000, 2500].forEach((ms) => {
    window.setTimeout(() => decorateButtons(main), ms);
  });
}

scheduleButtonDecorate();

const buttonPropObserver = new MutationObserver((mutations) => {
  const main = document.querySelector('main');
  if (!main) return;
  const shouldDecorate = mutations.some(({ target, attributeName, type }) => {
    if (type !== 'attributes' || !attributeName) return false;
    if (attributeName === 'data-aue-model' && target.getAttribute('data-aue-model') === 'button') {
      return true;
    }
    if (!attributeName.startsWith('data-aue-prop-')) return false;
    return target.matches('[data-aue-model="button"], a[href]')
      || !!target.closest('[data-aue-model="button"]');
  });
  if (shouldDecorate) decorateButtons(main);
});

const observeRoot = document.querySelector('main') || document.body;
if (observeRoot) {
  buttonPropObserver.observe(observeRoot, {
    attributes: true,
    subtree: true,
    attributeFilter: BUTTON_UE_ATTRS,
  });
}

document.body?.addEventListener('aue:ui-select', () => {
  scheduleButtonDecorate();
});

// decorate rich text
// this has to happen after decorateMain(), and everythime decorateBlocks() is called
decorateRichtext();
// in cases where the block decoration is not done in one synchronous iteration we need to listen
// for new richtext-instrumented elements. this happens for example when using experimentation.
const observer = new MutationObserver(() => decorateRichtext());
observer.observe(document, { attributeFilter: ['data-richtext-prop'], subtree: true });
