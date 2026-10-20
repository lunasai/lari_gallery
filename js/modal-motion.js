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
    const duration = reduced.matches ? 0 : (open ? 680 : 540);
    const source = open ? artworkRect(thumbnail) : (interruptedRect || artworkRect(image));
    const target = open ? artworkRect(image) : artworkRect(thumbnail);
    const fade = backdrop.animate(
      [{ opacity: open ? 0 : (closingOpacity ?? getComputedStyle(backdrop).opacity) }, { opacity: open ? 1 : 0 }],
      { duration: reduced.matches ? 0 : (open ? 480 : 540), easing: 'cubic-bezier(.25, .1, .25, 1)', fill: 'both' }
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
      ], { duration, easing: 'cubic-bezier(.22, .61, .36, 1)', fill: 'both' }));
      const details = backdrop.querySelector('.modal__details');
      if (open && details) {
        animations.push(details.animate(
          [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 400, delay: 140, easing: 'cubic-bezier(.22, .61, .36, 1)', fill: 'both' }
        ));
      }
    }
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  }

  return { run, cancel };
}
