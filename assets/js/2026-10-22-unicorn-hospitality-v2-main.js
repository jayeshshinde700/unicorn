/* Unicorn Hospitality - page scripts (2026-10-22)
   Replaces the Moonlit main.js / plugins bundle. Needs Bootstrap, Swiper, WOW, Jarallax and Flatpickr (loaded from CDN in the HTML). */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- placeholder images: any <img data-ph="..."> without a src gets a labelled SVG ----
     To use a real photo, add src="assets/images/your-photo.jpg" and remove data-ph. */
  var palettes = [['#2c2c2c', '#b89b66'], ['#1c1c1c', '#8a6d48'], ['#4a4036', '#e6d6bd'], ['#161616', '#ae8b57']];
  $$('img[data-ph]').forEach(function (img, i) {
    if (img.getAttribute('src')) return;
    var w = parseInt(img.getAttribute('width'), 10) || 800;
    var h = parseInt(img.getAttribute('height'), 10) || 600;
    var p = palettes[i % palettes.length];
    var label = img.getAttribute('data-ph').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[1] + '"/></linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#g)"/>' +
      '<text x="50%" y="94%" fill="#fff" fill-opacity=".7" font-family="Arial,sans-serif" font-size="' + Math.max(10, Math.round(w / 90)) + '" text-anchor="middle">Photo placeholder - ' + label + '</text></svg>';
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });

  /* ---- preloader ---- */
  function hideLoader() {
    document.body.classList.add('loaded');
    setTimeout(function () { var l = $('.loader-wrapper'); if (l) l.style.display = 'none'; }, 1100);
  }
  if (document.readyState === 'complete') hideLoader(); else window.addEventListener('load', hideLoader);
  setTimeout(hideLoader, 3500); /* safety net */

  /* ---- year ---- */
  var yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---- sticky header (theme class: is__sticky) + back to top + mobile booking bar ---- */
  var header = $('.header__function'), top = $('#rts-back-to-top'), mbar = $('#umMbar'), book = $('#book');
  var headerH = header ? header.offsetHeight : 0, spacer;
  function onScroll() {
    var y = window.pageYOffset;
    if (header) {
      var stick = y > 140;
      if (stick && !header.classList.contains('is__sticky')) {
        spacer = spacer || document.createElement('div');
        spacer.style.height = headerH + 'px';
        header.parentNode.insertBefore(spacer, header);
        header.classList.add('is__sticky');
      } else if (!stick && header.classList.contains('is__sticky')) {
        header.classList.remove('is__sticky');
        if (spacer && spacer.parentNode) spacer.parentNode.removeChild(spacer);
      }
    }
    if (top) top.classList.toggle('show', y > 500);
    if (mbar && book) mbar.classList.toggle('is-on', book.getBoundingClientRect().bottom < 0);
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (top) top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---- WOW (scroll animations from the theme's animate keyframes) ---- */
  if (window.WOW) { try { new WOW({ live: false }).init(); } catch (e) {} }

  /* ---- Jarallax (parallax images) ---- */
  /* room cards are small, so they keep a plain image; only the large photos get parallax */
  if (window.jarallax) {
    try { jarallax($$('.jarallax:not(.room__thumbnail)'), { speed: 0.85 }); } catch (e) {}
  }

  /* ---- Swiper sliders ---- */
  if (window.Swiper) {
    /* ---- HERO SLIDER: cinematic push transition + word-by-word text reveal ----
       The animation itself is CSS (style.css, block "HERO SLIDER"). This script only:
       splits the text into words, runs the autoplay timer, the counter + progress bars, and plays the visible video.
       (Own timer + own arrow handlers, so it works even when the OS has "reduce animations" turned on.) */
    var HERO_DELAY = 3000;                       /* how long a slide rests after it has finished moving (ms) - change here */
    var HERO_SPEED = 1300;                       /* how long the slide movement takes (ms) - change here */
    function initHero() {
      var el = $('.banner__slider');
      if (!el) return;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var count = $$('.swiper-slide', el).length;

      /* 1. prepare the text: heading + paragraph become words, the button gets a wrapper (CSS animates these) */
      function split(node, masked) {
        var words = node.textContent.trim().split(/\s+/);
        node.textContent = '';
        words.forEach(function (w, i) {
          var inner = document.createElement('span'), outer = inner;
          inner.textContent = w;
          inner.style.setProperty('--i', i);
          if (masked) { outer = document.createElement('span'); outer.className = 'hw'; outer.appendChild(inner); }
          else inner.className = 'hs';
          if (i) node.appendChild(document.createTextNode(' '));
          node.appendChild(outer);
        });
      }
      $$('.banner__slide__content h1', el).forEach(function (n) { split(n, true); });
      $$('.banner__slide__content .sub__text', el).forEach(function (n) { split(n, false); });
      $$('.banner__slide__content .theme-btn', el).forEach(function (b) {
        var wrap = document.createElement('div'); wrap.className = 'hero-btn';
        b.parentNode.insertBefore(wrap, b); wrap.appendChild(b);
      });

      /* 2. counter + progress bars (built here so the page still works without this script) */
      var ui = document.createElement('div'); ui.className = 'container hero-ui-wrap';
      var nums = '', bars = '';
      for (var n = 0; n < count; n++) {
        nums += '<i>0' + (n + 1) + '</i>';
        bars += '<button type="button" class="hero-ui__bar" aria-label="Show slide ' + (n + 1) + '"><span></span></button>';
      }
      ui.innerHTML = '<div class="hero-ui"><div class="hero-ui__count" aria-hidden="true"><span class="hero-ui__num"><span class="hero-ui__strip">' + nums +
        '</span></span><em></em><span class="hero-ui__total">0' + count + '</span></div><div class="hero-ui__bars">' + bars + '</div></div>';
      el.appendChild(ui);
      var strip = $('.hero-ui__strip', ui), barEls = $$('.hero-ui__bar', ui);
      function setUi(i, ms) {
        ui.style.setProperty('--hero-t', ms + 'ms');
        strip.style.transform = 'translate3d(0,' + (-i) + 'em,0)';
        barEls.forEach(function (b, k) {
          b.classList.toggle('is-done', k < i);
          b.classList.remove('is-active');
          if (k === i) { void b.offsetWidth; b.classList.add('is-active'); }   /* reflow = restart the fill */
        });
      }

      /* 3. the slider */
      el.classList.add('hero-fx');
      var hero = new Swiper(el, {
        loop: true, speed: reduce ? 0 : HERO_SPEED, effect: 'creative',
        creativeEffect: {
          limitProgress: 1,
          prev: { translate: ['-26%', 0, -1] },                  /* old slide drifts back (the dimming is CSS) */
          next: { translate: ['100%', 0, 0] }                     /* new slide glides over it */
        },
        grabCursor: true, allowTouchMove: true,
        keyboard: { enabled: true, onlyInViewport: true },
        on: { slideChangeTransitionStart: function (sw) { onSlide(sw, HERO_SPEED + HERO_DELAY); }, slideChangeTransitionEnd: settle }
      });

      /* videos: the arriving slide starts playing when it starts moving; the old one stops once it has gone.
         The neighbours are pre-loaded so the picture is ready before the slide arrives. */
      function play(v) { if (!v) return; v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      function videoAt(sw, i) { var s = sw.slides[i]; return s && s.querySelector('video'); }
      function settle(sw) {
        var keep = videoAt(sw, sw.activeIndex);
        $$('video', el).forEach(function (v) { if (v !== keep) v.pause(); });
      }
      function warm(sw) {
        var len = sw.slides.length;
        [sw.activeIndex + 1, sw.activeIndex - 1].forEach(function (i) {
          var v = videoAt(sw, (i + len) % len); if (v && v.preload !== 'auto') v.preload = 'auto';
        });
      }

      /* timer: restarts on every slide change (arrows, bars, swipe, keyboard); waits while the hero is off-screen or the tab is hidden */
      var timer, left = 0, t0 = 0, started = false, hold = { tab: document.hidden };
      function holding() { return hold.off || hold.tab; }
      function advance() {
        if (hero.animating) { timer = setTimeout(advance, 150); return; }
        hero.slideNext();
      }
      function run(ms) {
        clearTimeout(timer); left = ms; t0 = Date.now();
        el.classList.toggle('is-paused', !!holding());
        if (!holding()) timer = setTimeout(advance, left);
      }
      function setHold(key, on) {
        var was = holding(); hold[key] = on;
        if (!started || was === holding()) return;
        if (holding()) { clearTimeout(timer); left = Math.max(0, left - (Date.now() - t0)); }
        else { t0 = Date.now(); timer = setTimeout(advance, left); }
        el.classList.toggle('is-paused', !!holding());
      }
      function onSlide(sw, ms) {
        var v = videoAt(sw, sw.activeIndex);
        play(v); warm(sw);
        setTimeout(function () { settle(sw); }, HERO_SPEED + 500);   /* backup for slideChangeTransitionEnd */
        setUi(sw.realIndex, ms);
        started = true; run(ms);
      }

      /* first slide: wait until the page has loaded, then play the intro */
      var introDone = false;
      function intro() {
        if (introDone) return; introDone = true;
        el.classList.add('hero-go');
        onSlide(hero, HERO_DELAY + 900);
      }
      function introSoon() { requestAnimationFrame(function () { requestAnimationFrame(intro); }); }
      $$('video', el).forEach(function (v) { v.pause(); });
      play(videoAt(hero, hero.activeIndex)); warm(hero);
      if (document.readyState === 'complete') introSoon(); else window.addEventListener('load', introSoon);
      setTimeout(intro, 2800);                    /* safety net (rAF does not run in a background tab) */

      document.addEventListener('visibilitychange', function () { setHold('tab', document.hidden); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (e) {
          var seen = e[0].isIntersecting;
          setHold('off', !seen);
          if (seen) play(videoAt(hero, hero.activeIndex)); else $$('video', el).forEach(function (v) { v.pause(); });
        }, { threshold: 0.2 }).observe(el);
      }

      /* controls */
      var hn = $('.rts__slider__nav .next'), hp = $('.rts__slider__nav .prev');
      if (hn) hn.addEventListener('click', function () { hero.slidePrev(); });   /* the theme's .next icon points LEFT and sits on the left */
      if (hp) hp.addEventListener('click', function () { hero.slideNext(); });   /* the .prev icon points RIGHT and sits on the right */
      barEls.forEach(function (b, k) { b.addEventListener('click', function () { if (k !== hero.realIndex) hero.slideToLoop(k); }); });
    }
    initHero();
    /* rooms: duplicate the cards once so the endless loop has enough slides */
var roomsWrap = $('.main__room__slider .swiper-wrapper');
if (roomsWrap) {
  $$('.main__room__slider .swiper-slide').forEach(function (s) { roomsWrap.appendChild(s.cloneNode(true)); });
}
var rooms = new Swiper('.main__room__slider', {
  loop: true, speed: 800, spaceBetween: 24, slidesPerView: 1.15, centeredSlides: false,
  pagination: { el: '.rts-pagination', clickable: true },
  breakpoints: {
    576: { slidesPerView: 2 },
    992: { slidesPerView: 3 },
    1400: { slidesPerView: 4 }
  }
});
/* rooms autoplay: every 2 seconds, keeps going 1 > 2 > 3 > 4 > 5 > 1 ... forever */
var ROOMS_DELAY = 2000;                          /* 2 seconds - change here */
var roomsEl = $('.main__room__slider'), roomsHover = false;
if (roomsEl) {
  roomsEl.addEventListener('mouseenter', function () { roomsHover = true; });
  roomsEl.addEventListener('mouseleave', function () { roomsHover = false; });
}
setInterval(function () {
  if (document.hidden || roomsHover) return;
  rooms.slideNext();
}, ROOMS_DELAY);
    new Swiper('.insta__gallery__slider', {
      loop: true, speed: 4000, spaceBetween: 10, slidesPerView: 2,
      autoplay: { delay: 1, disableOnInteraction: false },
      breakpoints: { 576: { slidesPerView: 3 }, 992: { slidesPerView: 5 }, 1400: { slidesPerView: 6 } }
    });
  }

  /* ---- date pickers ---- */
  var ci = $('#check__in'), co = $('#check__out'), cop;
  if (window.flatpickr && ci && co) {
    cop = flatpickr(co, { dateFormat: 'd M Y', minDate: new Date().fp_incr(1), disableMobile: true });
    flatpickr(ci, {
      dateFormat: 'd M Y', minDate: 'today', disableMobile: true,
      onChange: function (sel) {
        if (!sel[0]) return;
        var next = new Date(sel[0].getTime() + 864e5);
        cop.set('minDate', next);
        if (!cop.selectedDates[0] || cop.selectedDates[0] <= sel[0]) cop.setDate(next, true);
      }
    });
  }

  /* ---- booking form (front-end only) ---- */
  var bf = $('#bookingForm');
  if (bf) bf.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = $('#bookingMsg');
    if (!ci.value || !co.value) { m.textContent = 'Please choose your check-in and check-out dates.'; return; }
    /* Connect your booking engine here, e.g. window.location = 'https://your-engine/?in=' + ci.value + '&out=' + co.value; */
    m.textContent = 'Searching ' + ci.value + ' to ' + co.value + '... connect your booking engine in main.js to show live rates.';
  });

  /* ---- demo forms (sign in / join / reset / newsletter) ---- */
  $$('.um-demo-form').forEach(function (f) {
    f.addEventListener('submit', function (e) { e.preventDefault(); alert('Demo form: connect your member system to make this live.'); });
  });
  var nf = $('#newsForm');
  if (nf) nf.addEventListener('submit', function (e) {
    e.preventDefault();
    var i = $('#subscription');
    if (!/^\S+@\S+\.\S+$/.test(i.value)) { alert('Please enter a valid email address.'); return; }
    alert('Thanks for subscribing!'); nf.reset();
  });

  /* ---- accordions: mobile menu + footer columns ---- */
  function accordion(btnSel, panelOf, onToggle) {
    $$(btnSel).forEach(function (btn) {
      var panel = panelOf(btn);
      btn.addEventListener('click', function () {
        if (btnSel === '.um-fcol__title' && window.matchMedia('(min-width:992px)').matches) return;
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        panel.style.maxHeight = open ? '0px' : panel.scrollHeight + 'px';
        if (onToggle) onToggle(btn, !open);
      });
    });
  }
  accordion('.um-mnav__btn', function (b) { return b.nextElementSibling; });
  accordion('.um-fcol__title', function (b) { return b.nextElementSibling; }, function (b, open) {
    var col = b.parentNode; if (open) col.setAttribute('data-open', ''); else col.removeAttribute('data-open');
  });
  /* on desktop the footer lists must always show */
  function footerLayout() {
    var desk = window.matchMedia('(min-width:992px)').matches;
    $$('.um-fcol ul').forEach(function (ul) { ul.style.maxHeight = desk ? 'none' : (ul.previousElementSibling.getAttribute('aria-expanded') === 'true' ? ul.scrollHeight + 'px' : '0px'); });
  }
  footerLayout(); window.addEventListener('resize', footerLayout);

  /* ---- close the off-canvas menu after choosing a link ---- */
  var oc = $('#offcanvasRight');
  if (oc && window.bootstrap) {
    $$('a[href^="#"]', oc).forEach(function (a) {
      a.addEventListener('click', function () {
        if (a.hasAttribute('data-bs-toggle')) return;
        var inst = bootstrap.Offcanvas.getInstance(oc); if (inst) inst.hide();
      });
    });
  }

  /* ---- empty "#" links should not jump to top ---- */
  $$('a[href="#"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });

    /* ---- offers: screen sticks when you reach it; cards merged > spread out while you scroll ---- */
    /* ---- offers: screen sticks when you reach it; cards merged > spread out while you scroll ---- */
  (function () {
    var sec = $('#offers');
    var box = sec && $('.container', sec), wrap = sec && $('.um-offers-grid', sec);
    var cards = sec ? $$('.um-offer', sec) : [];
    if (!sec || !box || !wrap || !cards.length) {
      console.warn('[offers] not started - found: section=' + !!sec + ', grid=' + !!wrap + ', cards=' + cards.length + '. Check the new Offers HTML.');
      return;
    }
    var pin = document.createElement('div'); pin.className = 'um-offers-pin';
    box.parentNode.insertBefore(pin, box); pin.appendChild(box);
    var spacer = document.createElement('div'); sec.appendChild(spacer);
    var tilt = [-7, 5, -3], items = [], on = false, topOff = 0, extra = 0, fit = 1, padTop = 0;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function measure() {
      on = window.innerWidth >= 992;
      cards.forEach(function (c) { c.style.transform = 'none'; });
      box.style.transform = 'none'; fit = 1;
      var vh = window.innerHeight;
      padTop = parseFloat(getComputedStyle(sec).paddingTop) || 0;   /* <- the missing line */
      topOff = on && header ? header.offsetHeight : 0;
      if (on) {
        var pinH = vh - topOff;
        extra = Math.round(vh * 1.1);
        pin.style.height = pinH + 'px'; spacer.style.height = extra + 'px';
        var ch = box.scrollHeight;
        if (ch > pinH - 20) { fit = (pinH - 20) / ch; box.style.transform = 'scale(' + fit + ')'; }
      } else { pin.style.height = ''; spacer.style.height = '0px'; }
      var w = wrap.getBoundingClientRect(), cx = w.left + w.width / 2, cy = w.top + w.height / 2;
      items = cards.map(function (c, i) {
        var r = c.getBoundingClientRect();
        return { el: c, dx: (cx - (r.left + r.width / 2)) / fit, dy: (cy - (r.top + r.height / 2)) / fit, rot: tilt[i % tilt.length] };
      });
      update();
    }
    function update() {
      var vh = window.innerHeight, p;
      if (on) {
        var natural = sec.getBoundingClientRect().top + padTop;
        p = Math.min(1, Math.max(0, (topOff - natural) / extra / 0.8));
      } else {
        var t = sec.getBoundingClientRect().top;
        p = Math.min(1, Math.max(0, (vh * 0.6 - t) / (vh * 0.5)));
      }
      var e = ease(p), k = 1 - e;
      items.forEach(function (it, i) {
        it.el.style.transform = 'translate3d(' + (it.dx * k) + 'px,' + (it.dy * k) + 'px,0) rotate(' + (it.rot * k) + 'deg) scale(' + (0.82 + 0.18 * e) + ')';
        it.el.style.opacity = String(0.35 + 0.65 * Math.min(1, e * 1.6));
        it.el.style.zIndex = String(10 - i);
      });
    }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { update(); ticking = false; }); }
    }, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    measure();
  })();


    /* ---- curved section edges: flat when you arrive, bend into a curve as you scroll ---- */
  (function () {
    var NS = 'http://www.w3.org/2000/svg';
    var edges = [                                      /* section, curve type, colour of the shape */
      { sel: '#amenities', mode: 'smile', fill: '#fff' },      /* white About section bulges down */
      { sel: '#rooms',     mode: 'arch',  fill: '#fff' },      /* these rise up into the section above */
            { sel: '#rewards',   mode: 'slant', fill: (getComputedStyle(document.documentElement).getPropertyValue('--um-ink').trim() || '#1F3A33') },   /* follows --um-ink in the CSS */
            { sel: '#gallery',   mode: 'slant', fill: '#fff' },
      { sel: '#contact',   mode: 'smile', fill: '#fff' }
    ];
    var items = [];
    edges.forEach(function (e) {
      var sec = $(e.sel); if (!sec) return;
      if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
            var box = document.createElement('div'); box.className = 'um-edge um-edge--' + (e.mode === 'smile' ? 'smile' : 'arch');
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
      var path = document.createElementNS(NS, 'path'); path.setAttribute('fill', e.fill);
      svg.appendChild(path); box.appendChild(svg); sec.insertBefore(box, sec.firstChild);
      items.push({ sec: sec, mode: e.mode, path: path, cur: 0 });
    });
    if (!items.length) return;
    function target(it) {
      var vh = window.innerHeight, t = (vh * 0.95 - it.sec.getBoundingClientRect().top) / (vh * 0.6);
      t = Math.max(0, Math.min(1, t));
      return t * t * (3 - 2 * t);                        /* smooth ease in and out */
    }
    function draw(it) {
      var c = it.cur * 100;                              /* 0 = straight line, 100 = deepest curve */
            it.path.setAttribute('d', it.mode === 'slant'
        ? 'M0 101 L0 ' + (100 - c) + ' L100 100 L100 101 Z'
        : it.mode === 'arch'
        ? 'M0 101 L0 100 Q50 ' + (100 - 2 * c) + ' 100 100 L100 101 Z'
        : 'M0 -1 L100 -1 L100 0 Q50 ' + (2 * c) + ' 0 0 Z');
    }
    var running = false;
    function tick() {
      var busy = false;
      items.forEach(function (it) {
        var t = target(it), d = t - it.cur;
        if (Math.abs(d) > 0.001) { it.cur += d * 0.14; busy = true; } else it.cur = t;   /* 0.14 = smoothness: lower = softer */
        draw(it);
      });
      if (busy) requestAnimationFrame(tick); else running = false;
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    kick();
  })();
  
})();


