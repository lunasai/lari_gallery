import { createModalMotion } from './modal-motion.js';

export function initArtModal({ itemSelector, isVisible, isAvailable }) {
  const backdrop = document.getElementById('modalBackdrop');
  if (!backdrop) return null;

  const modalNav = document.getElementById('modalNav');
  const modalPrev = document.getElementById('modalPrev');
  const modalNext = document.getElementById('modalNext');
  const modalClose = document.getElementById('modalClose');
  const modalCta = document.getElementById('modalCta');

  let currentIndex = 0;
  let activeElement = null;
  let isOpen = false;
  let opener = null; // tile the artwork flew from (may be a visible copy of the real tile)
  let focusReturn = null; // tabbable tile to restore focus to
  let thumbnail = null;
  let revision = 0;
  let previousOverflow = '';
  const motion = createModalMotion(backdrop);

  function getVisibleItems() {
    return [...document.querySelectorAll(itemSelector)].filter(isVisible);
  }

  function findNextVisibleAfter(el) {
    const items = getVisibleItems();
    const start = items.indexOf(el);
    if (start === -1) return items[0] ?? null;
    return items[(start + 1) % items.length] ?? null;
  }

  function renderModal(card) {
    if (!card) return;

    activeElement = card;

    document.getElementById('modalImage').src = card.dataset.src;
    document.getElementById('modalImage').alt = card.dataset.title;
    document.getElementById('modalTitle').textContent = card.dataset.title;
    document.getElementById('modalCategory').textContent = card.dataset.category;
    document.getElementById('modalYear').textContent = card.dataset.year;
    document.getElementById('modalTechnique').textContent = card.dataset.technique;
    document.getElementById('modalDimensions').textContent = card.dataset.dimensions;
    document.getElementById('modalDescription').textContent = card.dataset.description;

    const available = isAvailable(card);
    document.getElementById('modalAvailability').textContent = available
      ? 'Available for sale – Price upon request.'
      : 'Not currently available for sale.';

    if (available) {
      const subject = encodeURIComponent('Enquiry about: ' + card.dataset.title);
      modalCta.textContent = 'Acquire';
      modalCta.href = 'mailto:oi.larissasan@gmail.com?subject=' + subject;
      modalCta.classList.remove('modal__cta--outline');
      modalCta.removeAttribute('target');
      modalCta.removeAttribute('rel');
    } else {
      modalCta.textContent = 'Commission a piece';
      modalCta.href = '#commission';
      modalCta.classList.add('modal__cta--outline');
      modalCta.removeAttribute('target');
      modalCta.removeAttribute('rel');
    }

    const items = getVisibleItems();
    const idx = items.indexOf(card);
    currentIndex = idx === -1 ? 0 : idx;

    if (modalNav) {
      modalNav.hidden = items.length <= 1;
    }

    if (isOpen) {
      backdrop.scrollTop = 0;
    }
  }

  function goToIndex(index) {
    const items = getVisibleItems();
    if (!isOpen) return;
    if (!items.length) {
      closeModal();
      return;
    }

    revision += 1;
    motion.cancel();
    backdrop.classList.add('is-open');
    thumbnail = null; // Next/previous may refer to an off-screen repeated tile.
    currentIndex = ((index % items.length) + items.length) % items.length;
    renderModal(items[currentIndex]);
  }

  function goNext() {
    goToIndex(currentIndex + 1);
  }

  function goPrev() {
    goToIndex(currentIndex - 1);
  }

  function setModalOpenState(open) {
    document.body.classList.toggle('is-modal-open', open);
    if (open) window.__lenis?.stop?.();
  }

  async function openModal(card, source = card) {
    const items = getVisibleItems();
    if (!items.length || !isVisible(card) || isOpen) return;

    const token = ++revision;
    motion.cancel();
    if (backdrop.hidden) previousOverflow = document.body.style.overflow;
    opener = source;
    focusReturn = card;
    thumbnail = source.querySelector('img');
    renderModal(card);
    backdrop.hidden = false;
    backdrop.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    setModalOpenState(true);
    isOpen = true;
    modalClose?.focus({ preventScroll: true });

    // Wait for intrinsic dimensions, but let Escape/close invalidate this open.
    const image = document.getElementById('modalImage');
    await Promise.race([image.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 150))]);
    if (token !== revision || !isOpen) return;
    backdrop.classList.add('is-open');
    await motion.run(true, thumbnail);
    if (token === revision) motion.cancel();
  }

  function isOnScreen(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
      rect.left >= 0 && rect.top >= 0 &&
      rect.right <= innerWidth && rect.bottom <= innerHeight;
  }

  // After next/previous the original tile shows a different work. Return to an
  // on-screen tile of the current work instead: the opener if it matches, else
  // the copy nearest to where the opener sits.
  function findReturnThumbnail() {
    if (!activeElement) return null;
    const src = activeElement.dataset.src;
    const candidates = [...document.querySelectorAll(itemSelector)]
      .filter(el => el.dataset.src === src && !el.closest('[hidden]'))
      .map(el => el.querySelector('img'))
      .filter(img => img?.complete && img.naturalWidth && isOnScreen(img));
    if (!candidates.length) return null;

    const openerImg = opener?.querySelector('img');
    if (candidates.includes(openerImg)) return openerImg;

    const anchor = (openerImg ?? backdrop).getBoundingClientRect();
    const ax = anchor.left + anchor.width / 2;
    const ay = anchor.top + anchor.height / 2;
    const distance = (img) => {
      const r = img.getBoundingClientRect();
      return Math.hypot(r.left + r.width / 2 - ax, r.top + r.height / 2 - ay);
    };
    return candidates.reduce((best, img) => (distance(img) < distance(best) ? img : best));
  }

  async function closeModal() {
    if (backdrop.hidden || !isOpen) return;
    const token = ++revision;
    isOpen = false;
    thumbnail ??= findReturnThumbnail();
    const closingOpacity = getComputedStyle(backdrop).opacity;
    const interruptedRect = motion.cancel();
    await motion.run(false, thumbnail, interruptedRect, closingOpacity);
    if (token !== revision) return;
    backdrop.hidden = true;
    backdrop.classList.remove('is-open');
    motion.cancel();
    backdrop.scrollTop = 0;
    document.body.style.overflow = previousOverflow;
    setModalOpenState(false);
    activeElement = null;
    if (focusReturn?.isConnected) focusReturn.focus({ preventScroll: true });
    opener = null;
    focusReturn = null;
    thumbnail = null;
  }

  function syncWithFilters() {
    if (!isOpen || !activeElement) return;

    const items = getVisibleItems();
    if (!items.length) {
      closeModal();
      return;
    }

    if (isVisible(activeElement)) {
      currentIndex = items.indexOf(activeElement);
      if (modalNav) modalNav.hidden = items.length <= 1;
      return;
    }

    const next = findNextVisibleAfter(activeElement);
    if (next) {
      revision += 1;
      motion.cancel();
      thumbnail = null;
      backdrop.classList.add('is-open');
      renderModal(next);
    }
    else closeModal();
  }

  modalPrev?.addEventListener('click', goPrev);
  modalNext?.addEventListener('click', goNext);
  modalClose?.addEventListener('click', closeModal);

  modalCta?.addEventListener('click', async (event) => {
    if (!activeElement || isAvailable(activeElement)) return;
    event.preventDefault();
    await closeModal();
    window.openCommissionOverlay?.();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  backdrop.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  backdrop.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

  document.addEventListener('keydown', (e) => {
    if (backdrop.hidden) return;

    if (e.key === 'Escape') {
      closeModal();
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNext();
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    }
  });

  return { open: openModal, close: closeModal, syncWithFilters };
}
