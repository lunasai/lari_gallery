import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function integrateLenis(lenis) {
  if (window.__lenisGsapIntegrated) return;

  ScrollTrigger.scrollerProxy(document.documentElement, {
    scrollTop(value) {
      if (arguments.length) {
        lenis.scrollTo(value, { immediate: true });
      }
      return lenis.scroll;
    },
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    },
  });

  lenis.on('scroll', ScrollTrigger.update);

  window.__lenisUseGsapTicker = true;
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  window.__lenisGsapIntegrated = true;
}

function initGalleryScroll() {
  const grid = document.getElementById('galleryGrid');
  if (!grid || reduceMotion) return;

  const lenis = window.__lenis;
  if (lenis) integrateLenis(lenis);

  gsap.utils.toArray('#galleryGrid .gallery__cell').forEach((cell) => {
    const frame = cell.querySelector('.gallery__frame');
    if (!frame) return;

    gsap.set(frame, { opacity: 0, y: 32 });

    ScrollTrigger.create({
      trigger: cell,
      start: 'top 90%',
      once: true,
      invalidateOnRefresh: true,
      onEnter: () => {
        if (cell.classList.contains('is-filtered-out')) return;

        gsap.to(frame, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      },
    });
  });

  window.__refreshGalleryScroll = () => ScrollTrigger.refresh();

  ScrollTrigger.refresh();
}

function boot() {
  if (reduceMotion) return;

  const start = () => {
    if (document.body.classList.contains('is-intro-active')) {
      window.addEventListener('lari:intro-complete', () => {
        requestAnimationFrame(() => {
          initGalleryScroll();
        });
      }, { once: true });
      return;
    }

    initGalleryScroll();
  };

  if (window.__lenis) start();
  else window.addEventListener('lenis:ready', start, { once: true });
}

boot();
