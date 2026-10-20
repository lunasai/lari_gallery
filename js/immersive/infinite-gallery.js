import { initGalleryFilters } from '../gallery-filters.js';

const TILE_LAYOUT = [
  { slot: 1, variant: 'tall', workId: 'woman-wolf' },
  { slot: 2, variant: 'tall', workId: 'afternoon-nap' },
  { slot: 3, variant: 'narrow', workId: 'the-eye' },
  { slot: 4, variant: 'tall', workId: 'horned-crown' },
  { slot: 5, variant: 'square', workId: 'mini-canvas' },
  { slot: 6, variant: 'tall', workId: 'grenade' },
  { slot: 7, variant: 'tall', workId: 'rider' },
  { slot: 8, variant: 'narrow', workId: 'hair-brush' },
  { slot: 9, variant: 'tall', workId: 'fox-moon' },
  { slot: 10, variant: 'tall', workId: 'commissioned-portrait' },
  { slot: 11, variant: 'square', workId: 'intimacy' },
  { slot: 12, variant: 'narrow', workId: 'the-eye' },
  { slot: 13, variant: 'tall', workId: 'rider' },
  { slot: 14, variant: 'narrow', workId: 'hair-brush' },
  { slot: 15, variant: 'tall', workId: 'afternoon-nap' },
  { slot: 16, variant: 'square', workId: 'mini-canvas' },
];

const REPEAT = 3;
const DRAG_THRESHOLD = 6;
const FRICTION = 0.94;
const VELOCITY_SMOOTHING = 0.38;
const THROW_SCALE = 1.35;
const WHEEL_SCALE = 0.85;
const WHEEL_VELOCITY_BLEND = 0.45;
const WHEEL_IMMEDIATE = 0.55;
const STOP_VELOCITY = 0.06;
const REVEAL_MARGIN = 96; // keep keyboard-focused art clear of the edges + filter bar
const REVEAL_EASING = 0.12;
// Hover/focus lift + caption only on desktop-like devices (see immersive.css)
const HOVER_FEEDBACK_QUERY = '(hover: hover) and (min-width: 769px)';
const PARALLAX_SENSITIVITY = -0.28;
const PARALLAX_EASING = 0.028;
const AMBIENT_SPEED = 0.18;
const AMBIENT_WOBBLE = 0.025;
const AMBIENT_HEADING_DRIFT = 0.28;
const AMBIENT_HEADING_SWAY_A = 0.85;
const AMBIENT_HEADING_SWAY_B = 0.5;
const AMBIENT_VELOCITY_EASING = 0.035;
const AMBIENT_IDLE_MS = 2000;
const AMBIENT_RAMP = 0.012;
const FLOAT_AMPLITUDE = 3;
const FLOAT_SPEED = 0.0007;

function depthForSlot(slot) {
  return 0.28 + ((slot - 1) % 5) * 0.07;
}

function galleryThumb(src) {
  const file = src.split('/').pop();
  return `arts lari/gallery/${file}`;
}

function filterIdForCategory(categoryId) {
  if (categoryId === 'paintings' || categoryId === 'commissions') return 'design';
  return categoryId;
}

function createCell(work, { slot, variant }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `gallery__cell gallery__cell--${variant}`;
  btn.dataset.slot = String(slot);
  btn.dataset.depth = String(depthForSlot(slot));
  btn.dataset.src = work.src;
  btn.dataset.title = work.title;
  btn.dataset.category = work.category;
  btn.dataset.filter = filterIdForCategory(work.categoryId);
  btn.dataset.available = work.forSale ? 'true' : 'false';
  btn.dataset.year = work.year;
  btn.dataset.technique = work.technique;
  btn.dataset.dimensions = work.dimensions;
  btn.dataset.description = work.description;
  btn.setAttribute('aria-label', `${work.title} — ${work.category}`);

  const frame = document.createElement('span');
  frame.className = 'gallery__frame';
  const img = document.createElement('img');
  img.src = galleryThumb(work.src);
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  if (work.objectPosition) img.style.objectPosition = work.objectPosition;
  frame.appendChild(img);

  // Revealed on hover / keyboard focus; positioned under the painted artwork.
  const caption = document.createElement('span');
  caption.className = 'gallery__caption';
  caption.setAttribute('aria-hidden', 'true'); // the button's aria-label already says this
  const title = document.createElement('span');
  title.className = 'gallery__caption-title';
  title.textContent = work.title;
  const medium = document.createElement('span');
  medium.className = 'gallery__caption-medium';
  medium.textContent = work.technique;
  caption.append(title, medium);
  frame.appendChild(caption);

  btn.appendChild(frame);
  return btn;
}

