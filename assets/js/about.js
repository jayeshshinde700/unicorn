/* Unicon Hospitality - About page script: scroll-reveal and the guest testimonials carousel. Everything else comes from the shared site script. */

/* ==========================================================================
   GUEST TESTIMONIALS - the only place to edit.
   ABOUT_REVIEWS: one object per review.
     Genuine review:  { rating: 5, title: 'Short quote', text: 'Full review', name: 'Guest name', platform: 'Google',
                        date: 'March 2026', verified: true, category: 'Rooms & Comfort' }
     Every field except text and name is optional and is only shown when supplied.
     'verified' must only be true when the stay was actually verified. Filter buttons are built from
     the categories that appear here (needs at least two).
   ABOUT_REVIEWS is EMPTY: no genuine guest reviews have been supplied yet. While it is empty the carousel shows
   ABOUT_DEMO_REVIEWS, each card visibly flagged "Demo review - not a real guest review".
   As soon as one genuine review is added to ABOUT_REVIEWS the demo cards disappear automatically.
   ========================================================================== */
var ABOUT_REVIEWS = [];
var ABOUT_DEMO_REVIEWS = [
  { demo: true, rating: 5, title: 'A Comfortable Stay', text: 'Sample text: a short description of a restful room, a good night’s sleep and a calm start to the morning.', name: 'Demo Guest 01' },
  { demo: true, rating: 5, title: 'Warm Hospitality', text: 'Sample text: a few lines about friendly, attentive service from arrival to check-out.', name: 'Demo Guest 02' },
  { demo: true, rating: 4, title: 'A Lovely Dining Experience', text: 'Sample text: a short note about a relaxed dinner, well-presented dishes and a pleasant setting.', name: 'Demo Guest 03' },
  { demo: true, rating: 5, title: 'Perfect for a Family Getaway', text: 'Sample text: a brief mention of space, comfort and easy arrangements for a stay with children.', name: 'Demo Guest 04' },
  { demo: true, rating: 4, title: 'A Memorable Weekend', text: 'Sample text: a short story of a weekend away that felt unhurried and well looked after.', name: 'Demo Guest 05' },
  { demo: true, rating: 5, title: 'Looking Forward to Returning', text: 'Sample text: a closing line about a stay that left the guest keen to come back.', name: 'Demo Guest 06' }
];
(function () {
  'use strict';
  var list = document.getElementById('aboutReviewList');
  var box = document.getElementById('aboutReviewSwiper');
  if (!list || !box) return;

  var section = box.closest('.about-reviews');
  var filters = document.getElementById('aboutReviewFilters');
  var controls = document.getElementById('aboutReviewControls');
  var dots = document.getElementById('aboutReviewDots');
  var demoMode = /[?&]demo=reviews\b/.test(location.search);
  var reviews = ABOUT_REVIEWS.length ? ABOUT_REVIEWS : ABOUT_DEMO_REVIEWS;
  var hasReal = reviews.length > 0;
  var data = reviews;
  if (!hasReal) {                      /* nothing genuine to show: replace the carousel with a notice */
    box.hidden = true;
    if (controls) controls.hidden = true;
    var empty = document.getElementById('aboutReviewEmpty');
    if (empty) empty.hidden = false;
    return;
  }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var MAX_PER_VIEW = 3;        /* desktop; the breakpoints below give 2 on tablet and 1 on mobile */
  var SLIDE_MS = 700;          /* slide transition */
  var AUTOPLAY_MS = 3500;      /* a new card arrives every 3.5s (the 700ms slide happens inside that time) */
  var swiper = null;
  var hold = { hover: false, focus: false, hidden: document.hidden, away: true };   /* reasons autoplay is paused */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function stars(rating) {
    var wrap = el('div', 'about-review__stars');
    var r = Math.max(0, Math.min(5, Math.round(rating || 0)));
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', rating ? 'Rated ' + r + ' out of 5' : 'Rating not available');
    for (var i = 0; i < 5; i++) {
      var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('class', 'ico' + (i < r ? ' is-on' : ''));
      s.setAttribute('aria-hidden', 'true');
      var u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      u.setAttribute('href', '#i-star');
      s.appendChild(u); wrap.appendChild(s);
    }
    return wrap;
  }

  function card(r) {
    var slide = el('div', 'swiper-slide');
    var c = el('article', 'about-review' + (r.demo ? ' is-demo' : ''));
        if (r.demo) c.appendChild(el('span', 'about-review__flag', 'Demo review – not a real guest review'));
    c.appendChild(stars(r.rating));
    if (r.title) c.appendChild(el('h3', 'about-review__title', r.title));
    c.appendChild(el('p', 'about-review__text', r.text));
    var foot = el('footer', 'about-review__foot');
    foot.appendChild(el('strong', 'about-review__name', r.name));
    var meta = [];
    if (r.demo) meta.push('Illustrative rating');
    if (r.verified && !r.demo) meta.push('Verified guest');
    if (r.platform) meta.push(r.platform);
    if (r.date) meta.push(r.date);
    if (meta.length) foot.appendChild(el('span', 'about-review__meta', meta.join(' · ')));
    c.appendChild(foot);
    slide.appendChild(c);
    return slide;
  }

  /* start or stop autoplay from the combined state, so there is only ever one timer */
  function syncAutoplay() {
    if (!swiper || !swiper.autoplay) return;
    var go = !reduce && !swiper.isLocked && !hold.hover && !hold.focus && !hold.hidden && !hold.away;
    if (go && !swiper.autoplay.running) swiper.autoplay.start();
    else if (!go && swiper.autoplay.running) swiper.autoplay.stop();
  }

  function syncControls() {
    if (controls && swiper) controls.classList.toggle('is-hidden', swiper.isLocked);
    syncAutoplay();
  }

  /* (re)build the carousel for a category: destroy the old instance first so nothing is duplicated */
  function build(category) {
    if (swiper) { swiper.destroy(true, true); swiper = null; }
    if (dots) dots.textContent = '';
    list.textContent = '';
    var shown = data.filter(function (r) { return !category || r.category === category; });
    shown.forEach(function (r) { list.appendChild(card(r)); });
    if (!window.Swiper) return;

    swiper = new Swiper(box, {
      slidesPerView: 1, spaceBetween: 20, speed: reduce ? 0 : SLIDE_MS, watchOverflow: true,
      loop: shown.length > MAX_PER_VIEW,          /* only loop when there are enough real slides; nothing is duplicated into the data */
      watchSlidesProgress: true,                  /* adds .swiper-slide-visible, used for the card fade/scale */
      grabCursor: true,
      autoplay: reduce ? false : { delay: AUTOPLAY_MS, waitForTransition: false, disableOnInteraction: false, pauseOnMouseEnter: false },
      a11y: { prevSlideMessage: 'Previous reviews', nextSlideMessage: 'Next reviews' },
      navigation: { prevEl: '#aboutReviewPrev', nextEl: '#aboutReviewNext', disabledClass: 'is-off' },
      pagination: { el: '#aboutReviewDots', clickable: true },
      breakpoints: { 700: { slidesPerView: 2, spaceBetween: 22 }, 1100: { slidesPerView: MAX_PER_VIEW, spaceBetween: 26 } },
      on: { init: syncControls, resize: syncControls, update: syncControls, breakpoint: syncControls }
    });
    syncControls();
  }

  /* category filters: only categories that exist in the real review data */
  if (hasReal && filters) {
    var cats = [];
    reviews.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
    if (cats.length > 1) {
      ['All Reviews'].concat(cats).forEach(function (label, i) {
        var b = el('button', 'about-reviews__filter' + (i === 0 ? ' is-on' : ''), label);
        b.type = 'button';
        b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(filters.children, function (x) { x.classList.remove('is-on'); x.setAttribute('aria-pressed', 'false'); });
          b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true');
          build(i === 0 ? '' : label);
        });
        filters.appendChild(b);
      });
      filters.hidden = false;
    }
  }

  build('');

  /* autoplay pauses: pointer over the carousel or its controls, keyboard focus inside, tab hidden, carousel off screen.
     These listeners are attached once to the stable containers, never to the swiper instance. */
  [box, controls].forEach(function (zone) {
    if (!zone) return;
    zone.addEventListener('mouseenter', function () { hold.hover = true; syncAutoplay(); });
    zone.addEventListener('mouseleave', function () { hold.hover = false; syncAutoplay(); });
    zone.addEventListener('focusin', function () { hold.focus = true; syncAutoplay(); });
    zone.addEventListener('focusout', function () { hold.focus = false; syncAutoplay(); });
  });
  document.addEventListener('visibilitychange', function () { hold.hidden = document.hidden; syncAutoplay(); });

  /* entrance: cards fade and rise in (staggered) the first time the carousel scrolls into view;
     afterwards autoplay only runs while it is on screen */
  function enter() {
    if (section.classList.contains('is-in')) return;
    var vis = list.querySelectorAll('.swiper-slide-visible');
    Array.prototype.forEach.call(vis, function (s, i) { s.style.transitionDelay = (i * 140) + 'ms'; });
    section.classList.add('is-in');
    setTimeout(function () { Array.prototype.forEach.call(vis, function (s) { s.style.transitionDelay = ''; }); }, 1400);
  }
  if (reduce || !('IntersectionObserver' in window)) {
    section.classList.add('is-in'); hold.away = false; syncAutoplay();
  } else {
    var seen = false;
    new IntersectionObserver(function (entries) {
      seen = true;
      entries.forEach(function (e) {
        hold.away = !e.isIntersecting;
        if (e.isIntersecting) enter();
        syncAutoplay();
      });
    }, { threshold: 0.25 }).observe(box);
    setTimeout(function () { section.classList.add('is-in'); if (!seen) { hold.away = false; syncAutoplay(); } }, 6000);   /* safety net: never leave cards hidden or autoplay stuck if the observer never reports */
  }
})();

