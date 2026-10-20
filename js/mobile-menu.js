function initMobileMenu() {
  const burger = document.getElementById('navBurger');
  const overlay = document.getElementById('navOverlay');
  if (!burger || !overlay) return;

  const LABEL = { closed: 'menu', open: 'close' };
  let openFrame = 0;

  function setOpen(isOpen) {
    burger.setAttribute('aria-expanded', String(isOpen));
    burger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    burger.textContent = isOpen ? LABEL.open : LABEL.closed;

    if (isOpen) {
      window.closeCommissionOverlay?.();
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      openFrame = requestAnimationFrame(() => overlay.classList.add('is-open'));
      return;
    }

    cancelAnimationFrame(openFrame);
    overlay.classList.remove('is-open');
    const finish = () => {
      if (burger.getAttribute('aria-expanded') === 'true' || overlay.hidden) return;
      overlay.hidden = true;
      // Commission may have opened from the menu and locked the page itself.
      if (!document.body.classList.contains('is-immersive-view') && !window.isCommissionOverlayOpen?.()) {
        document.body.style.overflow = '';
      }
    };
    overlay.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 500); // no transition runs if it never finished opening
  }

  // Also closes a menu that is still fading in (a quick tap on a link).
  function closeMenu() {
    if (burger.getAttribute('aria-expanded') !== 'true') return;
    setOpen(false);
  }

  window.closeMobileMenu = closeMenu;

  burger.addEventListener('click', () => {
    setOpen(burger.getAttribute('aria-expanded') !== 'true');
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