// The <img> box includes object-fit: contain letterboxing; pin the caption to
// the painted artwork's bottom-left edge instead (untransformed layout sizes).
function positionCaption(cell) {
  const img = cell?.querySelector('.gallery__frame img');
  const caption = cell?.querySelector('.gallery__caption');
  if (!img || !caption || !img.naturalWidth) return;
  const boxW = img.offsetWidth;
  const boxH = img.offsetHeight;
  const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
  const paintedW = img.naturalWidth * scale;
  const paintedH = img.naturalHeight * scale;
  caption.style.left = `${img.offsetLeft + (boxW - paintedW) / 2}px`;
  caption.style.top = `${img.offsetTop + (boxH + paintedH) / 2}px`;
  caption.style.width = `${paintedW}px`;
}

function buildUnit(worksById) {
  const unit = document.createElement('div');
  unit.className = 'immersive-unit';

  const grid = document.createElement('div');
  grid.className = 'gallery__grid site-grid immersive-unit__grid';
  grid.setAttribute('role', 'list');

  TILE_LAYOUT.forEach((tile) => {
    const work = worksById.get(tile.workId);
    if (!work) return;
    grid.appendChild(createCell(work, tile));
  });

  unit.appendChild(grid);
  return unit;
}

function cloneUnit(unit, { source }) {
  const clone = unit.cloneNode(true);
  clone.classList.toggle('immersive-unit--source', source);
  if (!source) {
    clone.setAttribute('aria-hidden', 'true');
    // Tab moves through the source unit only; copies mirror its focus state.
    clone.querySelectorAll('.gallery__cell').forEach((cell) => { cell.tabIndex = -1; });
  }
  return clone;
}

function layoutUnits(track, unitW, unitH) {
  const units = track.querySelectorAll('.immersive-unit');
  const cols = REPEAT;
  units.forEach((el, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    el.style.left = `${col * unitW}px`;
    el.style.top = `${row * unitH}px`;
  });
  track.style.width = `${unitW * cols}px`;
  track.style.height = `${unitH * cols}px`;
}

