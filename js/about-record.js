// About → exhibitions & workshops list.
// Hovering a row shows its event photo in a fixed column, following the
// cursor vertically. Rows whose photo is missing simply show no image.

const rows = document.querySelectorAll('.record__row');
const float = document.getElementById('recordFloat');
const floatImg = float?.querySelector('img');

rows.forEach((row) => {
  const thumb = row.querySelector('.record__thumb');
  if (!thumb) return;
  const drop = () => {
    thumb.remove();
    row.dataset.img = '';
  };
  // The photo may already have failed before this module ran.
  if (thumb.complete && !thumb.naturalWidth && thumb.getAttribute('src')) drop();
  else thumb.addEventListener('error', drop);
});

const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Follow the cursor vertically, but keep the whole photo below the nav bar.
function placeFloat(y) {
  const half = float.offsetHeight / 2;
  const navBottom = document.getElementById('appShell')?.getBoundingClientRect().bottom ?? 0;
  const min = navBottom + half + 16;
  const max = window.innerHeight - half - 16;
  float.style.top = `${Math.max(min, Math.min(max, y))}px`;
}

// Show the photo of whichever row is under the cursor. Checked on mouse
// move and on scroll, so it stays right while Lenis eases the page under a
// still cursor.
if (float && floatImg && canHover) {
  let pointer = null;
  let queued = false;

  const hide = () => float.classList.remove('is-on');

  const update = () => {
    queued = false;
    if (!pointer) return;
    const row = document.elementFromPoint(pointer.x, pointer.y)?.closest('.record__row');
    const src = row?.dataset.img;
    if (!src) return hide();

    placeFloat(pointer.y);
    if (floatImg.getAttribute('src') !== src) {
      hide();
      floatImg.src = src;
    }
    if (floatImg.complete && floatImg.naturalWidth) float.classList.add('is-on');
    else floatImg.onload = () => queueUpdate();
  };

  const queueUpdate = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  document.addEventListener('mousemove', (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    queueUpdate();
  }, { passive: true });
  window.addEventListener('scroll', queueUpdate, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => {
    pointer = null;
    hide();
  });
}
