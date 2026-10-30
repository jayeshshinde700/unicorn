/* Unicon Hospitality - navigation behaviour.
   Load after Bootstrap. Handles: desktop dropdowns (hover / click / keyboard / Escape / outside click),
   mobile drawer + accordions, sticky main bar. Guarded so it can never bind twice. */
(function () {
  'use strict';
  if (window.__unNavReady) return;
  window.__unNavReady = true;

  var body = document.body;
  var header = document.getElementById('unHeader');
  var drawer = document.getElementById('unDrawer');
  var burger = document.getElementById('unBurger');
  var closeBtn = document.getElementById('unDrawerClose');
  var overlay = document.getElementById('unOverlay');
  var desktop = window.matchMedia('(min-width:1200px)');
  var canHover = window.matchMedia('(hover:hover) and (pointer:fine)');

  /* ---------- desktop dropdowns ---------- */
  var items = [].slice.call(document.querySelectorAll('.un-nav__item.has-drop'));
  var timers = new WeakMap();

  function setOpen(item, open) {
    var btn = item.querySelector('.un-nav__link');
    item.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function closeAll(except) {
    items.forEach(function (it) { if (it !== except) setOpen(it, false); });
  }

  items.forEach(function (item) {
    var btn = item.querySelector('.un-nav__link');
    var links = [].slice.call(item.querySelectorAll('.un-drop a'));

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var open = !item.classList.contains('is-open');
      closeAll(item);
      setOpen(item, open);
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeAll(item);
        setOpen(item, true);
        if (links[0]) links[0].focus();
      }
    });
    item.addEventListener('keydown', function (e) {
      var i = links.indexOf(document.activeElement);
      if (e.key === 'Escape') {
        if (item.classList.contains('is-open')) { setOpen(item, false); btn.focus(); e.stopPropagation(); }
      } else if (e.key === 'ArrowDown' && i > -1) {
        e.preventDefault(); links[(i + 1) % links.length].focus();
      } else if (e.key === 'ArrowUp' && i > -1) {
        e.preventDefault(); (i === 0 ? btn : links[i - 1]).focus();
      } else if (e.key === 'Tab' && i > -1 && ((!e.shiftKey && i === links.length - 1))) {
        setOpen(item, false);
      }
    });
    item.addEventListener('mouseenter', function () {
      if (!canHover.matches) return;
      clearTimeout(timers.get(item));
      closeAll(item);
      setOpen(item, true);
    });
    item.addEventListener('mouseleave', function () {
      if (!canHover.matches) return;
      timers.set(item, setTimeout(function () { setOpen(item, false); }, 140));
    });
    links.forEach(function (a) { a.addEventListener('click', function () { setOpen(item, false); }); });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.un-nav__item.has-drop')) closeAll();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAll(); closeDrawer(); }
  });

  /* ---------- mobile drawer ---------- */
  function openDrawer() {
    if (!drawer) return;
    body.classList.add('un-lock');
    burger.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    setTimeout(function () { closeBtn && closeBtn.focus(); }, 50);
  }
  function closeDrawer() {
    if (!drawer || !body.classList.contains('un-lock')) return;
    body.classList.remove('un-lock');
    burger.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    burger.focus({ preventScroll: true });
  }
  if (burger) burger.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  /* accordions (Book, Stay, Explore) */
  function setPanel(btn, open) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.style.maxHeight = open ? panel.scrollHeight + 'px' : '0px';
  }
  [].slice.call(document.querySelectorAll('.un-m__btn')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      setPanel(btn, btn.getAttribute('aria-expanded') !== 'true');
    });
    /* open the section that contains the current page */
    if (btn.parentNode.classList.contains('is-current')) setPanel(btn, true);
  });

  /* any link / modal trigger inside the drawer closes it (the destination or modal then opens) */
  if (drawer) {
    drawer.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (a.hasAttribute('data-bs-toggle') || href.charAt(0) !== '#' || href.length > 1) {
        body.classList.remove('un-lock');
        burger.setAttribute('aria-expanded', 'false');
        drawer.setAttribute('aria-hidden', 'true');
      }
    });
    /* simple focus trap while open */
    drawer.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = [].slice.call(drawer.querySelectorAll('a[href],button')).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* switching to desktop width: reset everything */
  function onResize() { if (desktop.matches) { body.classList.remove('un-lock'); closeAll(); } }
  if (desktop.addEventListener) desktop.addEventListener('change', onResize); else desktop.addListener(onResize);

  /* ---------- sticky main bar ---------- */
  if (header) {
    var spacer = null;
    var onScroll = function () {
      var stick = window.pageYOffset > 140;
      if (stick && !header.classList.contains('is-stuck')) {
        spacer = document.createElement('div');
        spacer.style.height = header.offsetHeight + 'px';
        header.parentNode.insertBefore(spacer, header);
        header.classList.add('is-stuck');
      } else if (!stick && header.classList.contains('is-stuck')) {
        header.classList.remove('is-stuck');
        if (spacer && spacer.parentNode) spacer.parentNode.removeChild(spacer);
        spacer = null;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