function createDragController({ stage, track, onDragChange }) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let unitW = 0;
  let unitH = 0;
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  let pointerDown = false;
  let panning = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;
  let pointerId = null;
  let raf = 0;
  let hasLayout = false;
  let ambientStrength = 0;
  let ambientVx = 0;
  let ambientVy = 0;
  let lastInteractionAt = 0;
  let panX = 0; // remaining keyboard-reveal pan, eased in by tick()
  let panY = 0;

  function markInteraction() {
    lastInteractionAt = Date.now();
    ambientStrength = 0;
    ambientVx = 0;
    ambientVy = 0;
  }

  function isIdle() {
    return (
      !pointerDown
      && !panning
      && Date.now() - lastInteractionAt > AMBIENT_IDLE_MS
      && Math.abs(vx) < STOP_VELOCITY
      && Math.abs(vy) < STOP_VELOCITY
    );
  }

  function measure({ resetPosition = false } = {}) {
    const unit = track.querySelector('.immersive-unit');
    if (!unit) return false;

    const nextW = unit.offsetWidth;
    const nextH = unit.offsetHeight;
    if (!nextW || !nextH || !stage.clientWidth || !stage.clientHeight) return false;

    const sizeChanged = nextW !== unitW || nextH !== unitH;
    unitW = nextW;
    unitH = nextH;

    if (!hasLayout || resetPosition || sizeChanged) {
      x = stage.clientWidth / 2 - unitW * 1.5;
      y = stage.clientHeight / 2 - unitH * 1.5;
    }

    layoutUnits(track, unitW, unitH);
    hasLayout = true;
    apply();
    return true;
  }

  function wrapAxis(value, size) {
    if (!size) return value;
    while (value > 0) value -= size;
    while (value < -size) value += size;
    return value;
  }

  function apply() {
    track.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function tick(now) {
    if (panX || panY) {
      const stepX = Math.abs(panX) < 0.5 ? panX : panX * REVEAL_EASING;
      const stepY = Math.abs(panY) < 0.5 ? panY : panY * REVEAL_EASING;
      x += stepX;
      y += stepY;
      panX -= stepX;
      panY -= stepY;
    }

    // Hold the track still while the detail view is open (so the artwork can fly
    // back to the exact spot it left) or a tile has keyboard focus; drift ramps
    // back in after the idle delay.
    if (
      document.body.classList.contains('is-modal-open')
      || track.querySelector('.gallery__cell.is-keyboard-focus')
    ) {
      markInteraction();
      vx = 0;
      vy = 0;
    } else if (!pointerDown && !reduceMotion && !document.hidden) {
      const moving = Math.abs(vx) >= STOP_VELOCITY || Math.abs(vy) >= STOP_VELOCITY;

      if (moving) {
        x += vx;
        y += vy;
        vx *= FRICTION;
        vy *= FRICTION;
        if (Math.abs(vx) < STOP_VELOCITY) vx = 0;
        if (Math.abs(vy) < STOP_VELOCITY) vy = 0;
      } else if (isIdle()) {
        ambientStrength = Math.min(1, ambientStrength + AMBIENT_RAMP);
        const t = now * 0.00025;
        const heading =
          t * AMBIENT_HEADING_DRIFT
          + Math.sin(t * 0.55) * AMBIENT_HEADING_SWAY_A
          + Math.cos(t * 0.31 + 0.8) * AMBIENT_HEADING_SWAY_B;
        const speed = (AMBIENT_SPEED + Math.sin(t * 1.1) * AMBIENT_WOBBLE) * ambientStrength;
        const targetVx = Math.cos(heading) * speed;
        const targetVy = Math.sin(heading) * speed;
        ambientVx += (targetVx - ambientVx) * AMBIENT_VELOCITY_EASING;
        ambientVy += (targetVy - ambientVy) * AMBIENT_VELOCITY_EASING;
        x += ambientVx;
        y += ambientVy;
      } else {
        ambientStrength = Math.max(0, ambientStrength - AMBIENT_RAMP);
        ambientVx += (0 - ambientVx) * AMBIENT_VELOCITY_EASING;
        ambientVy += (0 - ambientVy) * AMBIENT_VELOCITY_EASING;
      }
    }

    x = wrapAxis(x, unitW);
    y = wrapAxis(y, unitH);
    apply();
    raf = requestAnimationFrame(tick);
  }

  function setPanning(next) {
    panning = next;
    stage.classList.toggle('is-dragging', next);
    onDragChange?.(next);
  }

  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    markInteraction();
    pointerDown = true;
    panning = false;
    moved = false;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    vx = 0;
    vy = 0;
  });

  stage.addEventListener('pointermove', (event) => {
    if (!pointerDown || event.pointerId !== pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    if (!panning && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      moved = true;
      stage.setPointerCapture(event.pointerId);
      setPanning(true);
    }
    if (!panning) return;
    lastInteractionAt = Date.now();
    lastX = event.clientX;
    lastY = event.clientY;
    x += dx;
    y += dy;
    if (!reduceMotion) {
      vx = vx * (1 - VELOCITY_SMOOTHING) + dx * VELOCITY_SMOOTHING;
      vy = vy * (1 - VELOCITY_SMOOTHING) + dy * VELOCITY_SMOOTHING;
    }
    if (reduceMotion) apply();
  });

  function endDrag(event) {
    if (event.pointerId !== pointerId) return;
    if (stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }
    const wasPanning = panning;
    pointerId = null;
    pointerDown = false;
    if (panning) setPanning(false);
    if (wasPanning && !reduceMotion) {
      vx *= THROW_SCALE;
      vy *= THROW_SCALE;
    }
  }

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener(
    'wheel',
    (event) => {
      const modalBackdrop = document.getElementById('modalBackdrop');
      if (modalBackdrop && !modalBackdrop.hidden) return;

      event.preventDefault();
      markInteraction();
      const wx = -event.deltaX * WHEEL_SCALE;
      const wy = -event.deltaY * WHEEL_SCALE;

      if (reduceMotion) {
        x += wx;
        y += wy;
        apply();
        return;
      }

      x += wx * WHEEL_IMMEDIATE;
      y += wy * WHEEL_IMMEDIATE;
      vx = vx * (1 - WHEEL_VELOCITY_BLEND) + wx * WHEEL_VELOCITY_BLEND;
      vy = vy * (1 - WHEEL_VELOCITY_BLEND) + wy * WHEEL_VELOCITY_BLEND;
    },
    { passive: false },
  );

  const onResize = () => measure();
  window.addEventListener('resize', onResize);

  // Focusing an off-screen tile makes the browser scroll this clipped stage,
  // which knocks the transform-based layout out of place. Position is owned by
  // x/y; keyboard focus is brought into view via reveal() instead.
  stage.addEventListener('scroll', () => {
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
  });

  const resizeObserver = new ResizeObserver(() => {
    measure();
  });
  resizeObserver.observe(stage);
  track.querySelectorAll('.immersive-unit').forEach((unit) => resizeObserver.observe(unit));

  function onVisibilityChange() {
    if (document.hidden) {
      ambientStrength = 0;
      ambientVx = 0;
      ambientVy = 0;
      return;
    }
    lastInteractionAt = Date.now();
  }

  return {
    start() {
      measure();
      document.addEventListener('visibilitychange', onVisibilityChange);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    },
    remeasure() {
      return measure({ resetPosition: !hasLayout });
    },
    // Pan the least distance that brings one of `elements` fully into view.
    reveal(elements) {
      const bounds = stage.getBoundingClientRect();
      let best = null;
      elements.forEach((el) => {
        const r = el.getBoundingClientRect();
        const axis = (start, end, min, max) => {
          if (start < min + REVEAL_MARGIN) return min + REVEAL_MARGIN - start;
          if (end > max - REVEAL_MARGIN) return max - REVEAL_MARGIN - end;
          return 0;
        };
        const dx = axis(r.left, r.right, bounds.left, bounds.right);
        const dy = axis(r.top, r.bottom, bounds.top, bounds.bottom);
        if (!best || Math.hypot(dx, dy) < Math.hypot(best.dx, best.dy)) best = { dx, dy };
      });
      if (!best || (!best.dx && !best.dy)) return;
      markInteraction();
      vx = 0;
      vy = 0;
      if (reduceMotion) {
        x = wrapAxis(x + best.dx, unitW);
        y = wrapAxis(y + best.dy, unitH);
        apply();
        return;
      }
      panX = best.dx;
      panY = best.dy;
    },
    wasMoved() {
      return moved;
    },
    isDragging() {
      return panning;
    },
    isAmbientActive() {
      return ambientStrength > 0.01;
    },
    getAmbientStrength() {
      return ambientStrength;
    },
    destroy() {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    },
  };
}

