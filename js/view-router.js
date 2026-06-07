import {
  animateImmersiveEnter,
  animateImmersiveExit,
  resetImmersiveGalleryAnimation,
} from './immersive/gallery-transitions.js';

const VIEW_HOME = 'home';
const VIEW_IMMERSIVE = 'immersive';
const VIEW_COMMISSION = 'commission';

let immersiveReady = false;
let isTransitioning = false;

function setNavActive(view) {
  document
    .querySelectorAll('.hero__nav a[data-nav-view], .hero__overlay-link[data-nav-view]')
    .forEach((link) => {
      const active = link.dataset.navView === view;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
}

window.__setNavActive = setNavActive;

function isImmersiveRoute(hash) {
  return hash === '#immersive';
}

function scrollToHash(hash) {
  if (!hash || hash === '#') {
    window.__lenis?.scrollTo(0, { duration: 1.2 });
    return;
  }

  const target = document.querySelector(hash);
  if (!target) return;

  if (window.__lenis) {
    window.__lenis.scrollTo(target, { duration: 1.2 });
  } else {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

async function showImmersiveView() {
  const homeView = document.getElementById('homeView');
  const immersiveView = document.getElementById('immersiveView');
  if (!homeView || !immersiveView) return;

  const galleryModule = immersiveReady
    ? null
    : await import('./immersive/infinite-gallery.js');

  if (!immersiveReady) {
    await galleryModule.initImmersiveGallery();
    immersiveReady = true;
  }

  homeView.hidden = true;
  immersiveView.hidden = false;
  document.body.classList.add('is-immersive-view');
  window.__lenis?.stop();
  if (!window.isCommissionOverlayOpen?.()) {
    setNavActive(VIEW_IMMERSIVE);
  }

  const { layoutImmersiveGallery } = galleryModule ?? (await import('./immersive/infinite-gallery.js'));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  layoutImmersiveGallery();

  await animateImmersiveEnter();
}

async function showHomeView({ scrollTarget } = {}) {
  const homeView = document.getElementById('homeView');
  const immersiveView = document.getElementById('immersiveView');
  if (!homeView || !immersiveView) return;

  const fromImmersive = document.body.classList.contains('is-immersive-view');

  if (fromImmersive) {
    await animateImmersiveExit(() => {
      homeView.hidden = false;
      document.body.classList.remove('is-immersive-view');
      window.__lenis?.start();
    });
    immersiveView.hidden = true;
    resetImmersiveGalleryAnimation(immersiveView);
  } else {
    homeView.hidden = false;
    immersiveView.hidden = true;
    document.body.classList.remove('is-immersive-view');
    window.__lenis?.start();
  }

  if (!window.isCommissionOverlayOpen?.()) {
    setNavActive(VIEW_HOME);
  }

  if (scrollTarget) {
    requestAnimationFrame(() => scrollToHash(scrollTarget));
  }

  requestAnimationFrame(() => window.__refreshGalleryScroll?.());
}

async function applyRoute() {
  if (isTransitioning) return;

  const hash = location.hash;

  if (hash === '#commission') {
    window.openCommissionOverlay?.();
    setNavActive(VIEW_COMMISSION);
    return;
  }

  window.closeCommissionOverlay?.();

  if (isImmersiveRoute(hash)) {
    if (document.body.classList.contains('is-immersive-view')) return;
    isTransitioning = true;
    try {
      await showImmersiveView();
    } finally {
      isTransitioning = false;
    }
    return;
  }

  if (document.body.classList.contains('is-immersive-view')) {
    isTransitioning = true;
    try {
      await showHomeView({ scrollTarget: hash || null });
    } finally {
      isTransitioning = false;
    }
    return;
  }

  showHomeView({ scrollTarget: hash || null });
}

function isAppRoute(href) {
  return href === '#immersive' || href === '#works' || href === '#about';
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;

  const href = link.getAttribute('href');
  if (!href) return;

  if (href === '#') {
    event.preventDefault();
    if (isTransitioning) return;
    if (location.hash) history.pushState(null, '', '#');
    void applyRoute();
    return;
  }

  if (!isAppRoute(href)) return;

  event.preventDefault();
  if (isTransitioning) return;

  if (href !== location.hash) {
    history.pushState(null, '', href);
  }

  void applyRoute();
});

window.addEventListener('popstate', () => {
  void applyRoute();
});

window.addEventListener('hashchange', () => {
  void applyRoute();
});

function bootRouter() {
  void applyRoute();
}

if (document.body.classList.contains('is-intro-active')) {
  window.addEventListener('lari:intro-complete', bootRouter, { once: true });
} else {
  bootRouter();
}
