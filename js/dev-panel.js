// ── Dev panel ─────────────────────────────────
// Live-tweak fonts and immersive gallery spacing in the browser.
// Only runs on localhost (or with ?dev in the URL). Values persist in
// localStorage; "Copy CSS" gives a snippet to paste into style.css.

const IS_DEV = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  || new URLSearchParams(location.search).has('dev');

const STORAGE_KEY = 'lari:dev-panel';

// weights = the weights actually loaded (Google Fonts URL / local @font-face)
const FONTS = {
  spectral: { label: 'Spectral', stack: "'Spectral', serif", tracking: -0.05,
              weights: [300, 400, 500, 600, 700, 800] },
  clash:    { label: 'Clash Display', stack: "'Clash Display', sans-serif", tracking: -0.01,
              weights: [200, 300, 400, 500, 600, 700] },
  dmsans:   { label: 'DM Sans', stack: "'DM Sans', sans-serif", tracking: 0,
              weights: [300, 400, 500] },
};

const DEFAULTS = {
  open: false,
  displayFont: 'clash',
  bodyFont: 'dmsans',
  tracking: FONTS.clash.tracking,
  displayWeight: 'auto', // 'auto' = per-element weights from style.css
  bodyWeight: 'auto',
  columns: 4, // desktop defaults; untouched knobs keep the per-breakpoint values
  gap: 64,
  stagger: 160,
};

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// state key → [CSS custom property, value formatter]
const VARS = {
  displayFont: ['--font-serif', (v) => FONTS[v].stack],
  bodyFont:    ['--font-body', (v) => FONTS[v].stack],
  tracking:    ['--font-serif-tracking', (v) => `${v}em`],
  columns:     ['--gallery-columns', (v) => `${v}`],
  gap:         ['--gallery-gap', (v) => `${v}px`],
  stagger:     ['--gallery-stagger', (v) => `${v}px`],
};

function cssVars(state) {
  return Object.fromEntries(
    Object.entries(VARS).map(([key, [prop, fmt]]) => [prop, fmt(state[key])])
  );
}

// Weights are set per rule in style.css, so a variable can't override them.
// Instead, find every rule that uses the display font and force a weight on
// those elements (and the body font on everything else).
let displaySelectors = null;

function getDisplaySelectors() {
  if (displaySelectors) return displaySelectors;
  const found = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin (Google Fonts)
    for (const rule of rules) {
      const family = rule.style?.fontFamily || '';
      if (/--font-(serif|display)/.test(family)) found.push(rule.selectorText);
    }
  }
  displaySelectors = found.join(', ');
  return displaySelectors;
}

function weightCss(state) {
  const sel = getDisplaySelectors();
  const out = [];
  if (state.displayWeight !== 'auto' && sel) {
    out.push(`:is(${sel}), :is(${sel}) * { font-weight: ${state.displayWeight} !important; }`);
  }
  if (state.bodyWeight !== 'auto') {
    const notDisplay = sel ? `:not(:is(${sel}), :is(${sel}) *)` : '';
    out.push(`body, body *${notDisplay}:not(.dev-panel, .dev-panel *) { font-weight: ${state.bodyWeight} !important; }`);
  }
  return out.join('\n');
}

let weightStyle = null;

function apply(state) {
  if (!weightStyle) {
    weightStyle = document.createElement('style');
    weightStyle.dataset.devPanel = 'weights';
    document.head.appendChild(weightStyle);
  }
  weightStyle.textContent = weightCss(state);

  const root = document.documentElement.style;
  // Untouched knobs fall back to the stylesheet (keeps responsive breakpoints intact)
  Object.entries(VARS).forEach(([key, [prop, fmt]]) => {
    if (state[key] === DEFAULTS[key]) root.removeProperty(prop);
    else root.setProperty(prop, fmt(state[key]));
  });
  // The masonry layout is computed in JS, so ask it to re-run
  window.dispatchEvent(new CustomEvent('lari:gallery-layout'));
}

const STYLES = `
.dev-panel { position: fixed; right: 16px; bottom: 16px; z-index: 10000;
  font: 12px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif; color: #1a1916;
  letter-spacing: 0; }
.dev-panel__toggle { margin-left: auto; display: block; padding: 6px 12px; border-radius: 999px;
  border: 1px solid rgba(26,25,22,.2); background: rgba(244,240,231,.9); cursor: pointer;
  font: inherit; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.dev-panel__body { width: 260px; margin-bottom: 8px; padding: 14px; border-radius: 12px;
  background: rgba(244,240,231,.94); border: 1px solid rgba(26,25,22,.12);
  box-shadow: 0 8px 32px rgba(26,25,22,.12); backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px); display: grid; gap: 10px; }
.dev-panel__body[hidden] { display: none; }
.dev-panel h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .08em;
  font-weight: 600; opacity: .55; margin-top: 4px; }
.dev-panel label { display: grid; gap: 4px; }
.dev-panel__row { display: flex; justify-content: space-between; }
.dev-panel__row output { font-variant-numeric: tabular-nums; opacity: .7; }
.dev-panel select, .dev-panel input[type=range] { width: 100%; font: inherit; }
.dev-panel select { padding: 4px 6px; border-radius: 6px; border: 1px solid rgba(26,25,22,.2);
  background: #fff; }
.dev-panel__actions { display: flex; gap: 6px; margin-top: 4px; }
.dev-panel__actions button { flex: 1; padding: 6px; border-radius: 6px; cursor: pointer; font: inherit;
  border: 1px solid rgba(26,25,22,.2); background: #fff; }
`;

