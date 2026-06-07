function restoreNavActive() {
  if (document.body.classList.contains('is-immersive-view')) {
    window.__setNavActive?.('immersive');
  } else {
    window.__setNavActive?.('home');
  }
}

function initCommissionOverlay() {
  const overlay = document.getElementById('commissionOverlay');
  if (!overlay) return;

  let isOpen = false;

  function setOpen(open) {
    if (open === isOpen) return;
    isOpen = open;

    if (open) {
      window.closeMobileMenu?.();
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      window.__setNavActive?.('commission');
      requestAnimationFrame(() => overlay.classList.add('is-open'));
      return;
    }

    overlay.classList.remove('is-open');
    restoreNavActive();

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

  function openCommissionOverlay() {
    if (isOpen) return;
    if (location.hash !== '#commission') {
      history.pushState(null, '', '#commission');
    }
    setOpen(true);
  }

  function closeCommissionOverlay() {
    if (!isOpen) return;
    setOpen(false);
    if (location.hash === '#commission') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  document.querySelectorAll('a[href="#commission"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (isOpen) {
        closeCommissionOverlay();
      } else {
        openCommissionOverlay();
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen) return;
    event.stopPropagation();
    closeCommissionOverlay();
  });

  window.openCommissionOverlay = openCommissionOverlay;
  window.closeCommissionOverlay = closeCommissionOverlay;
  window.isCommissionOverlayOpen = () => isOpen;
}

initCommissionOverlay();
