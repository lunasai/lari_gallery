export function initGalleryFilters({
  filterRoot,
  getCells,
  emptyEl = null,
  onApply = null,
}) {
  if (!filterRoot) return null;

  const available = filterRoot.querySelector('.gallery__available input[type="checkbox"]');
  const filters = filterRoot.querySelectorAll('.gallery__filter');
  if (!filters.length) return null;

  let activeFilter = null;

  function applyFilters() {
    const cells = typeof getCells === 'function' ? getCells() : [];
    let visibleCount = 0;
    const onlyAvailable = available?.checked ?? false;

    cells.forEach((cell) => {
      const matchCategory = !activeFilter || cell.dataset.filter === activeFilter;
      const matchAvailable = !onlyAvailable || cell.dataset.available === 'true';
      const show = matchCategory && matchAvailable;

      cell.classList.toggle('is-filtered-out', !show);
      cell.setAttribute('aria-hidden', show ? 'false' : 'true');
      cell.tabIndex = show ? 0 : -1;
      if (show) visibleCount += 1;
    });

    if (emptyEl) {
      emptyEl.hidden = visibleCount > 0;
    }

    onApply?.(visibleCount);
    window.__artModal?.syncWithFilters?.();
  }

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      const isActive = btn.classList.contains('is-active');
      filters.forEach((f) => f.classList.remove('is-active'));

      if (isActive) {
        activeFilter = null;
      } else {
        activeFilter = btn.dataset.filter;
        btn.classList.add('is-active');
      }

      applyFilters();
    });
  });

  if (available) {
    available.addEventListener('change', applyFilters);
  }

  return { applyFilters };
}
