const STORAGE_KEY = 'lari:grid-overlay';

function getColumnCount() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--grid-columns');
  return parseInt(value, 10) || 8;
}

function buildColumns(container, count) {
  container.replaceChildren();
  container.style.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;

  for (let i = 0; i < count; i += 1) {
    const col = document.createElement('div');
    col.className = 'grid-overlay__col';
    col.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'grid-overlay__label';
    label.textContent = String(i + 1);
    col.appendChild(label);

    container.appendChild(col);
  }
}

function syncColumns(container) {
  buildColumns(container, getColumnCount());
}

function isTypingTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable
  );
}

const overlay = document.createElement('div');
overlay.className = 'grid-overlay';
overlay.id = 'gridOverlay';
overlay.setAttribute('aria-hidden', 'true');

const columns = document.createElement('div');
columns.className = 'grid-overlay__columns';
overlay.appendChild(columns);

const toggle = document.createElement('button');
toggle.type = 'button';
toggle.className = 'grid-toggle';
toggle.id = 'gridToggle';
toggle.setAttribute('aria-pressed', 'false');
toggle.setAttribute('aria-label', 'Toggle layout grid overlay');
toggle.title = 'Toggle grid (Shift+G)';
toggle.textContent = 'Grid';

document.body.appendChild(overlay);
document.body.appendChild(toggle);

syncColumns(columns);

function setVisible(visible) {
  document.body.classList.toggle('is-grid-visible', visible);
  overlay.setAttribute('aria-hidden', String(!visible));
  toggle.setAttribute('aria-pressed', String(visible));
  toggle.classList.toggle('is-active', visible);

  try {
    sessionStorage.setItem(STORAGE_KEY, visible ? '1' : '0');
  } catch {
    /* ignore storage errors */
  }
}

function toggleVisible() {
  setVisible(!document.body.classList.contains('is-grid-visible'));
}

toggle.addEventListener('click', toggleVisible);

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'g' || !event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }
  if (isTypingTarget(event.target)) return;

  event.preventDefault();
  toggleVisible();
});

window.addEventListener('resize', () => syncColumns(columns));

try {
  if (sessionStorage.getItem(STORAGE_KEY) === '1') {
    setVisible(true);
  }
} catch {
  /* ignore storage errors */
}
