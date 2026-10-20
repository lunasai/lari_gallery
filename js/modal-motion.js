// A temporary image bridges the gallery thumbnail and the detail image.
// Keep it outside the backdrop so the artwork stays opaque while the room fades.
export function createModalMotion(backdrop) {
  const image = backdrop.querySelector('#modalImage');
  const panel = backdrop.querySelector('.modal');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let flight = null;
  let animations = [];
  let hidden = [];

  backdrop.style.transition = 'none';
  panel.style.transition = 'none';
  panel.style.transform = 'none';

  function cancel() {
    const rect = flight?.getBoundingClientRect();
    animations.forEach(animation => animation.cancel());
    animations = [];
    flight?.remove();
    flight = null;
    hidden.forEach(([element, visibility]) => { element.style.visibility = visibility; });
    hidden = [];
    return rect;
  }

  function hide(element) {
    if (!element) return;
    hidden.push([element, element.style.visibility]);
    element.style.visibility = 'hidden';
  }

  function visibleRect(element) {
    if (!element?.isConnected) return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
      rect.right > 0 && rect.bottom > 0 &&
      rect.left < innerWidth && rect.top < innerHeight ? rect : null;
  }

  // An <img> box can include empty space from object-fit: contain.
  // Animate the actual painted image, not that larger layout box.
  function artworkRect(element) {
    const box = visibleRect(element);
    if (!box || !element.naturalWidth || !element.naturalHeight) return null;
    const scale = Math.min(box.width / element.naturalWidth, box.height / element.naturalHeight);
    const width = element.naturalWidth * scale;
    const height = element.naturalHeight * scale;
    const position = getComputedStyle(element).objectPosition.split(' ');
    const offset = value => value?.endsWith('%') ? parseFloat(value) / 100 : 0.5;
    return {
      left: box.left + (box.width - width) * offset(position[0]),
      top: box.top + (box.height - height) * offset(position[1] ?? position[0]),
      width, height,
    };
  }

  async function run(open, thumbnail, interruptedRect, closingOpacity) {
    const duration = reduced.matches ? 0 : (open ? 860 : 620);
    const source = open ? artworkRect(thumbnail) : (interruptedRect || artworkRect(image));
    const target = open ? artworkRect(image) : artworkRect(thumbnail);
    const fade = backdrop.animate(
      [{ opacity: open ? 0 : (closingOpacity ?? getComputedStyle(backdrop).opacity) }, { opacity: open ? 1 : 0 }],
      { duration: reduced.matches ? 0 : (open ? 620 : 560), easing: 'cubic-bezier(.33, 0, .2, 1)', fill: 'both' }
    );
    animations.push(fade);
    // Differently cropped assets dissolve instead of stretching into one another.
    const sameAspect = source && target &&
      Math.abs((source.width / source.height) / (target.width / target.height) - 1) < 0.005;
    if (duration && sameAspect && thumbnail?.complete && image.complete && image.naturalWidth) {
      flight = document.createElement('img');
      flight.src = image.currentSrc;
      flight.alt = '';
      flight.setAttribute('aria-hidden', 'true');
      Object.assign(flight.style, {
        position: 'fixed', left: `${source.left}px`, top: `${source.top}px`,
        width: `${source.width}px`, height: `${source.height}px`,
        margin: '0', maxWidth: 'none', maxHeight: 'none',
        objectFit: 'contain', transformOrigin: '0 0', zIndex: '201', pointerEvents: 'none',
      });
      document.body.appendChild(flight);
      hide(image);
      hide(thumbnail);
      animations.push(flight.animate([
        { transform: 'translate(0, 0) scale(1)' },
        { transform: `translate(${target.left - source.left}px, ${target.top - source.top}px) scale(${target.width / source.width})` },
      ], { duration, easing: open ? 'cubic-bezier(.22, 1, .36, 1)' : 'cubic-bezier(.45, 0, .2, 1)', fill: 'both' }));
    }
    if (open && duration) enterDetails(220);
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  }

  // Details arrive line by line: category, title, description, meta, actions.
  // When paging between works, the new image also fades in (no flight then),
  // drifting in from the side it was paged from: next from the right.
  function enterDetails(delay = 0, { withImage = false, direction = 0 } = {}) {
    if (reduced.matches) return;
    if (withImage) {
      const from = `translateX(${direction * 32}px) scale(0.99)`;
      animations.push(image.animate(
        [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
        { duration: 900, delay: 60, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' }
      ));
    }
    const parts = backdrop.querySelectorAll(
      '.modal__category, .modal__title, .modal__description, .modal__meta, .modal__footer'
    );
    parts.forEach((part, index) => {
      animations.push(part.animate(
        [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 780, delay: delay + index * 70, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' }
      ));
    });
  }

  // Paging: a copy of the outgoing artwork stays where it was and eases away
  // toward the side being left, so the new piece crossfades in over it
  // instead of appearing on an empty wall.
  let ghost = null;
  function leaveImage(direction = 0) {
    ghost?.remove();
    ghost = null;
    if (reduced.matches || image.style.visibility === 'hidden') return;
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height || !image.currentSrc) return;
    const copy = image.cloneNode();
    copy.removeAttribute('id');
    copy.alt = '';
    copy.setAttribute('aria-hidden', 'true');
    Object.assign(copy.style, {
      position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
      margin: '0', maxWidth: 'none', maxHeight: 'none',
      zIndex: '201', pointerEvents: 'none',
    });
    document.body.appendChild(copy);
    ghost = copy;
    copy.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${direction * -24}px) scale(0.99)` }],
      { duration: 560, easing: 'cubic-bezier(.33, 0, .2, 1)', fill: 'both' }
    ).finished.catch(() => {}).then(() => {
      copy.remove();
      if (ghost === copy) ghost = null;
    });
  }

  return { run, cancel, enterDetails, leaveImage };
}
