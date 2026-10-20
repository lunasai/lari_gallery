import gsap from 'gsap';

// Enter: only the tiles on screen animate, rippling out from the centre of
// the viewport; everything off screen is simply shown.
const ENTER_DURATION = 0.7;
const ENTER_SPREAD = 0.45; // delay of the farthest visible tile
const ENTER_RISE = 16;
const ENTER_SCALE = 0.97;
const ENTER_EASE = 'power3.out';

// Exit: the next view is already in place underneath; the gallery fades off it.
const EXIT_DURATION = 0.4;
const EXIT_EASE = 'power2.out';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let activeTimeline = null;

function getCells(immersiveView) {
  return [...immersiveView.querySelectorAll('.immersive-unit .gallery__cell')];
}

function setCellsVisible(cells, visible) {
  cells.forEach((cell) => {
    cell.classList.toggle('is-visible', visible);
  });
}

// On-screen tiles with their distance from the viewport centre (0–1).
function getOnScreenCells(cells) {
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const maxDist = Math.hypot(cx, cy) || 1;
  return cells.flatMap((cell) => {
    const r = cell.getBoundingClientRect();
    if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return [];
    const dist = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
    return [{ cell, t: Math.min(dist / maxDist, 1) }];
  });
}

export function resetImmersiveGalleryAnimation(immersiveView) {
  if (!immersiveView) return;

  activeTimeline?.kill();
  activeTimeline = null;

  immersiveView.classList.remove('is-leaving', 'is-entering');
  gsap.set(immersiveView, { clearProps: 'opacity' });
  gsap.set(getCells(immersiveView), { clearProps: 'opacity,transform' });
}

function afterPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

export async function animateImmersiveEnter() {
  const immersiveView = document.getElementById('immersiveView');
  if (!immersiveView) return;

  const cells = getCells(immersiveView);
  if (!cells.length) return;

  resetImmersiveGalleryAnimation(immersiveView);
  setCellsVisible(cells, true);
  if (reduceMotion) return;

  const onScreen = getOnScreenCells(cells);
  const targets = onScreen.map(({ cell }) => cell);
  immersiveView.classList.add('is-entering');
  gsap.set(targets, { opacity: 0, y: ENTER_RISE, scale: ENTER_SCALE });

  await afterPaint();

  return new Promise((resolve) => {
    activeTimeline = gsap.timeline({
      onComplete: () => {
        resetImmersiveGalleryAnimation(immersiveView);
        resolve();
      },
    });

    onScreen.forEach(({ cell, t }) => {
      activeTimeline.to(
        cell,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: ENTER_DURATION,
          ease: ENTER_EASE,
        },
        t * ENTER_SPREAD,
      );
    });
  });
}

export function animateImmersiveExit(onBeforeOverlayFade) {
  const immersiveView = document.getElementById('immersiveView');
  if (!immersiveView) return Promise.resolve();

  resetImmersiveGalleryAnimation(immersiveView);
  onBeforeOverlayFade?.();

  if (reduceMotion) return Promise.resolve();

  return new Promise((resolve) => {
    immersiveView.classList.add('is-leaving');
    activeTimeline = gsap.timeline({ onComplete: resolve });
    activeTimeline.to(immersiveView, {
      opacity: 0,
      duration: EXIT_DURATION,
      ease: EXIT_EASE,
    });
  });
}
