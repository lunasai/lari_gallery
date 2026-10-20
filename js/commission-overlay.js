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
  let returnFocus = null;
  const panel = overlay.querySelector('.commission-overlay__panel');
  const closeButton = document.getElementById('commissionClose');

  function setOpen(open) {
    if (open === isOpen) return;
    isOpen = open;

    if (open) {
      window.closeMobileMenu?.();
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      window.__setNavActive?.('commission');
      returnFocus = document.activeElement;
      overlay.scrollTop = 0;
      requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        closeButton?.focus({ preventScroll: true });
      });
      return;
    }

    overlay.classList.remove('is-open');
    restoreNavActive();
    if (overlay.contains(document.activeElement)) {
      returnFocus?.focus?.({ preventScroll: true });
    }

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

  let previousHash = '';

  function openCommissionOverlay() {
    if (isOpen) return;
    if (location.hash !== '#commission') {
      previousHash = location.hash;
      history.pushState(null, '', '#commission');
    }
    setOpen(true);
  }

  function closeCommissionOverlay() {
    if (!isOpen) return;
    setOpen(false);
    if (location.hash === '#commission') {
      // Back to the view it was opened from (About stays About on reload).
      history.replaceState(null, '', location.pathname + location.search + previousHash);
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

  closeButton?.addEventListener('click', closeCommissionOverlay);

  // A click on the frosted area around the panel closes it.
  overlay.addEventListener('click', (event) => {
    if (!panel?.contains(event.target)) closeCommissionOverlay();
  });

  document.addEventListener('keydown', (event) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeCommissionOverlay();
      return;
    }
    // Keep Tab inside the dialog.
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('a[href], button, input, select, textarea')]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });


  window.openCommissionOverlay = openCommissionOverlay;
  window.closeCommissionOverlay = closeCommissionOverlay;
  window.isCommissionOverlayOpen = () => isOpen;
}

// No backend yet: "Send" opens the visitor's mail app with the enquiry
// written out, addressed to Larissa. Used by the overlay and About's closing form.
function initCommissionForm(form) {
  const email = form.querySelector('[name="email"]');
  const service = form.querySelector('[name="service"]');
  const message = form.querySelector('[name="message"]');
  const send = form.querySelector('.art-form__send');
  const status = form.querySelector('.art-form__status');
  if (!email || !send) return;

  const isValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
  const sync = () => send.setAttribute('aria-disabled', String(!isValid()));
  email.addEventListener('input', sync);
  sync();

  initArtChoice(form.querySelector('.art-choice'));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!isValid()) {
      status.textContent = 'Please add your email so I can reply.';
      email.focus();
      return;
    }
    const choice = service?.value;
    const subject = choice ? `Commission enquiry: ${choice.toLowerCase()}` : 'Commission enquiry';
    const body = [
      message?.value.trim(),
      choice ? `I'm thinking of: ${choice.toLowerCase()}` : '',
      `Reply to: ${email.value.trim()}`,
    ].filter(Boolean).join('\n\n');
    window.location.href = `mailto:oi.larissasan@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Your mail app should open with your message ready to send.';
  });
}

// "I'm thinking of": a button that unfolds the options below it; picking one
// fills the button and folds the list away again.
function initArtChoice(choice) {
  if (!choice) return;
  const toggle = choice.querySelector('.art-choice__toggle');
  const label = choice.querySelector('.art-choice__value');
  const input = choice.querySelector('input[name="service"]');
  const options = [...choice.querySelectorAll('.art-choice__option')];
  const placeholder = label.textContent;
  let closeTimer = 0;

  function setOpen(open) {
    clearTimeout(closeTimer);
    choice.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    options.forEach((option) => { option.tabIndex = open ? 0 : -1; });
  }

  toggle.addEventListener('click', () => setOpen(!choice.classList.contains('is-open')));

  options.forEach((option) => {
    option.tabIndex = -1;
    option.setAttribute('aria-pressed', 'false');
    option.addEventListener('click', () => {
      const same = input.value === option.dataset.value;
      input.value = same ? '' : option.dataset.value; // a second tap clears it
      options.forEach((o) => o.setAttribute('aria-pressed', String(o === option && !same)));
      label.textContent = input.value || placeholder;
      toggle.classList.toggle('is-empty', !input.value);
      // Let the choice register before the list folds away.
      closeTimer = setTimeout(() => {
        setOpen(false);
        toggle.focus({ preventScroll: true });
      }, 320);
    });
  });

  choice.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !choice.classList.contains('is-open')) return;
    event.stopPropagation(); // fold the list, don't close the overlay
    setOpen(false);
    toggle.focus();
  });
}

document.querySelectorAll('form[data-commission-form]').forEach(initCommissionForm);

// About's closing section: "Tell me your idea" unfolds the form beneath it.
function initFormReveal() {
  const section = document.querySelector('.about-cta');
  const button = section?.querySelector('.about-cta__open');
  const reveal = section?.querySelector('.about-cta__reveal');
  if (!button || !reveal) return;

  button.addEventListener('click', () => {
    const open = !section.classList.contains('is-open');
    section.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    reveal.inert = !open;
    if (!open) return;
    // Glide down with the unfolding form so all of it ends up in view. The
    // page is often already at its bottom, so wait until the form has grown
    // most of the way (and the scroll limit with it) before setting off.
    const header = document.getElementById('appShell')?.offsetHeight ?? 0;
    const target = section.querySelector('.about-cta__actions');
    const glide = () => {
      if (!section.classList.contains('is-open')) return;
      if (window.__lenis) {
        window.__lenis.resize();
        window.__lenis.scrollTo(target, { offset: -(header + 32), duration: 1.1 });
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    setTimeout(() => {
      glide();
      reveal.querySelector('.art-choice__toggle, input')?.focus({ preventScroll: true });
    }, 380);
    // Re-aim once fully open, in case the first glide was cut short by the
    // page's (then shorter) scroll limit.
    // (The fields' own transitions bubble up here too; wait for the panel's.)
    const onEnd = (event) => {
      if (event.target !== reveal) return;
      reveal.removeEventListener('transitionend', onEnd);
      glide();
    };
    reveal.addEventListener('transitionend', onEnd);
  });
}

initFormReveal();

initCommissionOverlay();
