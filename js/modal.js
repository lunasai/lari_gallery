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
    if (!items.length) {
      closeModal();
      return;
    }

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

  function openModal(card) {
    const items = getVisibleItems();
    if (!items.length || !isVisible(card)) return;

    renderModal(card);

    backdrop.hidden = false;
    backdrop.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    setModalOpenState(true);
    isOpen = true;
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
  }

  function closeModal() {
    if (backdrop.hidden) return;

    isOpen = false;
    activeElement = null;
    setModalOpenState(false);
    backdrop.classList.remove('is-open');
    backdrop.addEventListener(
      'transitionend',
      () => {
        backdrop.hidden = true;
        backdrop.scrollTop = 0;
        document.body.style.overflow = '';
      },
      { once: true }
    );
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
    if (next) renderModal(next);
    else closeModal();
  }

  modalPrev?.addEventListener('click', goPrev);
  modalNext?.addEventListener('click', goNext);
  modalClose?.addEventListener('click', closeModal);

  modalCta?.addEventListener('click', (event) => {
    if (!activeElement || isAvailable(activeElement)) return;
    event.preventDefault();
    closeModal();
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
