import gsap from '../../node_modules/gsap/index.js';

const ENTER_TOTAL_DURATION = 3;
const ENTER_OVERLAY_FADE = 0.5;
const ENTER_PIECE_DELAY = 0.3;
const ENTER_PIECE_DURATION = 0.55;

const PIECE_STAGGER = 0.05;
const PIECE_DELAY = 0.15;
const PIECE_DURATION = 0.3;
const OVERLAY_FADE = 0.35;
const PIECE_EASE = 'power2.inOut';

function getEnterPieceStagger(frameCount) {
  if (frameCount <= 1) return 0;

  const staggerWindow = ENTER_TOTAL_DURATION - ENTER_PIECE_DELAY - ENTER_PIECE_DURATION;
  return Math.max(staggerWindow / (frameCount - 1), 0);
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let activeTimeline = null;

function getUnitFrameData(unit, direction) {
  const cells = [...unit.querySelectorAll('.gallery__cell')].sort((a, b) => {
    const av = Number(a.dataset.slot || 0);
    const bv = Number(b.dataset.slot || 0);
    return direction === 'enter' ? av - bv : bv - av;
  });

  return {
    cells,
    frames: cells.map((cell) => cell.querySelector('.gallery__frame')).filter(Boolean),
  };
}

function getAllGalleryData(immersiveView, direction) {
  const units = [...immersiveView.querySelectorAll('.immersive-unit')];

  return {
    units,
    cells: units.flatMap((unit) => getUnitFrameData(unit, direction).cells),
    frames: units.flatMap((unit) => getUnitFrameData(unit, direction).frames),
  };
}

function setCellsVisible(cells, visible) {
  cells.forEach((cell) => {
    cell.classList.toggle('is-visible', visible);
  });
}

export function resetImmersiveGalleryAnimation(immersiveView) {
  if (!immersiveView) return;

  activeTimeline?.kill();
  activeTimeline = null;

  immersiveView.classList.remove('is-leaving', 'is-entering');

  const { frames } = getAllGalleryData(immersiveView, 'enter');

  gsap.set(immersiveView, { clearProps: 'opacity' });
  gsap.set(frames, { clearProps: 'opacity' });
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

  const { units, cells, frames } = getAllGalleryData(immersiveView, 'enter');
  if (!frames.length) return;

  resetImmersiveGalleryAnimation(immersiveView);

  if (reduceMotion) {
    gsap.set(immersiveView, { opacity: 1 });
    gsap.set(frames, { opacity: 1 });
    setCellsVisible(cells, true);
    return;
  }

  setCellsVisible(cells, true);
  gsap.set(immersiveView, { opacity: 0 });
  gsap.set(frames, { opacity: 0 });

  await afterPaint();

  return new Promise((resolve) => {
    immersiveView.classList.add('is-entering');

    activeTimeline = gsap.timeline({
      onComplete: () => {
        resetImmersiveGalleryAnimation(immersiveView);
        setCellsVisible(cells, true);
        resolve();
      },
    });

    activeTimeline.to(immersiveView, {
      opacity: 1,
      duration: ENTER_OVERLAY_FADE,
      ease: PIECE_EASE,
    });

    const maxFrameCount = Math.max(
      ...units.map((unit) => getUnitFrameData(unit, 'enter').frames.length),
      1,
    );
    const enterStagger = getEnterPieceStagger(maxFrameCount);

    units.forEach((unit) => {
      const { frames: unitFrames } = getUnitFrameData(unit, 'enter');

      activeTimeline.to(
        unitFrames,
        {
          opacity: 1,
          duration: ENTER_PIECE_DURATION,
          stagger: { each: enterStagger, from: 'start' },
          ease: PIECE_EASE,
        },
        ENTER_PIECE_DELAY,
      );
    });
  });
}

export function animateImmersiveExit(onBeforeOverlayFade) {
  const immersiveView = document.getElementById('immersiveView');
  if (!immersiveView) return Promise.resolve();

  const { units, cells, frames } = getAllGalleryData(immersiveView, 'exit');

  if (!frames.length || reduceMotion) {
    onBeforeOverlayFade?.();
    return Promise.resolve();
  }

  resetImmersiveGalleryAnimation(immersiveView);

  setCellsVisible(cells, true);
  gsap.set(immersiveView, { opacity: 1 });
  gsap.set(frames, { opacity: 1 });

  return new Promise((resolve) => {
    immersiveView.classList.add('is-leaving');

    activeTimeline = gsap.timeline({
      onComplete: () => {
        resetImmersiveGalleryAnimation(immersiveView);
        setCellsVisible(cells, true);
        resolve();
      },
    });

    units.forEach((unit) => {
      const { frames: unitFrames } = getUnitFrameData(unit, 'exit');

      activeTimeline.to(
        unitFrames,
        {
          opacity: 0,
          duration: PIECE_DURATION,
          stagger: { each: PIECE_STAGGER, from: 'start' },
          ease: PIECE_EASE,
        },
        PIECE_DELAY,
      );
    });

    activeTimeline
      .add(() => onBeforeOverlayFade?.())
      .to(immersiveView, {
        opacity: 0,
        duration: OVERLAY_FADE,
        ease: PIECE_EASE,
      });
  });
}