function weightOptions(fontId, selected) {
  return ['auto', ...FONTS[fontId].weights]
    .map((w) => `<option value="${w}"${String(w) === String(selected) ? ' selected' : ''}>${w === 'auto' ? 'Default (per element)' : w}</option>`)
    .join('');
}

function fontOptions(selected) {
  return Object.entries(FONTS)
    .map(([id, f]) => `<option value="${id}"${id === selected ? ' selected' : ''}>${f.label}</option>`)
    .join('');
}

function slider(key, label, min, max, step, unit) {
  return `
    <label>
      <span class="dev-panel__row"><span>${label}</span><output data-out="${key}"></output></span>
      <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" data-unit="${unit}" />
    </label>`;
}

function init() {
  let state = load();
  apply(state);

  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'dev-panel';
  panel.setAttribute('data-lenis-prevent', '');
  panel.innerHTML = `
    <div class="dev-panel__body" ${state.open ? '' : 'hidden'}>
      <h3>Typography</h3>
      <label>Display / serif font
        <select data-key="displayFont">${fontOptions(state.displayFont)}</select>
      </label>
      <label>Body font
        <select data-key="bodyFont">${fontOptions(state.bodyFont)}</select>
      </label>
      <label>Display weight
        <select data-key="displayWeight">${weightOptions(state.displayFont, state.displayWeight)}</select>
      </label>
      <label>Body weight
        <select data-key="bodyWeight">${weightOptions(state.bodyFont, state.bodyWeight)}</select>
      </label>
      ${slider('tracking', 'Display tracking', -0.1, 0.05, 0.005, 'em')}
      <h3>Gallery layout</h3>
      ${slider('columns', 'Columns', 2, 6, 1, '')}
      ${slider('gap', 'Gap', 0, 160, 2, 'px')}
      ${slider('stagger', 'Column stagger', 0, 400, 4, 'px')}
      <div class="dev-panel__actions">
        <button type="button" data-action="copy">Copy CSS</button>
        <button type="button" data-action="reset">Reset</button>
      </div>
    </div>
    <button type="button" class="dev-panel__toggle" aria-expanded="${state.open}">dev</button>
  `;
  document.body.appendChild(panel);

  const body = panel.querySelector('.dev-panel__body');
  const toggle = panel.querySelector('.dev-panel__toggle');

  function sync() {
    // Weight lists depend on the selected font
    panel.querySelector('[data-key="displayWeight"]').innerHTML = weightOptions(state.displayFont, state.displayWeight);
    panel.querySelector('[data-key="bodyWeight"]').innerHTML = weightOptions(state.bodyFont, state.bodyWeight);
    panel.querySelectorAll('[data-key]').forEach((el) => {
      el.value = state[el.dataset.key];
    });
    panel.querySelectorAll('[data-out]').forEach((el) => {
      const input = panel.querySelector(`[data-key="${el.dataset.out}"]`);
      el.textContent = `${state[el.dataset.out]}${input.dataset.unit}`;
    });
  }

  function update(patch) {
    state = { ...state, ...patch };
    apply(state);
    save(state);
    sync();
  }

  panel.addEventListener('input', (e) => {
    const key = e.target.dataset.key;
    if (!key) return;
    if (e.target.tagName === 'SELECT') {
      const value = e.target.value;
      const patch = { [key]: /^\d+$/.test(value) ? Number(value) : value };
      // Switching the display font resets tracking to that font's sensible default
      if (key === 'displayFont') patch.tracking = FONTS[value].tracking;
      // Drop a weight the newly chosen font doesn't have
      if (key === 'displayFont' && !FONTS[value].weights.includes(state.displayWeight)) patch.displayWeight = 'auto';
      if (key === 'bodyFont' && !FONTS[value].weights.includes(state.bodyWeight)) patch.bodyWeight = 'auto';
      update(patch);
    } else {
      update({ [key]: Number(e.target.value) });
    }
  });

  panel.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'reset') update({ ...DEFAULTS, open: true });
    if (action === 'copy') {
      const weights = [
        state.displayWeight !== 'auto' && `/* display font-weight: ${state.displayWeight} */`,
        state.bodyWeight !== 'auto' && `/* body font-weight: ${state.bodyWeight} */`,
      ].filter(Boolean).join('\n');
      const css = `:root {\n${Object.entries(cssVars(state)).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}${weights ? `\n${weights}` : ''}`;
      try {
        await navigator.clipboard.writeText(css);
        e.target.textContent = 'Copied!';
      } catch {
        console.log(css);
        e.target.textContent = 'See console';
      }
      setTimeout(() => { e.target.textContent = 'Copy CSS'; }, 1200);
    }
  });

  toggle.addEventListener('click', () => {
    body.hidden = !body.hidden;
    toggle.setAttribute('aria-expanded', String(!body.hidden));
    update({ open: !body.hidden });
  });

  // Keep drags/clicks inside the panel from reaching the gallery drag controller
  ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach((type) => {
    panel.addEventListener(type, (e) => e.stopPropagation());
  });

  sync();
}

// Spectral is only a dev-panel option, so only the panel loads it.
function loadDevFonts() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap';
  document.head.appendChild(link);
}

if (IS_DEV) {
  loadDevFonts();
  init();
}