let dragController = null;
let parallaxController = null;

function createImmersiveParallax({ stage, track, isDragging, getAmbientStrength }) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { destroy() {} };
  }

  const mouse = { x: 0, y: 0 };
  let raf = 0;
  let active = false;

  const floats = [...track.querySelectorAll('.gallery__cell')].map((cell) => ({
    el: cell.querySelector('.gallery__frame'),
    depth: parseFloat(cell.dataset.depth) || 0.4,
    phase: (parseInt(cell.dataset.slot, 10) || 1) * 1.7,
    current: { x: 0, y: 0 },
  })).filter((item) => item.el);

  function updateMouse(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    mouse.x = (clientX - cx) / (rect.width * 0.5);
    mouse.y = (clientY - cy) / (rect.height * 0.5);
  }

  function onMouseMove(event) {
    updateMouse(event.clientX, event.clientY);
  }

  function onTouchMove(event) {
    if (!event.touches?.[0]) return;
    updateMouse(event.touches[0].clientX, event.touches[0].clientY);
  }

  function tick(now) {
    if (!active) {
      raf = 0;
      return;
    }

    // Freeze the source tile while the artwork detail view owns the interaction.
    if (document.body.classList.contains('is-modal-open')) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const rect = stage.getBoundingClientRect();
    const dragging = isDragging();
    const ambient = document.hidden ? 0 : (getAmbientStrength?.() ?? 0);

    floats.forEach(({ el, depth, phase, current }) => {
      let targetX = 0;
      let targetY = 0;

      if (!dragging) {
        const strength = (depth * PARALLAX_SENSITIVITY) / 20;
        targetX = mouse.x * rect.width * strength;
        targetY = mouse.y * rect.height * strength;

        const amp = depth * FLOAT_AMPLITUDE * ambient;
        targetX += Math.sin(now * FLOAT_SPEED + phase) * amp;
        targetY += Math.cos(now * FLOAT_SPEED * 1.3 + phase) * amp;
      }

      current.x += (targetX - current.x) * PARALLAX_EASING;
      current.y += (targetY - current.y) * PARALLAX_EASING;
      el.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
    });

    raf = requestAnimationFrame(tick);
  }

  function activate() {
    if (active) return;
    active = true;
    stage.addEventListener('mousemove', onMouseMove, { passive: true });
    stage.addEventListener('touchmove', onTouchMove, { passive: true });
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function deactivate() {
    active = false;
    stage.removeEventListener('mousemove', onMouseMove);
    stage.removeEventListener('touchmove', onTouchMove);
    cancelAnimationFrame(raf);
    raf = 0;
    floats.forEach(({ el, current }) => {
      current.x = 0;
      current.y = 0;
      el.style.transform = '';
    });
  }

  return {
    start: activate,
    stop: deactivate,
    destroy: deactivate,
  };
}