(function () {
  'use strict';
  var items = Array.prototype.slice.call(document.querySelectorAll('.about-reveal'));
  if (!items.length) return;

  items.forEach(function (el) {
    var d = parseInt(el.getAttribute('data-delay'), 10);
    if (d) el.style.setProperty('--d', d);
  });

  function show(el) { el.classList.add('is-in'); }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) { items.forEach(show); return; }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach(function (el) { io.observe(el); });

  /* safety net: never leave content hidden */
  setTimeout(function () { items.forEach(show); }, 6000);
})();

(function () {
  'use strict';
  /* arriving via about.html#experience (or any section anchor): the page uses smooth scrolling and lazy images,
     which can leave the browser short of the target, so settle on it once loaded */
  var target = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!target) return;
  var settle = function () { target.scrollIntoView({ behavior: 'instant', block: 'start' }); };
  if (document.readyState === 'complete') settle(); else window.addEventListener('load', settle);
  setTimeout(settle, 700);
})();

/* gallery lightbox: click a tile to enlarge; Esc closes, arrow keys move between photos */
(function () {
  'use strict';
  var tiles = Array.prototype.slice.call(document.querySelectorAll('.about-tile'));
  if (!tiles.length) return;
  var lb = document.createElement('div');
  lb.className = 'about-lb';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Photo viewer');
  lb.innerHTML = '<button type="button" class="about-lb__close" aria-label="Close">&times;</button>' +
    '<button type="button" class="about-lb__prev" aria-label="Previous photo">&#8249;</button>' +
    '<figure><img alt=""><figcaption></figcaption></figure>' +
    '<button type="button" class="about-lb__next" aria-label="Next photo">&#8250;</button>';
  document.body.appendChild(lb);
  var img = lb.querySelector('img'), cap = lb.querySelector('figcaption');
  var idx = 0, opener = null;

  function show(i) {
    idx = (i + tiles.length) % tiles.length;
    var src = tiles[idx].querySelector('img');
    img.src = src.currentSrc || src.src;
    img.alt = src.alt;
    cap.textContent = tiles[idx].querySelector('figcaption').textContent;
  }
  function open(i, from) { opener = from; show(i); lb.classList.add('is-open'); document.body.style.overflow = 'hidden'; lb.querySelector('.about-lb__close').focus(); }
  function close() { lb.classList.remove('is-open'); document.body.style.overflow = ''; if (opener) opener.focus(); }

  tiles.forEach(function (t, i) {
    var b = t.querySelector('.about-tile__btn');
    if (b) b.addEventListener('click', function () { open(i, b); });
  });
  lb.querySelector('.about-lb__close').addEventListener('click', close);
  lb.querySelector('.about-lb__prev').addEventListener('click', function () { show(idx - 1); });
  lb.querySelector('.about-lb__next').addEventListener('click', function () { show(idx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'ArrowRight') show(idx + 1);
  });
})();
