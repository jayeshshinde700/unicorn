/* Unicorn Hospitality - Amenities page (loads only on amenities.html, after the shared site script) */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  function raf2(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }

  /* ======================================================================
     PAGE CHROME: reading progress, hero parallax, reveal
     ====================================================================== */
  var prog = $('#amProgress'), heroBg = $('#amHeroBg'), hero = $('#amHero'), ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.pageYOffset, max = document.documentElement.scrollHeight - window.innerHeight;
    if (prog) prog.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    if (heroBg && hero && y < hero.offsetHeight + 100 && !reduce) heroBg.style.setProperty('--py', (y * 0.22).toFixed(1) + 'px');
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* hero heading: split into words that rise out of a mask */
  $$('[data-split]').forEach(function (h) {
    var words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.textContent = '';
    words.forEach(function (w, i) {
      var outer = document.createElement('span'), inner = document.createElement('span');
      outer.className = 'am-w'; outer.setAttribute('aria-hidden', 'true');
      inner.textContent = w; inner.style.setProperty('--i', i);
      outer.appendChild(inner);
      if (i) h.appendChild(document.createTextNode(' '));
      h.appendChild(outer);
    });
  });
  raf2(function () { if (hero) hero.classList.add('is-in'); });

  /* scroll reveal */
  var io = null;
  function observeReveal(els) {
    if ('IntersectionObserver' in window) {
      io = io || new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
      els.forEach(function (el) { io.observe(el); });
    } else els.forEach(function (el) { el.classList.add('is-in'); });
  }
  observeReveal($$('[data-am]'));
  observeReveal($$('.am-hl__box, .am-tl'));

  /* smooth jump to a section, leaving room for the sticky header */
  function scrollToEl(el) {
    var header = $('.header__function'), off = (header ? header.offsetHeight : 78) + 14;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - off, behavior: reduce ? 'auto' : 'smooth' });
  }
  $$('[data-jump]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = $(a.getAttribute('data-jump'));
      if (t) { e.preventDefault(); scrollToEl(t); }
    });
  });

  /* ======================================================================
     HERO BUBBLES (pool theme)
     ====================================================================== */
  var bub = $('#amBubbles');
  if (bub && !reduce) {
    for (var i = 0; i < 14; i++) {
      var b = document.createElement('i'), s = 6 + Math.random() * 20;
      b.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
      b.style.setProperty('--s', s.toFixed(1) + 'px');
      b.style.setProperty('--t', (11 + Math.random() * 14).toFixed(1) + 's');
      b.style.setProperty('--dl', (-Math.random() * 20).toFixed(1) + 's');
      bub.appendChild(b);
    }
  }

  /* ======================================================================
     FACILITY CARDS: category filter, 3D tilt + cursor glow, live open/closed
     ====================================================================== */
  var grid = $('#amGrid'), cards = $$('.am-card', grid || document);
  var chips = $$('.am-chip');

  function setFilter(f) {
    var n = 0;
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === f)); });
    cards.forEach(function (card) {
      var ok = f === 'all' || (card.getAttribute('data-cat') || '').split(' ').indexOf(f) > -1;
      if (ok) n++;
      if (ok) {
        card.classList.remove('am-hide');
        raf2(function () { card.classList.remove('is-out'); });
      } else {
        card.classList.add('is-out');
        setTimeout(function () { if (card.classList.contains('is-out')) card.classList.add('am-hide'); }, reduce ? 0 : 420);
      }
    });
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { setFilter(c.getAttribute('data-filter')); }); });
  /* chip counts */
  chips.forEach(function (c) {
    var f = c.getAttribute('data-filter'), n = f === 'all' ? cards.length : cards.filter(function (card) { return (card.getAttribute('data-cat') || '').split(' ').indexOf(f) > -1; }).length;
    var s = document.createElement('small'); s.textContent = n; c.appendChild(s);
  });

  if (finePointer && !reduce) {
    cards.forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((x - 0.5) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    });
  }

  /* stagger the cards in as the grid arrives */
  cards.forEach(function (c, i) { c.setAttribute('data-am', 'up'); c.style.setProperty('--d', (i % 4) * 0.09 + 's'); });
  observeReveal(cards);

  /* "Open now" badges, from the visitor's clock. data-open="6-21" is 6:00 AM to 9:00 PM, data-open="24" is always open */
  function hoursNow() { var d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function paintOpen() {
    var h = hoursNow();
    $$('[data-open]').forEach(function (el) {
      var v = el.getAttribute('data-open'), open = true, label;
      if (v === '24') { label = 'Open 24/7'; }
      else {
        var p = v.split('-'), a = parseFloat(p[0]), z = parseFloat(p[1]);
        open = h >= a && h < z;
        label = open ? 'Open now' : 'Closed now';
      }
      var host = $('.am-live', el);
      if (!host) { host = document.createElement('span'); host.className = 'am-live'; host.innerHTML = '<i></i><span></span>'; el.insertBefore(host, el.firstChild); }
      host.classList.toggle('am-live--off', !open);
      $('span', host).textContent = label;
    });
  }
  paintOpen(); setInterval(paintOpen, 60000);

  /* ======================================================================
     DAY PLANNER: "now" marker follows the clock
     ====================================================================== */
  var tl = $('#amTl');
  function paintNow() {
    if (!tl) return;
    var h = hoursNow();
    tl.style.setProperty('--now', (h / 24).toFixed(4));
    var lab = $('.am-tl__now span', tl);
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ap = hh >= 12 ? 'PM' : 'AM', h12 = hh % 12 || 12;
    if (lab) lab.textContent = 'Now ' + h12 + ':' + pad(mm) + ' ' + ap;
  }
  paintNow(); setInterval(paintNow, 60000);

  /* ======================================================================
     COUNT-UP NUMBERS
     ====================================================================== */
  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-count')), dec = (String(to).split('.')[1] || '').length;
    if (reduce) { el.textContent = to.toFixed(dec); return; }
    var t0 = performance.now(), dur = 1700;
    (function f(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = (to * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) { cio.observe(el); });
  } else $$('[data-count]').forEach(countUp);

  /* ======================================================================
     GALLERY LIGHTBOX
     ====================================================================== */
  var lb = $('#amLb'), shots = $$('.am-shot'), cur = 0, lastFocus = null;
  function showShot(i) {
    cur = (i + shots.length) % shots.length;
    var s = shots[cur], img = $('img', s), cap = $('.am-cap', s);
    var big = $('#amLbImg');
    big.src = img.getAttribute('data-full') || img.getAttribute('src');
    big.alt = img.getAttribute('alt') || '';
    big.style.animation = 'none'; void big.offsetWidth; big.style.animation = '';
    $('#amLbCap').innerHTML = cap ? '<b style="font-weight:600">' + $('b', cap).textContent + '</b><small>' + $('small', cap).textContent + '</small>' : '';
  }
  function openLb(i) {
    lastFocus = document.activeElement; showShot(i);
    lb.classList.add('is-on'); lb.removeAttribute('aria-hidden'); document.body.classList.add('am-lock');
    $('.am-lb__x', lb).focus();
  }
  function closeLb() {
    lb.classList.remove('is-on'); lb.setAttribute('aria-hidden', 'true'); document.body.classList.remove('am-lock');
    if (lastFocus) lastFocus.focus();
  }
  if (lb) {
    shots.forEach(function (s, i) { s.addEventListener('click', function () { openLb(i); }); });
    $('.am-lb__x', lb).addEventListener('click', closeLb);
    $('.am-lb__prev', lb).addEventListener('click', function () { showShot(cur - 1); });
    $('.am-lb__next', lb).addEventListener('click', function () { showShot(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-on')) return;
      if (e.key === 'Escape') closeLb();
      else if (e.key === 'ArrowLeft') showShot(cur - 1);
      else if (e.key === 'ArrowRight') showShot(cur + 1);
    });
    var tx = null;
    lb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(dx) > 50) showShot(cur + (dx < 0 ? 1 : -1));
    });
  }

  /* ======================================================================
     FAQ: only one answer open at a time
     ====================================================================== */
  var faqs = $$('.am-faq .um-faq__item');
  faqs.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) faqs.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });
})();