function isInView(element) {
  const r = element.getBoundingClientRect();
  return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
}

function getModalCell(track, cell) {
  if (!cell) return null;
  if (cell.closest('.immersive-unit--source')) return cell;
  const slot = cell.dataset.slot;
  if (!slot) return null;
  return track.querySelector(`.immersive-unit--source .gallery__cell[data-slot="${slot}"]`);
}

export async function initImmersiveGallery() {
  const stage = document.getElementById('immersiveStage');
  const track = document.getElementById('immersiveTrack');
  if (!stage || !track || track.dataset.ready === 'true') return;

  const res = await fetch('data/gallery.json');
  if (!res.ok) throw new Error('Failed to load gallery data');
  const data = await res.json();
  const worksById = new Map(data.works.map((work) => [work.id, work]));

  const sourceUnit = buildUnit(worksById);
  track.replaceChildren();

  for (let i = 0; i < REPEAT * REPEAT; i += 1) {
    track.appendChild(cloneUnit(sourceUnit, { source: i === Math.floor((REPEAT * REPEAT) / 2) }));
  }

  dragController = createDragController({ stage, track });
  dragController.start();

  parallaxController?.destroy();
  parallaxController = createImmersiveParallax({
    stage,
    track,
    isDragging: () => dragController.isDragging(),
    getAmbientStrength: () => dragController.getAmbientStrength(),
  });
  parallaxController.start();

  track.addEventListener('pointerover', (event) => {
    positionCaption(event.target.closest?.('.gallery__cell'));
  });

  // Keyboard focus: highlight every copy of the focused tile (the visible one
  // may be a clone) and pan the nearest copy into view.
  function setKeyboardFocus(cell) {
    track.querySelectorAll('.gallery__cell.is-keyboard-focus')
      .forEach((el) => el.classList.remove('is-keyboard-focus'));
    if (!cell) return;
    const copies = [...track.querySelectorAll(`.gallery__cell[data-slot="${cell.dataset.slot}"]`)];
    copies.forEach((el) => {
      el.classList.add('is-keyboard-focus');
      positionCaption(el);
    });
    // Measure after the stage's focus-scroll has been reset
    requestAnimationFrame(() => {
      dragController.reveal(copies.map((el) => el.querySelector('img') ?? el));
    });
  }

  track.addEventListener('focusin', (event) => {
    const cell = event.target.closest('.gallery__cell');
    if (!matchMedia(HOVER_FEEDBACK_QUERY).matches) return;
    if (cell?.matches(':focus-visible')) setKeyboardFocus(cell);
  });
  track.addEventListener('focusout', (event) => {
    if (!track.contains(event.relatedTarget)) setKeyboardFocus(null);
  });

  track.addEventListener('click', (event) => {
    if (dragController.wasMoved()) return;
    const cell = event.target.closest('.gallery__cell');
    if (!cell || !track.contains(cell)) return;
    const modalCell = getModalCell(track, cell);
    if (!modalCell || modalCell.classList.contains('is-filtered-out')) return;
    // From the keyboard the focused tile may be off-screen while a copy is
    // visible; fly from the visible copy.
    const source = cell.classList.contains('is-keyboard-focus')
      ? [...track.querySelectorAll('.gallery__cell.is-keyboard-focus')].find(isInView) ?? cell
      : cell;
    window.__artModal?.open(modalCell, source);
  });

  initGalleryFilters({
    filterRoot: document.getElementById('immersiveFilters'),
    getCells: () => [...track.querySelectorAll('.gallery__cell')],
  });

  track.dataset.ready = 'true';
}

export function layoutImmersiveGallery() {
  return dragController?.remeasure() ?? false;
}
