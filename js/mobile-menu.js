function initMobileMenu() {
  const burger = document.getElementById('navBurger');
  const overlay = document.getElementById('navOverlay');
  if (!burger || !overlay) return;

  const LABEL = { closed: 'menu', open: 'close' };

  function setOpen(isOpen) {
    burger.setAttribute('aria-expanded', String(isOpen));
    burger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    burger.textContent = isOpen ? LABEL.open : LABEL.closed;

    if (isOpen) {
      window.closeCommissionOverlay?.();
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => overlay.classList.add('is-open'));
      return;
    }

    overlay.classList.remove('is-open');
    overlay.addEventListener(
      'transitionend',
      () => {
        overlay.hidden = true;
        if (!document.body.classList.contains('is-immersive-view')) {
          document.body.style.overflow = '';
        }
      },
      { once: true }
    );
  }

  function closeMenu() {
    if (overlay.hidden || !overlay.classList.contains('is-open')) return;
    setOpen(false);
  }

  window.closeMobileMenu = closeMenu;

  burger.addEventListener('click', () => {
    setOpen(!overlay.classList.contains('is-open'));
  });

  overlay.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (window.isCommissionOverlayOpen?.()) return;
    closeMenu();
  });
}

initMobileMenu();
