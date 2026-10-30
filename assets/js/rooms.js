/* Unicorn Hospitality - Rooms & Suites page (loads only on rooms.html, after the shared site script)
   The rooms come from the admin dashboard (api/rooms.php). If that is not available, the rooms written in rooms.html and the details below are used instead.
   The date pickers on this page are started by the shared script (ids #check__in / #check__out). */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  var grid = $('#rmGrid');
  if (!grid) return;

  /* ======================================================================
     DATA  (edit freely)
     ====================================================================== */
  var CONTACT_PAGE = 'contact.html';
  var PHONE = '+919920400267';
  var MAX_COMPARE = 3;
  var FEED_URL = 'api/rooms.php';        /* published rooms from the admin dashboard */
  var FEED_WAIT = 2500;                   /* ms to wait for the feed before using the built-in list */

  /* BUILT-IN FALLBACK: more detail for the quick-view window and the compare table (replaced by the admin's data when the feed loads).
     amen: [icon, label]   icons: wifi snow tv cup lock bed bath desk sofa drop sun car */
  var DETAILS = {
    deluxe: {
      tag: 'Calm, classic comfort', view: 'City light',
      desc: 'A quiet, softly lit room in warm neutrals. The king bed has plush bedding, quality linens and a choice of pillows, and tall windows with floor-length drapes let the morning in. Simple, restful and easy to love.',
      amen: [['wifi', 'Free Wi-Fi'], ['snow', 'Air-conditioning'], ['tv', 'Flat-screen TV'], ['cup', 'Tea & coffee maker'], ['lock', 'In-room safe'], ['bed', 'Choice of pillows'], ['bath', 'En-suite bathroom'], ['car', 'Free parking']],
      has: { desk: false, shower: false, lounge: false, dining: false, apart: false }
    },
    executive: {
      tag: 'Space to work, room to unwind', view: 'City view',
      desc: 'More space and more light than our Deluxe, with a tall window onto the city. A work corner keeps the laptop close, the king bed keeps the night long. Made for business trips that deserve a better sleep.',
      amen: [['wifi', 'Free Wi-Fi'], ['desk', 'Work corner'], ['snow', 'Air-conditioning'], ['tv', 'Flat-screen TV'], ['cup', 'Tea & coffee maker'], ['lock', 'In-room safe'], ['sun', 'City-view window'], ['car', 'Free parking']],
      has: { desk: true, shower: false, lounge: false, dining: false, apart: false }
    },
    family: {
      tag: 'Everyone under one roof', view: 'Garden side',
      desc: 'Twin beds, a separate sleeping area and plenty of space to spread out after a long day. Wooden wardrobes, a bright bathroom and a calm, airy feel make it easy for the whole family to settle in.',
      amen: [['bed', 'Twin beds'], ['sofa', 'Extra sleeping space'], ['wifi', 'Free Wi-Fi'], ['snow', 'Air-conditioning'], ['tv', 'Flat-screen TV'], ['cup', 'Tea & coffee maker'], ['lock', 'In-room safe'], ['bath', 'Bathroom with shower']],
      has: { desk: false, shower: false, lounge: true, dining: false, apart: true }
    },
    premium: {
      tag: 'Rich, warm and private', view: 'Courtyard',
      desc: 'Layered lighting, a statement headboard wall and a small table for a quiet dinner in. The Premium Suite is warm, glowing and generously sized, for guests who like their evenings unhurried.',
      amen: [['tv', 'Smart TV'], ['sofa', 'Dining nook'], ['drop', 'Rain shower'], ['wifi', 'Free Wi-Fi'], ['desk', 'Work desk'], ['snow', 'Air-conditioning'], ['lock', 'In-room safe'], ['cup', 'Tea & coffee maker']],
      has: { desk: true, shower: true, lounge: true, dining: true, apart: false }
    },
    unicon: {
      tag: 'Our signature suite', view: 'Open view',
      desc: 'Our most open, light-filled suite. Wide glass doors, natural timber and airy linen make mornings feel slow in the best way. A private lounge, a king bed and the most space we offer, all in one calm room.',
      amen: [['sun', 'Open view'], ['sofa', 'Private lounge'], ['drop', 'Rain shower'], ['wifi', 'Free Wi-Fi'], ['desk', 'Work desk'], ['tv', 'Smart TV'], ['snow', 'Air-conditioning'], ['lock', 'In-room safe']],
      has: { desk: true, shower: true, lounge: true, dining: true, apart: true }
    }
  };

  var SEASONS = [
    { id: 'festive', name: 'Festive season' },
    { id: 'winter', name: 'Winter & New Year' },
    { id: 'summer', name: 'Summer staycation' },
    { id: 'monsoon', name: 'Monsoon escape' }
  ];
  /* which season is "now" (month 0 = January) */
  function currentSeason(d) {
    var m = d.getMonth(), day = d.getDate();
    if (m === 9 || (m === 10 && day <= 20)) return 'festive';          /* 1 Oct - 20 Nov */
    if ((m === 10 && day >= 21) || m === 11 || m === 0 || m === 1) return 'winter';
    if (m >= 2 && m <= 4) return 'summer';
    return 'monsoon';                                                  /* Jun - Sep */
  }

  /* the room finder: who + why -> room id, and a one-line reason */
  var FINDER_WHY = {
    deluxe: 'calm, simple comfort at a friendly price',
    executive: 'extra space, a work corner and a city view',
    family: 'twin beds and room for everyone',
    premium: 'warm lighting, a dining nook and a rain shower',
    unicon: 'our biggest, most open suite for something special'
  };
  function finderPreset(who, why) {
    if (who === 'family') return 'family';
    if (who === 'group') return 'unicon';
    if (why === 'business') return 'executive';
    if (why === 'celebrate') return who === 'solo' ? 'premium' : 'unicon';
    if (why === 'long') return 'premium';
    return who === 'solo' ? 'deluxe' : 'premium';
  }

  /* ======================================================================
     HELPERS
     ====================================================================== */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inr(n) { return Number(n).toLocaleString('en-IN'); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function shortDay(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  var SHARED_ICONS = { wifi: 1, cup: 1, bed: 1, car: 1, pool: 1, shield: 1, clock: 1, star: 1, user: 1, area: 1, check: 1, phone: 1, cal: 1, plane: 1, gym: 1 };
  function iconRef(n) { return (SHARED_ICONS[n] ? '#i-' : '#rm-i-') + n; }
  function svg(n, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 24 24" aria-hidden="true"><use href="' + iconRef(n) + '"/></svg>'; }
  function ease(t) { return 1 - Math.pow(1 - t, 4); }
  function tween(from, to, dur, step) {
    if (reduce || from === to) { step(to); return; }
    var t0 = performance.now();
    (function f(t) {
      var p = Math.min(1, (t - t0) / dur);
      step(from + (to - from) * ease(p));
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }
  var toastEl = $('#rmToast'), toastT;
  function toast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, ms || 2600);
  }
  function store(key, val) {
    try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
    return null;
  }
  function raf2(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }

  /* ======================================================================
     PAGE CHROME: reading progress, hero parallax, sticky bar offset, reveal
     ====================================================================== */
  var header = $('.header__function'), bar = $('#rmBar'), prog = $('#rmProgress'), heroBg = $('#rmHeroBg'), hero = $('#rmHero');
  function setHead() {
    var h = header ? header.offsetHeight : 78;
    document.documentElement.style.setProperty('--rm-head', h + 'px');
    document.body.style.setProperty('--rm-head', h + 'px');
  }
  setHead(); window.addEventListener('resize', setHead);
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.pageYOffset, max = document.documentElement.scrollHeight - window.innerHeight;
    if (prog) prog.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    if (heroBg && hero && y < hero.offsetHeight + 100 && !reduce) heroBg.style.setProperty('--py', (y * 0.22).toFixed(1) + 'px');
    if (bar) {
      var head = header ? header.offsetHeight : 78;
      bar.classList.toggle('is-stuck', bar.getBoundingClientRect().top <= head + 1);
    }
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
      outer.className = 'rm-w'; outer.setAttribute('aria-hidden', 'true');
      inner.textContent = w; inner.style.setProperty('--i', i);
      outer.appendChild(inner);
      if (i) h.appendChild(document.createTextNode(' '));
      h.appendChild(outer);
    });
  });
  raf2(function () { if (hero) hero.classList.add('is-in'); });

  /* ensure hero background video plays smoothly */
  var heroVideo = $('#rmHero video');
  if (heroVideo && !reduce) {
    var vp = heroVideo.play();
    if (vp !== undefined) {
      vp.catch(function () {});
    }
  }

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
  observeReveal($$('[data-rm]'));

  /* ======================================================================
     LISTING (starts once the admin feed has been tried, see the bottom of the file)
     ====================================================================== */
  function initListing() {
  var cells = $$('.rm-cell', grid).filter(function (c) { return $('.rm-card', c); });
  var helpCell = $('.rm-cell--help', grid);
  var cardById = {};
  cells.forEach(function (c) {
    var card = $('.rm-card', c);
    cardById[card.getAttribute('data-id')] = card;
    c.style.viewTransitionName = 'rm-' + card.getAttribute('data-id');
  });
  var ids = Object.keys(cardById);
  if (helpCell) helpCell.style.viewTransitionName = 'rm-help';
  function roomName(id) { return $('.rm-card__title a', cardById[id]).textContent; }
  function cardData(id) {
    var c = cardById[id];
    return {
      plabel: c.getAttribute('data-plabel') || 'From',
      id: id, name: roomName(id), price: +c.getAttribute('data-price'), size: +c.getAttribute('data-size'), guests: +c.getAttribute('data-guests'),
      img: $('img', c).getAttribute('src'), cat: $('.rm-card__cat', c).textContent, bed: $('.rm-meta li:last-child', c).textContent.trim()
    };
  }

  (function hideEmptyFilters() {
    ['room', 'suite', 'family'].forEach(function (f) {
      var any = ids.some(function (id) { return (cardById[id].getAttribute('data-tags') || '').split(' ').indexOf(f) > -1; });
      $$('.rm-chip[data-filter="' + f + '"], [data-filter-link="' + f + '"]').forEach(function (el) { el.classList.toggle('rm-hide', !any); });
    });
  })();

  (function fromPrice() {
    var out = $('#rmFrom'); if (!out) return;
    var prices = ids.map(function (id) { return +cardById[id].getAttribute('data-price'); });
    if (!prices.length) { out.closest('.rm-hl__it').classList.add('rm-hide'); return; }
    var to = Math.min.apply(null, prices);
    tween(0, to, 1200, function (v) { out.textContent = inr(Math.round(v)); });
  })();

  var state = {
    filter: 'all', sort: 'rank', view: 'grid',
    saved: store('umSavedRooms') || [], cmp: [],
    checkIn: null, checkOut: null, nights: 0, adults: 2, children: 0
  };
  state.saved = state.saved.filter(function (id) { return cardById[id]; });

  /* ---- sliding highlight behind the filter chips ---- */
  var chipsBox = $('#rmChips'), chipInd = $('.rm-chips__ind', chipsBox);
  function moveChipInd() {
    var on = $('.rm-chip[aria-pressed="true"]', chipsBox);
    if (!on) return;
    chipInd.style.setProperty('--x', on.offsetLeft + 'px');
    chipInd.style.setProperty('--w', on.offsetWidth + 'px');
  }
  window.addEventListener('resize', moveChipInd);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveChipInd);
  moveChipInd();

  /* ---- apply filter / sort / view (cards glide to their new places) ---- */
  function matches(id) {
    if (state.filter === 'all') return true;
    if (state.filter === 'saved') return state.saved.indexOf(id) > -1;
    return (cardById[id].getAttribute('data-tags') || '').split(' ').indexOf(state.filter) > -1;
  }
  function sorter(a, b) {
    var A = cardById[a], B = cardById[b], g = function (c, k) { return +c.getAttribute('data-' + k); };
    switch (state.sort) {
      case 'price-asc': return g(A, 'price') - g(B, 'price');
      case 'price-desc': return g(B, 'price') - g(A, 'price');
      case 'size-desc': return g(B, 'size') - g(A, 'size');
      case 'guests-desc': return g(B, 'guests') - g(A, 'guests') || g(A, 'rank') - g(B, 'rank');
      default: return g(A, 'rank') - g(B, 'rank');
    }
  }
  function render() {
    var order = ids.slice().sort(sorter), shown = 0;
    order.forEach(function (id) {
      var cell = cardById[id].parentNode, ok = matches(id);
      cell.classList.toggle('rm-hide', !ok);
      if (ok) shown++;
      grid.appendChild(cell);
    });
    if (helpCell) { grid.appendChild(helpCell); helpCell.classList.toggle('rm-hide', shown === 0); }
    grid.classList.toggle('is-list', state.view === 'list');
    $('#rmCount').innerHTML = 'Showing <b>' + shown + '</b> of ' + ids.length + ' stays';
    $('#rmEmpty').classList.toggle('is-on', shown === 0);
    $('#rmReset').classList.toggle('rm-hide', state.filter === 'all');
    $$('.rm-chip', chipsBox).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === state.filter)); });
    $$('.rm-view button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === state.view)); });
    $('#rmSort').value = state.sort;
    moveChipInd();
  }
  function update() {
    if (document.startViewTransition && !reduce) {
      try { document.startViewTransition(render); return; } catch (e) {}
    }
    if (reduce) { render(); return; }
    grid.classList.add('is-fading');
    setTimeout(function () { render(); raf2(function () { grid.classList.remove('is-fading'); }); }, 220);
  }
  function setFilter(f) { state.filter = f; update(); }

  $$('.rm-chip', chipsBox).forEach(function (b) {
    b.addEventListener('click', function () { setFilter(b.getAttribute('data-filter')); });
  });
  $$('.rm-view button').forEach(function (b) {
    b.addEventListener('click', function () { state.view = b.getAttribute('data-view'); update(); });
  });
  $('#rmSort').addEventListener('change', function () { state.sort = this.value; update(); });
  function resetAll() { state.filter = 'all'; update(); }
  $('#rmReset').addEventListener('click', resetAll);
  $('#rmEmptyReset').addEventListener('click', resetAll);

  /* ======================================================================
     DATES + GUESTS  (pickers are created by the shared script)
     ====================================================================== */
  var ciEl = $('#check__in'), coEl = $('#check__out'), adultEl = $('#adult'), childEl = $('#child');
  var form = $('#rmAvail'), msgEl = $('#rmAvailMsg'), stayEl = $('#rmStay');
  function picked(el) { return el && el._flatpickr && el._flatpickr.selectedDates[0] ? el._flatpickr.selectedDates[0] : null; }

  function readStay() {
    state.checkIn = picked(ciEl); state.checkOut = picked(coEl);
    state.nights = state.checkIn && state.checkOut ? Math.max(0, Math.round((state.checkOut - state.checkIn) / 864e5)) : 0;
    state.adults = adultEl ? parseInt(adultEl.value, 10) || 1 : 2; state.children = childEl ? parseInt(childEl.value, 10) || 0 : 0;
  }
  function reserveUrl(id) {
    var q = ['room=' + encodeURIComponent(roomName(id))];
    if (state.checkIn) q.push('checkin=' + iso(state.checkIn));
    if (state.checkOut) q.push('checkout=' + iso(state.checkOut));
    q.push('adults=' + state.adults, 'children=' + state.children);
    return CONTACT_PAGE + '?' + q.join('&') + '#enquiry';
  }
  var shownTotals = {};
  function refreshStay() {
    readStay();
    var guests = state.adults + state.children;
    ids.forEach(function (id) {
      var card = cardById[id], price = +card.getAttribute('data-price'), em = $('[data-total]', card);
      card.classList.toggle('is-full', guests > +card.getAttribute('data-guests'));
      $('[data-full]', card).textContent = 'Sleeps up to ' + card.getAttribute('data-guests');
      $('[data-reserve]', card).setAttribute('href', reserveUrl(id));
      if (state.nights > 0) {
        var to = price * state.nights, from = shownTotals[id] || 0;
        shownTotals[id] = to;
        tween(from, to, 700, function (v) { em.innerHTML = '&#8377;' + inr(Math.round(v)) + ' for ' + plural(state.nights, 'night'); });
      } else { em.textContent = ''; shownTotals[id] = 0; }
    });
    /* summary under the bar */
    if (stayEl && state.nights > 0) {
      var who = plural(state.adults, 'adult') + (state.children ? ', ' + plural(state.children, 'child').replace('childs', 'children') : '');
      stayEl.innerHTML = '<li>' + svg('cal', 'ico') + '<b>' + shortDay(state.checkIn) + ' &rarr; ' + shortDay(state.checkOut) + '</b> &middot; ' + plural(state.nights, 'night') + '</li>' +
        '<li>' + svg('user', 'ico') + who + '</li><li class="rm-stay__note">Prices below show your total, taxes extra.</li>';
      stayEl.classList.remove('rm-hide');
    } else if (stayEl) stayEl.classList.add('rm-hide');
    var topGuests = Math.max.apply(null, ids.map(function (id) { return +cardById[id].getAttribute('data-guests'); }).concat([1]));
    var big = guests > topGuests;
    if (msgEl) msgEl.textContent = big ? 'That is a big group. Our largest stays sleep ' + topGuests + ', so we suggest two rooms. Call us and we will keep them side by side.' : '';
    if (dlgOpen === dlg) fillRoom(currentRoom, 0, true);
  }
  [ciEl, coEl, adultEl, childEl].forEach(function (el) { if (el) el.addEventListener('change', refreshStay); });

  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    readStay();
    if (!state.checkIn || !state.checkOut || state.nights < 1) {
      msgEl.textContent = 'Please choose your check-in and check-out dates.';
      form.classList.remove('rm-shake'); void form.offsetWidth; form.classList.add('rm-shake');
      if (ciEl._flatpickr) ciEl._flatpickr.open();
      return;
    }
    refreshStay();
    msgEl.textContent = '';
    toast('Showing your total for ' + plural(state.nights, 'night') + '. Our team confirms availability when you reserve.', 3600);
    scrollToEl($('#rm-list'), 14);
    cells.forEach(function (c, i) {
      c.classList.remove('rm-pulse'); void c.offsetWidth;
      c.style.setProperty('--pd', (i * 0.07) + 's'); c.classList.add('rm-pulse');
    });
  });

  function scrollToEl(el, extra) {
    if (!el) return;
    var head = (header ? header.offsetHeight : 78) + (bar ? bar.offsetHeight : 0) + (extra || 0);
    var y = el.getBoundingClientRect().top + window.pageYOffset - head;
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
  }
  $$('[data-goto-dates]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToEl($('#book'), 60);
      setTimeout(function () { if (ciEl._flatpickr) ciEl._flatpickr.open(); else ciEl.focus(); }, reduce ? 0 : 650);
    });
  });

  /* ======================================================================
     SAVED (hearts)
     ====================================================================== */
  function syncSaved() {
    ids.forEach(function (id) {
      var on = state.saved.indexOf(id) > -1, b = $('.rm-heart', cardById[id]);
      b.setAttribute('aria-pressed', String(on));
    });
    $$('[data-saved-n]').forEach(function (n) { n.textContent = state.saved.length; });
    store('umSavedRooms', state.saved);
  }
  function toggleSave(id) {
    var i = state.saved.indexOf(id);
    if (i > -1) { state.saved.splice(i, 1); toast('Removed ' + roomName(id) + ' from your saved stays'); }
    else { state.saved.push(id); toast('Saved ' + roomName(id) + '. Find it under "Saved".'); }
    syncSaved();
    if (state.filter === 'saved') update();
  }
  $$('.rm-heart').forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); toggleSave(b.closest('.rm-card').getAttribute('data-id')); });
  });
  syncSaved();

  /* ======================================================================
     COMPARE
     ====================================================================== */
  var tray = $('#rmTray'), trayThumbs = $('#rmTrayThumbs'), trayGo = $('#rmTrayGo');
  function syncCompare() {
    ids.forEach(function (id) { $('[data-cmp]', cardById[id]).checked = state.cmp.indexOf(id) > -1; });
    var n = state.cmp.length, html = '';
    state.cmp.forEach(function (id) { html += '<img src="' + esc(cardData(id).img) + '" alt="' + esc(roomName(id)) + '">'; });
    for (var i = n; i < MAX_COMPARE; i++) html += '<span class="rm-tray__slot">+</span>';
    trayThumbs.innerHTML = html;
    $('#rmTrayTitle').textContent = n ? plural(n, 'stay') + ' selected' : 'Compare stays';
    $('#rmTraySub').textContent = n < 2 ? 'Pick at least 2 (up to ' + MAX_COMPARE + ')' : 'Ready to compare';
    trayGo.disabled = n < 2;
    tray.classList.toggle('is-on', n > 0);
  }
  $$('[data-cmp]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var id = cb.getAttribute('data-cmp'), i = state.cmp.indexOf(id);
      if (cb.checked && i < 0) {
        if (state.cmp.length >= MAX_COMPARE) { cb.checked = false; toast('You can compare up to ' + MAX_COMPARE + ' stays at a time'); return; }
        state.cmp.push(id);
      } else if (!cb.checked && i > -1) state.cmp.splice(i, 1);
      syncCompare();
    });
  });
  $('#rmTrayClear').addEventListener('click', function () { state.cmp = []; syncCompare(); });

  function buildCompare() {
    var rooms = state.cmp.map(cardData), best = Math.min.apply(null, rooms.map(function (r) { return r.price; }));
    function row(label, fn, cls) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row">' + label + '</th>' + rooms.map(function (r) { return '<td>' + fn(r) + '</td>'; }).join('') + '</tr>';
    }
    function yn(key) { return function (r) { return ((DETAILS[r.id] || {}).has || {})[key] ? '<span class="yes">&#10003; Yes</span>' : '<span class="no">&ndash;</span>'; }; }
    var perNight = function (r) { return '&#8377;' + inr(r.price) + (r.price === best && rooms.length > 1 ? ' <small>(lowest)</small>' : ''); };
    var html = '<span class="h6 subtitle__icon__two d-block">Side by side</span><h2 id="rmCmpTitle">Compare Your Stays</h2><div class="rm-cmpt__scroll"><table><thead><tr><th></th>' +
      rooms.map(function (r) { return '<th scope="col"><div class="rm-cmpt__room"><img src="' + esc(r.img) + '" alt="' + esc(r.name) + '"><b>' + esc(r.name) + '</b></div></th>'; }).join('') + '</tr></thead><tbody>' +
      row('Size', function (r) { return r.size + ' sqm'; }) +
      row('Sleeps', function (r) { return plural(r.guests, 'guest'); }) +
      row('Bed', function (r) { return esc(r.bed); }) +
      row('View', function (r) { return esc((DETAILS[r.id] || {}).view || '\u2013'); }) +
      row('Work desk', yn('desk')) + row('Rain shower', yn('shower')) + row('Sitting area', yn('lounge')) + row('Dining nook', yn('dining')) + row('Separate sleeping area', yn('apart')) +
      row('Per night', perNight, 'is-best') +
      (state.nights > 0 ? row('Your ' + plural(state.nights, 'night'), function (r) { return '<b>&#8377;' + inr(r.price * state.nights) + '</b>'; }, 'is-best') : '') +
      row('', function (r) { return '<a class="theme-btn btn-style sm-btn fill no-border" href="' + reserveUrl(r.id) + '"><span>Reserve</span></a>'; }) +
      '</tbody></table></div><p class="rm-cmpt__note">Every stay includes free Wi-Fi, breakfast &amp; dining, free parking, pool and fitness access and 24-hour security. Prices are per room, taxes extra.</p>';
    $('#rmCmpBody').innerHTML = html;
  }
  trayGo.addEventListener('click', function () { buildCompare(); openDlg($('#rmCmpDlg'), trayGo); });

  /* ======================================================================
     DIALOGS (quick view + compare): focus trap, Esc, scroll lock
     ====================================================================== */
  var dlg = $('#rmDlg'), dlgBody = $('#rmDlgBody'), dlgImg = $('#rmDlgImg');
  var dlgOpen = null, lastFocus = null, currentRoom = ids[0];
  function lockScroll(on) {
    if (on) {
      var sb = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = sb ? sb + 'px' : '';
      document.body.classList.add('rm-lock');
    } else { document.body.classList.remove('rm-lock'); document.body.style.paddingRight = ''; }
  }
  function openDlg(el, from) {
    lastFocus = from || document.activeElement;
    dlgOpen = el; el.classList.add('is-on'); el.setAttribute('aria-hidden', 'false'); lockScroll(true);
    setTimeout(function () { var f = $('[data-close].rm-dlg__x', el); if (f) f.focus(); }, 50);
  }
  function closeDlg() {
    if (!dlgOpen) return;
    var el = dlgOpen; dlgOpen = null;
    el.classList.remove('is-on'); el.setAttribute('aria-hidden', 'true'); lockScroll(false);
    if (el === dlg && location.hash && cardById[location.hash.slice(1)]) history.replaceState(null, '', location.pathname + location.search);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$('.rm-dlg [data-close]').forEach(function (b) { b.addEventListener('click', closeDlg); });
  document.addEventListener('keydown', function (e) {
    if (!dlgOpen) return;
    if (e.key === 'Escape') { closeDlg(); return; }
    if (dlgOpen === dlg && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { stepRoom(e.key === 'ArrowRight' ? 1 : -1); return; }
    if (e.key === 'Tab') {
      var f = $$('button,a[href],input,select,[tabindex]:not([tabindex="-1"])', dlgOpen).filter(function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  function orderedIds() { return ids.slice().sort(sorter); }
  function stepRoom(dir) {
    var o = orderedIds(), i = o.indexOf(currentRoom);
    fillRoom(o[(i + dir + o.length) % o.length], dir);
  }
  function fillRoom(id, dir, keep) {
    currentRoom = id;
    var r = cardData(id), d = DETAILS[id] || { tag: '', view: '', desc: '', notes: '', amen: [], has: {}, gallery: [] }, o = orderedIds();
    /* picture: replace the node so the slow zoom restarts */
    if (!keep) {
      showPicture(r.img, r.name + ' at Unicorn Hospitality');
      $('#rmDlgIdx').textContent = pad(o.indexOf(id) + 1) + ' / ' + pad(o.length);
      var media = $('.rm-dlg__media', dlg), th = $('.rm-dlg__thumbs', media), pics = [r.img].concat(d.gallery || []);
      if (!th) {
        th = document.createElement('div'); th.className = 'rm-dlg__thumbs'; media.appendChild(th);
        th.addEventListener('click', function (e) {
          var b = e.target.closest('button[data-src]'); if (!b) return;
          showPicture(b.getAttribute('data-src'), th.getAttribute('data-alt'));
          $$('button', th).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        });
      }
      th.setAttribute('data-alt', r.name + ' at Unicorn Hospitality');
      th.hidden = pics.length < 2;
      th.innerHTML = pics.length < 2 ? '' : pics.map(function (p, i) { return '<button type="button" class="' + (i ? '' : 'is-on') + '" data-src="' + esc(p) + '" aria-label="Show picture ' + (i + 1) + '"><img src="' + esc(p) + '" alt=""></button>'; }).join('');
    }
    var nights = state.nights, total = nights > 0 ? '<em>&#8377;' + inr(r.price * nights) + ' for ' + plural(nights, 'night') + '</em>' : '<em></em>';
    var saved = state.saved.indexOf(id) > -1;
    dlgBody.innerHTML =
      '<span class="rm-eyebrow" style="color:#AE8B57">' + esc(r.cat.split('\u00B7')[0].trim()) + '</span>' +
      '<h2 id="rmDlgTitle">' + esc(r.name) + '</h2>' + (d.tag ? '<p class="rm-dlg__tag">' + esc(d.tag) + '</p>' : '') +
      (d.desc ? '<p>' + esc(d.desc) + '</p>' : '') +
      '<div class="rm-dlg__facts"><div>' + svg('area', 'ico') + '<b>' + r.size + ' sqm</b><small>Size</small></div><div>' + svg('user', 'ico') + '<b>' + r.guests + ' guests</b><small>Sleeps</small></div><div>' + svg('bed', 'ico') + '<b>' + esc(r.bed) + '</b><small>Bed</small></div><div>' + svg('sun', 'ico') + '<b>' + esc(d.view || '\u2013') + '</b><small>View</small></div></div>' +
      (d.amen.length ? '<div><h4>In your room</h4><ul class="rm-dlg__list">' + d.amen.map(function (a) { return '<li>' + svg(a[0]) + esc(a[1]) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div class="rm-dlg__know"><b>Good to know.</b> ' + esc(d.notes || 'Check-in from 2:00 PM, check-out by 11:00 AM. Extra bed on request, subject to availability. Breakfast, Wi-Fi, parking and pool access are included.') + '</div>' +
      '<div class="rm-dlg__foot"><div class="rm-price"><small>' + esc(r.plabel) + '</small><strong>&#8377;' + inr(r.price) + ' <sub>/ night</sub></strong>' + total + '</div>' +
      '<div class="rm-dlg__btns"><button type="button" class="rm-btn-ghost" data-dlg-save>' + (saved ? 'Saved &#10003;' : 'Save') + '</button><a class="theme-btn btn-style fill no-border" href="' + reserveUrl(id) + '"><span>Reserve This Stay</span></a></div></div>';
    if (!keep) { dlgBody.classList.remove('is-swap'); void dlgBody.offsetWidth; dlgBody.classList.add('is-swap'); dlgBody.scrollTop = 0; }
    $('[data-dlg-save]', dlgBody).addEventListener('click', function () { toggleSave(id); this.innerHTML = state.saved.indexOf(id) > -1 ? 'Saved &#10003;' : 'Save'; });
    if (!keep) history.replaceState(null, '', '#' + id);
  }
  function showPicture(src, alt) {
    var fresh = dlgImg.cloneNode(false); fresh.src = src; fresh.alt = alt || '';
    dlgImg.parentNode.replaceChild(fresh, dlgImg); dlgImg = fresh; dlgImg.id = 'rmDlgImg';
  }
  function openRoom(id, from) { fillRoom(id, 0); if (dlgOpen !== dlg) openDlg(dlg, from); }
  $('#rmDlgPrev').addEventListener('click', function () { stepRoom(-1); });
  $('#rmDlgNext').addEventListener('click', function () { stepRoom(1); });
  $$('[data-open]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openRoom(b.getAttribute('data-open'), b); });
  });

  /* ======================================================================
     HIGHLIGHT A ROOM (season picks, room finder)
     ====================================================================== */
  function highlight(id, note) {
    var go = function () {
      var card = cardById[id]; if (!card) return;
      $$('.rm-card.is-pick').forEach(function (c) { c.classList.remove('is-pick'); });
      scrollToEl(card.parentNode, 24);
      setTimeout(function () { card.classList.add('is-pick'); }, reduce ? 0 : 500);
      if (note) toast(note, 5200);
      setTimeout(function () { card.classList.remove('is-pick'); }, 9000);
    };
    if (state.filter !== 'all' && !matches(id)) { state.filter = 'all'; if (document.startViewTransition && !reduce) { document.startViewTransition(render).finished.then(go, go); } else { render(); go(); } }
    else go();
  }
  $$('[data-room-link]').forEach(function (b) {
    b.addEventListener('click', function () { var id = b.getAttribute('data-room-link'); if (cardById[id]) highlight(id, 'Our pick for this season: ' + roomName(id)); });
  });
  $$('[data-filter-link]').forEach(function (b) {
    b.addEventListener('click', function () { setFilter(b.getAttribute('data-filter-link')); scrollToEl($('#rm-list'), 14); });
  });
  function finderScore(who, why) {
    var need = who === 'family' || who === 'group' ? 4 : 2, best = null, top = -1e9;
    ids.forEach(function (id) {
      var c = cardData(id), d = DETAILS[id] || { has: {} }, tags = (cardById[id].getAttribute('data-tags') || '').split(' '), s = 0, isRoom = tags.indexOf('room') > -1;
      if (c.guests < need) s -= 50 + (need - c.guests) * 5;
      if (who === 'family') s += (tags.indexOf('family') > -1 ? 4 : 0) + (d.has.apart ? 2 : 0) + (d.has.lounge ? 1 : 0) - c.price / 5000;
      else if (who === 'group') s += c.size / 15 + c.guests;
      else if (why === 'business') s += (d.has.desk ? 3 : 0) + (isRoom ? 1 : 0) - c.price / 8000;
      else if (why === 'celebrate') s += (tags.indexOf('signature') > -1 ? 3 : 0) + (d.has.dining ? 2 : 0) + c.size / 30;
      else if (why === 'long') s += c.size / 25 + (d.has.lounge ? 1 : 0) + (d.has.desk ? 1 : 0) - c.price / 6000;
      else s += (d.has.shower ? 1.5 : 0) + (d.has.lounge ? 1 : 0) - c.price / (who === 'solo' ? 2500 : 6000) + (who === 'solo' && isRoom ? 2 : 0);
      if (s > top) { top = s; best = id; }
    });
    return best || ids[0];
  }
  $('#rmSuggest').addEventListener('click', function () {
    if (!ids.length) return;
    var who = $('#rmWho').value, why = $('#rmWhy').value, pre = finderPreset(who, why), id = cardById[pre] ? pre : finderScore(who, why);
    var d = DETAILS[id] || {}, reason = (d.tag || FINDER_WHY[id] || '').replace(/\.$/, '');
    highlight(id, 'We suggest the ' + roomName(id) + (reason ? ': ' + reason.charAt(0).toLowerCase() + reason.slice(1) : '') + '.');
  });

  /* ======================================================================
     SEASONS
     ====================================================================== */
  var seasonBox = $('#rmSeason');
  if (seasonBox) {
    var tabs = $$('.rm-tab', seasonBox), panels = $$('.rm-panel', seasonBox), ind = $('.rm-tabs__ind', seasonBox);
    var now = currentSeason(new Date());
    function pickSeason(id, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-season') === id;
        t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        if (on) {
          ind.style.setProperty('--y', t.offsetTop + 'px'); ind.style.setProperty('--h', t.offsetHeight + 'px');
          if (focus) t.focus();
        }
      });
      panels.forEach(function (p) { p.classList.toggle('is-on', p.getAttribute('data-season') === id); });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { pickSeason(t.getAttribute('data-season')); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length;
        if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); pickSeason(tabs[(i + 1) % n].getAttribute('data-season'), true); }
        if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); pickSeason(tabs[(i - 1 + n) % n].getAttribute('data-season'), true); }
      });
      if (t.getAttribute('data-season') === now) $('.rm-tab__now', t).classList.remove('rm-hide');
    });
    panels.forEach(function (p) {
      if (p.getAttribute('data-season') === now) $('[data-pill]', p).textContent = 'Now · ' + $('[data-pill]', p).textContent;
    });
    pickSeason(now);
    window.addEventListener('resize', function () { var on = $('.rm-tab[aria-selected="true"]', seasonBox); if (on) pickSeason(on.getAttribute('data-season')); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { pickSeason($('.rm-tab[aria-selected="true"]', seasonBox).getAttribute('data-season')); });

    /* festive countdown */
    var cd = $('[data-countdown]', seasonBox);
    if (cd) {
      var target = new Date(cd.getAttribute('data-countdown')).getTime(), cdWrap = cd.parentNode, units = {};
      $$('[data-u]', cd).forEach(function (u) { units[u.getAttribute('data-u')] = u; });
      var tickT;
      var tick = function () {
        var left = target - Date.now();
        if (left <= 0) { cdWrap.classList.add('rm-hide'); clearInterval(tickT); return; }
        var s = Math.floor(left / 1000);
        units.d.textContent = pad(Math.floor(s / 86400)); units.h.textContent = pad(Math.floor(s % 86400 / 3600));
        units.m.textContent = pad(Math.floor(s % 3600 / 60)); units.s.textContent = pad(s % 60);
      };
      tick(); tickT = setInterval(tick, 1000);
    }
  }

  /* ======================================================================
     CARD TILT (mouse only)
     ====================================================================== */
  if (finePointer && !reduce) {
    $$('.rm-card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.classList.add('is-tilting');
        card.style.setProperty('--ry', ((px - .5) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((.5 - py) * 6).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () {
        card.classList.remove('is-tilting');
        card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* ======================================================================
     START: first render, link in from the home page (rooms.html#family)
     ====================================================================== */
  refreshStay();
  render();
  var h = location.hash.slice(1);
  if (h && cardById[h]) window.addEventListener('load', function () { setTimeout(function () { scrollToEl($('#rm-list'), 14); openRoom(h); }, 500); });
  }

  /* ======================================================================
     ADMIN FEED: the published rooms from api/rooms.php replace the cards written in the HTML.
     If the feed cannot be reached (or looks wrong) nothing changes and the built-in list stays.
     ====================================================================== */
  function loadFeed() {
    if (!window.fetch) return Promise.resolve(null);
    var ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, FEED_WAIT);
    return fetch(FEED_URL, { cache: 'no-cache', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('feed ' + r.status); return r.json(); })
      .then(function (d) { clearTimeout(t); return d && d.ok === true && Array.isArray(d.rooms) ? d : null; })
      .catch(function () { clearTimeout(t); return null; });
  }

  function cellHTML(r, i, price, plabel) {
    var tags = r.tags || r.category || 'room', suite = r.category === 'suite', name = esc(r.name), bed = esc(r.bed);
    var badge = r.badge && r.badge.text ? '<span class="rm-badge' + (r.badge.style === 'gold' ? ' rm-badge--gold' : '') + '">' + esc(r.badge.text) + '</span>' : '';
    var chips = (r.amenities || []).slice(0, 3).map(function (a) { return '<li>' + svg(a.icon) + esc(a.label) + '</li>'; }).join('');
    return '<div class="rm-cell" data-rm style="--d:' + (i * 0.09).toFixed(2) + 's">' +
      '<article class="rm-card" data-id="' + esc(r.id) + '" data-tags="' + esc(tags) + '" data-price="' + (+price) + '" data-size="' + (+r.size) + '" data-guests="' + (+r.guests) + '" data-rank="' + (+r.rank || i + 1) + '"' + (plabel ? ' data-plabel="' + esc(plabel) + '"' : '') + '>' +
        '<div class="rm-card__media"><img src="' + esc(r.image) + '" loading="lazy" alt="' + esc(r.imageAlt || r.name) + '">' + badge +
          '<span class="rm-badge rm-badge--pick rm-badge--gold">Our pick for you</span>' +
          '<button class="rm-heart" type="button" aria-pressed="false" aria-label="Save ' + name + '"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#rm-i-heart"/></svg></button>' +
          '<span class="rm-full" data-full>Sleeps up to ' + (+r.guests) + '</span>' +
          '<div class="rm-card__over">' + (chips ? '<ul class="rm-amen">' + chips + '</ul>' : '') + '<button class="rm-quick" type="button" data-open="' + esc(r.id) + '">' + svg('eye') + ' Quick view</button></div></div>' +
        '<div class="rm-card__body"><span class="rm-card__cat">' + (suite ? 'Suite' : 'Room') + ' &middot; ' + bed + '</span>' +
          '<h3 class="rm-card__title"><a href="#' + esc(r.id) + '" data-open="' + esc(r.id) + '">' + name + '</a></h3>' +
          '<p class="rm-card__txt">' + esc(r.short) + '</p>' +
          '<ul class="rm-meta"><li>' + svg('area', 'ico') + ' ' + (+r.size) + ' sqm</li><li>' + svg('user', 'ico') + ' ' + (+r.guests) + ' guests</li><li>' + svg('bed', 'ico') + ' ' + bed + '</li></ul>' +
          '<div class="rm-card__foot"><div class="rm-price"><small>' + esc(plabel || 'From') + '</small><strong>&#8377;<span data-amt>' + inr(price) + '</span> <sub>/ night</sub></strong><em data-total></em></div>' +
            '<div class="rm-card__act"><label class="rm-cmp"><input type="checkbox" data-cmp="' + esc(r.id) + '"><i></i> Compare</label>' +
            '<a class="theme-btn btn-style sm-btn fill no-border" href="' + CONTACT_PAGE + '#enquiry" data-reserve="' + esc(r.id) + '"><span>Reserve</span></a></div></div></div>' +
      '</article></div>';
  }

  function applyFeed(feed) {
    var rooms = feed.rooms.filter(function (r) {
      return r && /^[a-z0-9-]+$/.test(r.id || '') && r.name && /^assets\/images\//.test(r.image || '') && +r.size > 0 && +r.guests > 0 && +r.price > 0;
    });
    if (feed.rooms.length && !rooms.length) return;             /* looks wrong: keep the built-in list */

    /* work everything out first, touch the page only at the end */
    var season = currentSeason(new Date()), seasonName = { festive: 'Festive', winter: 'Winter', summer: 'Summer', monsoon: 'Monsoon' }[season];
    var details = {}, html = '', byId = {};
    rooms.forEach(function (r, i) {
      var sp = r.seasonal && +r.seasonal[season] > 0 ? +r.seasonal[season] : 0, price = sp || +r.price, f = r.features || {};
      byId[r.id] = r;
      details[r.id] = {
        tag: r.tagline || '', view: r.view || '', desc: r.description || r.short || '', notes: r.notes || '',
        amen: (r.amenities || []).map(function (a) { return [a.icon, a.label]; }),
        has: { desk: !!f.desk, shower: !!f.shower, lounge: !!f.lounge, dining: !!f.dining, apart: !!f.apart },
        gallery: (r.gallery || []).filter(function (p) { return /^assets\/images\//.test(p); })
      };
      html += cellHTML(r, i, price, sp ? seasonName + ' rate' : '');
    });
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    var fresh = $$('.rm-cell', tmp);

    DETAILS = details;
    $$('.rm-cell', grid).forEach(function (c) { if (!c.classList.contains('rm-cell--help')) c.parentNode.removeChild(c); });
    var help = $('.rm-cell--help', grid);
    fresh.forEach(function (c) { grid.insertBefore(c, help); });
    observeReveal(fresh);

    /* the sentence under the page title */
    var lead = $('.rm-hero__lead'), words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
    if (lead && rooms.length) lead.textContent = lead.textContent.replace(/Five ways to stay/, (rooms.length <= 10 ? words[rooms.length] : rooms.length) + (rooms.length === 1 ? ' way' : ' ways') + ' to stay');

    /* "our pick" buttons in the season picker always point at a room that exists */
    var pref = { festive: 'family', winter: 'suite', summer: 'room', monsoon: 'room' };
    $$('.rm-pick').forEach(function (b) {
      var r = byId[b.getAttribute('data-room-link')];
      if (!r) {
        var panel = b.closest('.rm-panel'), want = pref[panel ? panel.getAttribute('data-season') : ''];
        r = rooms.filter(function (x) { return (x.tags || '').split(' ').indexOf(want) > -1; })[0] || rooms[0];
      }
      if (!r) { b.classList.add('rm-hide'); return; }
      b.setAttribute('data-room-link', r.id);
      $('img', b).setAttribute('src', r.image); $('b', b).textContent = r.name; $('span > span', b).textContent = r.tagline || r.short || '';
    });

    /* nothing is published at the moment */
    if (!rooms.length) {
      var em = $('#rmEmpty'), reset = $('#rmEmptyReset');
      $('h3', em).textContent = 'Our rooms are being refreshed';
      $('p', em).innerHTML = 'Please check back shortly, or call us on <a href="tel:' + PHONE + '">+91 99204 00267</a> and we will help you book.';
      if (reset) reset.classList.add('rm-hide');
      if (help) help.classList.add('rm-hide');
    }
  }

  loadFeed().then(function (feed) {
    if (feed) { try { applyFeed(feed); } catch (e) { /* keep the built-in list */ } }
    initListing();
  });
})();
