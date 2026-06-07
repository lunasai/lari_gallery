import Lenis from 'lenis';

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

window.scrollTo(0, 0);

function resetScrollPosition() {
  window.scrollTo(0, 0);
  window.__lenis?.scrollTo(0, { immediate: true });
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted) resetScrollPosition();
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scrollEaseOut = (t) => 1 - Math.pow(1 - t, 4);

if (!reduceMotion) {
  const lenis = new Lenis({
    lerp: 0.055,
    smoothWheel: true,
    wheelMultiplier: 0.82,
    syncTouch: true,
    syncTouchLerp: 0.055,
    touchMultiplier: 1.1,
    touchInertiaExponent: 1.6,
  });

  lenis.scrollTo(0, { immediate: true });

  window.__lenis = lenis;
  window.__lenisUseGsapTicker = false;
  window.dispatchEvent(new CustomEvent('lenis:ready'));

  function raf(time) {
    if (window.__lenisUseGsapTicker) return;
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      if (href === '#immersive' || href === '#works' || href === '#about') return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      lenis.scrollTo(target, {
        duration: 2,
        easing: scrollEaseOut,
      });
    });
  });

  function syncScrollLock() {
    const locked =
      document.body.classList.contains('is-intro-active') ||
      document.body.classList.contains('is-immersive-view') ||
      document.body.classList.contains('is-modal-open') ||
      document.body.style.overflow === 'hidden';

    if (locked) lenis.stop();
    else lenis.start();
  }

  if (document.body.classList.contains('is-intro-active')) {
    lenis.stop();
    window.addEventListener('lari:intro-complete', syncScrollLock, { once: true });
  }

  new MutationObserver(syncScrollLock).observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
}
