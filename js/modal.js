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
  let focusReturn = null; // tabbable tile to restore focus to (keyboard opens only)
  let thumbnail = null;
  let revision = 0;
  let previousOverflow = '';
  const motion = createModalMotion(backdrop);

  const projectWrap = document.getElementById('modalProject');
  const scrollHint = document.getElementById('modalScrollHint');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function getVisibleItems() {
    return [...document.querySelectorAll(itemSelector)].filter(isVisible);
  }

  const isPortrait = (image) => image.height > image.width * 1.1;

  // Fallback rhythm when a project has no hand-tuned layout: alternate one
  // full-width image with a side-by-side pair. Portraits are always paired;
  // very wide images always get a row of their own.
  function autoRows(images) {
    const isWide = (image) => image.width > image.height * 1.9;
    const rows = [];
    let wantPair = false;
    for (let i = 0; i < images.length;) {
      const [a, b] = [images[i], images[i + 1]];
      if (b && !isWide(a) && !isWide(b) && (wantPair || isPortrait(a))) {
        rows.push([a, b]);
        i += 2;
        wantPair = false;
      } else {
        rows.push([a]);
        i += 1;
        wantPair = true;
      }
    }
    return rows;
  }

  // A layout row is a list of 1-based image numbers, or { row, width } to set
  // the row's width (in %) by hand.
  function projectRows(images, layout) {
    const rows = layout
      ? layout.map((entry) => {
        const { row, width } = Array.isArray(entry) ? { row: entry } : entry;
        return { images: row.map(number => images[number - 1]).filter(Boolean), width };
      }).filter(row => row.images.length)
      : autoRows(images.filter(image => !image.cover)).map(row => ({ images: row })); // cover is shown above
    // A lone portrait would tower over the page at full width; keep it narrow:
    // very tall boards at half width, gentler portraits with more room.
    return rows.map(({ images: row, width }) => {
      if (width) return { images: row, width };
      if (row.length !== 1 || !isPortrait(row[0])) return { images: row, width: 100 };
      return { images: row, width: row[0].width / row[0].height < 0.7 ? 50 : 64 };
    });
  }

  // Rows rise into place as they scroll into view, once their images are
  // ready, so nothing fades in as an empty box.
  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting) return;
        revealObserver.unobserve(target);
        const images = [...target.querySelectorAll('img')];
        const ready = images.map(img => img.decode().catch(() => {}));
        Promise.race([Promise.all(ready), new Promise(resolve => setTimeout(resolve, 1200))])
          .then(() => target.classList.add('is-revealed'));
      });
    }, { root: backdrop, rootMargin: '0px 0px -10% 0px', threshold: 0.12 })
    : null;

  function renderProject(card) {
    const images = card.dataset.project ? JSON.parse(card.dataset.project) : null;
    const layout = card.dataset.layout ? JSON.parse(card.dataset.layout) : null;
    backdrop.classList.toggle('modal-backdrop--project', Boolean(images));
    document.getElementById('modalTechniqueLabel').textContent = images ? 'Tools' : 'Technique';
    document.getElementById('modalDimensionsLabel').textContent = images ? 'Scope' : 'Dimensions';
    if (images) document.getElementById('modalDimensions').textContent = card.dataset.scope;
    if (!projectWrap) return;
    revealObserver?.disconnect();
    projectWrap.hidden = !images;
    if (!images) {
      projectWrap.replaceChildren();
      return;
    }

    const rows = projectRows(images, layout);
    projectWrap.replaceChildren(...rows.map(({ images: row, width }) => {
      const rowEl = document.createElement('div');
      const narrow = width < 100;
      rowEl.className = 'modal__project-row' + (narrow ? ' modal__project-row--narrow' : '');
      const rowAspect = row.reduce((sum, image) => sum + image.width / image.height, 0);
      if (narrow) rowEl.style.setProperty('--row-w', `${width}%`);
      row.forEach((image, index) => {
        const figure = document.createElement('figure');
        figure.className = 'modal__project-figure';
        figure.style.setProperty('--aspect', String(image.width / image.height)); // equal heights in a row
        figure.style.setProperty('--i', String(index)); // stagger within the row
        const img = document.createElement('img');
        img.src = image.md;
        // srcset splits on spaces, and the folder name has one: encode the paths.
        img.srcset = `${encodeURI(image.md)} 1000w, ${encodeURI(image.lg)} 2000w`;
        // Share of the row this image takes, for picking md vs lg.
        const share = Math.round(((image.width / image.height) / rowAspect) * width);
        img.sizes = `(max-width: 680px) 100vw, ${Math.max(share, 20)}vw`;
        img.width = image.width;
        img.height = image.height;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        figure.appendChild(img);
        rowEl.appendChild(figure);
      });
      if (revealObserver && !reducedMotion.matches) revealObserver.observe(rowEl);
      else rowEl.classList.add('is-revealed');
      return rowEl;
    }));
    const next = renderNextProject(card);
    if (next) projectWrap.appendChild(next);
  }

  // Closes a project page with a way into the next one, so the series reads on.
  function renderNextProject(card) {
    const items = getVisibleItems();
    const start = items.indexOf(card);
    if (start === -1) return null;
    const nextIndex = items.findIndex((_, offset) => {
      const candidate = items[(start + 1 + offset) % items.length];
      return candidate !== card && candidate.dataset.project;
    });
    if (nextIndex === -1) return null;
    const target = (start + 1 + nextIndex) % items.length;
    const nextCard = items[target];

    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'modal__next-project';
    const text = document.createElement('span');
    text.className = 'modal__next-text';
    const label = document.createElement('span');
    label.className = 'modal__next-label';
    label.textContent = 'Next project';
    const title = document.createElement('span');
    title.className = 'modal__next-title';
    title.textContent = nextCard.dataset.title;
    const arrow = document.createElement('span');
    arrow.className = 'modal__next-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    title.appendChild(arrow);
    text.append(label, title);
    const thumb = document.createElement('img');
    thumb.className = 'modal__next-thumb';
    thumb.src = nextCard.dataset.preview;
    thumb.alt = '';
    thumb.loading = 'lazy';
    thumb.decoding = 'async';
    link.append(text, thumb);
    link.addEventListener('click', () => goToIndex(target, 1));
    return link;
  }

  // Rows without a value (e.g. an unrecorded size) are left out, not shown as "—".
  function hideEmptyFields() {
    backdrop.querySelectorAll('.modal__field').forEach((field) => {
      const value = field.querySelector('.modal__value');
      const text = value?.textContent.trim() ?? '';
      field.hidden = !text || text === '—' || text === '-' || text === 'undefined';
    });
  }

  // The controls float over the artwork once a long page scrolls; tuck them
  // away while reading down and bring them back on the way up.
  const controls = backdrop.querySelector('.modal__controls');
  let lastScrollTop = 0;
  function setControlsHidden(hidden) {
    backdrop.classList.toggle('is-controls-hidden', hidden);
  }
  backdrop.addEventListener('scroll', () => {
    const top = backdrop.scrollTop;
    const delta = top - lastScrollTop;
    lastScrollTop = top;
    if (top < 120) {
      setControlsHidden(false);
      return;
    }
    if (Math.abs(delta) < 6) return;
    if (controls?.querySelector(':focus-visible')) return;
    setControlsHidden(delta > 0);
  }, { passive: true });

  scrollHint?.addEventListener('click', () => {
    const first = projectWrap?.querySelector('.modal__project-row');
    if (!first) return;
    const top = first.getBoundingClientRect().top - backdrop.getBoundingClientRect().top + backdrop.scrollTop;
    backdrop.scrollTo({ top: top - 72, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });

  function renderModal(card) {
    if (!card) return;

    activeElement = card;

    // Open on the grid image (already loaded, so the fly-in is instant), then
    // swap in the high-resolution version once it has decoded.
    const image = document.getElementById('modalImage');
    const full = card.dataset.src;
    const preview = card.dataset.preview;
    image.src = preview || full;
    if (preview && preview !== full) {
      const hi = new Image();
      hi.src = full;
      hi.decode().then(() => {
        if (activeElement === card) image.src = full;
      }).catch(() => {});
    }
    document.getElementById('modalImage').alt = card.dataset.title;
    document.getElementById('modalTitle').textContent = card.dataset.title;
    document.getElementById('modalCategory').textContent = card.dataset.category;
    document.getElementById('modalYear').textContent = card.dataset.year;
    document.getElementById('modalTechnique').textContent = card.dataset.technique;
    document.getElementById('modalDimensions').textContent = card.dataset.dimensions;
    document.getElementById('modalDescription').textContent = card.dataset.description;
    renderProject(card);
    hideEmptyFields();
    setControlsHidden(false);
    lastScrollTop = 0;

    const isProject = Boolean(card.dataset.project);
    const available = isAvailable(card);
    const availability = document.getElementById('modalAvailability');
    availability.hidden = isProject;
    availability.textContent = available
      ? 'Available for sale – Price upon request.'
      : 'Not currently available for sale.';

    if (isProject) {
      modalCta.textContent = 'Start a project';
      modalCta.href = '#commission';
      modalCta.classList.add('modal__cta--outline');
      modalCta.removeAttribute('target');
      modalCta.removeAttribute('rel');
    } else if (available) {
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

  // direction: 1 = next, -1 = previous, 0 = a jump (e.g. "Next project")
  function goToIndex(index, direction = 0) {
    const items = getVisibleItems();
    if (!isOpen) return;
    if (!items.length) {
      closeModal();
      return;
    }

    revision += 1;
    motion.cancel();
    // Only when the artwork is in view (not from the bottom of a project page).
    if (backdrop.scrollTop < 200) motion.leaveImage(direction);
    backdrop.classList.add('is-open');
    thumbnail = null; // Next/previous may refer to an off-screen repeated tile.
    currentIndex = ((index % items.length) + items.length) % items.length;
    renderModal(items[currentIndex]);
    alignDetailsToArt();
    motion.enterDetails(60, { withImage: true, direction });
  }

  function goNext() {
    goToIndex(currentIndex + 1, 1);
  }

  function goPrev() {
    goToIndex(currentIndex - 1, -1);
  }

  function setModalOpenState(open) {
    document.body.classList.toggle('is-modal-open', open);
    if (open) window.__lenis?.stop?.();
  }

  async function openModal(card, source = card, { viaKeyboard = false } = {}) {
    const items = getVisibleItems();
    if (!items.length || !isVisible(card) || isOpen) return;

    const token = ++revision;
    motion.cancel();
    if (backdrop.hidden) previousOverflow = document.body.style.overflow;
    opener = source;
    // Only keyboard users get focus handed back to the tile; for a mouse open
    // that focus would read as keyboard focus (e.g. after Escape) and leave
    // the tile lifted with its title showing.
    focusReturn = viaKeyboard ? card : null;
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
    alignDetailsToArt(); // before the flight measures its target
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
    else if (backdrop.contains(document.activeElement)) document.activeElement.blur();
    opener = null;
    focusReturn = null;
    thumbnail = null;
  }

  modalPrev?.addEventListener('click', goPrev);
  modalNext?.addEventListener('click', goNext);
  // The details sit bottom-left in their half, level with the artwork's bottom
  // edge (not the art box's: a landscape piece is centred in a taller box).
  const modalImage = document.getElementById('modalImage');
  const modalDetails = backdrop.querySelector('.modal__details');
  const modalArtBox = backdrop.querySelector('.modal__image-wrap');
  function alignDetailsToArt() {
    if (backdrop.hidden || !modalImage.naturalWidth || !modalDetails || !modalArtBox) return;
    // Layout sizes, not rects: the image may be mid scale-in. It is centred in the box.
    const inset = (modalArtBox.clientHeight - modalImage.offsetHeight) / 2;
    modalDetails.style.setProperty('--art-inset', `${Math.max(0, Math.round(inset))}px`);
  }
  modalImage.addEventListener('load', alignDetailsToArt);
  window.addEventListener('resize', alignDetailsToArt);

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

  // Touch: a clear sideways swipe pages between works (vertical stays scroll).
  let touchStart = null;
  backdrop.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStart = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  backdrop.addEventListener('touchend', (e) => {
    if (!touchStart || !isOpen || modalNav?.hidden) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) goNext();
    else goPrev();
  }, { passive: true });

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

  return { open: openModal, close: closeModal };
}
