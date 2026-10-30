/* Unicorn Hospitality - Dining page (loads only on dining.html, after the shared site script) */
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
  var prog = $('#dnProgress'), heroBg = $('#dnHeroBg'), hero = $('#dnHero'), ticking = false;
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
      outer.className = 'dn-w'; outer.setAttribute('aria-hidden', 'true');
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
  observeReveal($$('[data-dn]'));
  observeReveal($$('.dn-hl__box, .dn-tl'));

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
     EDIT HERE: opening hours and weekly events
     ====================================================================== */
  var HOURS = { open: 12, close: 24, openLabel: '12:00 PM', closeLabel: 'midnight' };   /* hours as 24h numbers (close 24 = midnight) */
  var RES_EMAIL = 'stay@unicornhospitality.example';
  var PHONE_TEL = '+919920400267';
  /* days: 0 = Sunday ... 6 = Saturday.  icon: mic | tv | tag */
  var EVENTS = [
    { icon: 'mic', title: 'Acoustic Nights', days: [5, 6], when: 'Fri & Sat', time: '8:00 PM', desc: 'Live acoustic sets by local artists, soft lights and a cocktail in hand. Arrive early for the best seats near the stage.' },
    { icon: 'tv', title: 'Sports Screenings', days: [0, 6], when: 'Match days', time: 'Kick-off', desc: 'Big matches on the big screen with beer buckets, sharing platters and a crowd that cheers together.' },
    { icon: 'tag', title: 'Happy Hours', days: [1, 2, 3, 4, 5], when: 'Mon – Fri', time: '5:00 PM – 7:00 PM', desc: 'Better prices on selected cocktails, beers and bar bites while the sun goes down over the city.' }
  ];
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ico(n) { return '<svg class="dn-ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#dn-i-' + n + '"/></svg>'; }
  function hoursNow() { var d = new Date(); return d.getHours() + d.getMinutes() / 60; }

  /* hero: open-now chip */
  var openChip = $('#dnOpen');
  if (openChip) {
    var h = hoursNow(), isOpen = h >= HOURS.open && h < HOURS.close;
    $('span', openChip).textContent = (isOpen ? 'Open now' : 'Opens ' + HOURS.openLabel) + ' · ' + HOURS.openLabel + ' – ' + HOURS.closeLabel;
  }
  $$('[data-hours]').forEach(function (el) { el.textContent = HOURS.openLabel + ' – ' + HOURS.closeLabel; });

  /* ======================================================================
     DAY TO NIGHT
     ====================================================================== */
  var dtn = $('#dnDtn');
  if (dtn) {
    var steps = $$('.dn-step', dtn), pans = $$('.dn-stage__p', dtn), imgs = $$('.dn-dtn__bg img', dtn), fill = $('.dn-steps__fill', dtn);
    var stage = 0, timer = null, inView = false;
    var setStage = function (i) {
      stage = (i + steps.length) % steps.length;
      dtn.setAttribute('data-stage', stage);
      steps.forEach(function (s, k) { s.classList.toggle('is-on', k === stage); s.setAttribute('aria-selected', String(k === stage)); });
      pans.forEach(function (p, k) { p.classList.toggle('is-on', k === stage); });
      imgs.forEach(function (m, k) { m.classList.toggle('is-on', k === stage); });
      fill.style.setProperty('--p', (stage / (steps.length - 1)).toFixed(3));
    };
    var play = function () { stop(); if (!reduce && inView) timer = setInterval(function () { setStage(stage + 1); }, 6500); };
    var stop = function () { clearInterval(timer); timer = null; };
    steps.forEach(function (s, k) { s.addEventListener('click', function () { setStage(k); play(); }); });
    dtn.addEventListener('mouseenter', stop); dtn.addEventListener('mouseleave', play);
    setStage(0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; inView ? play() : stop(); }, { threshold: 0.35 }).observe(dtn);
    }
  }

  /* ======================================================================
     BAR CAROUSEL
     ====================================================================== */
  var track = $('#dnTrack');
  if (track) {
    var prev = $('#dnPrev'), next = $('#dnNext'), barI = $('.dn-rail__bar i');
    var stepW = function () { var c = $('.dn-bcard', track); return c ? c.offsetWidth + 20 : 300; };
    var upd = function () {
      var max = track.scrollWidth - track.clientWidth, x = track.scrollLeft;
      prev.disabled = x <= 4; next.disabled = x >= max - 4;
      var w = barI.parentNode.clientWidth, bw = Math.max(0.2, track.clientWidth / track.scrollWidth) * w;
      barI.style.width = bw + 'px';
      barI.style.setProperty('--x', (max > 0 ? (x / max) * (w - bw) : 0) + 'px');
    };
    prev.addEventListener('click', function () { track.scrollBy({ left: -stepW(), behavior: reduce ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: stepW(), behavior: reduce ? 'auto' : 'smooth' }); });
    track.addEventListener('scroll', function () { requestAnimationFrame(upd); }, { passive: true });
    window.addEventListener('resize', upd); upd(); setTimeout(upd, 600);
    /* drag to scroll with a mouse */
    var down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; track.classList.add('is-drag'); }
      if (moved) track.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return; down = false;
      if (moved) { track.classList.remove('is-drag'); var w = stepW(); track.scrollTo({ left: Math.round(track.scrollLeft / w) * w, behavior: 'smooth' }); }
    });
  }

  /* ======================================================================
     MENU TABS
     ====================================================================== */
  var mtabs = $$('.dn-mtab'), mpans = $$('.dn-mpanel'), mimgs = $$('.dn-menu__pic img'), mcap = $('#dnMenuCap');
  function setMenu(k) {
    mtabs.forEach(function (t, i) { t.setAttribute('aria-selected', String(i === k)); });
    mpans.forEach(function (p, i) { p.classList.toggle('is-on', i === k); });
    mimgs.forEach(function (m, i) { m.classList.toggle('is-on', i === k); });
    if (mcap) { var t = mtabs[k]; mcap.innerHTML = '<small>' + esc(t.getAttribute('data-sub')) + '</small>' + esc(t.getAttribute('data-name')); }
  }
  mtabs.forEach(function (t, i) { t.addEventListener('click', function () { setMenu(i); }); });
  if (mtabs.length) setMenu(0);

  /* ======================================================================
     WEEKLY EVENTS (built from the EVENTS list above)
     ====================================================================== */
  var evGrid = $('#dnEvGrid'), dayBox = $('#dnDays');
  if (evGrid && dayBox) {
    var today = new Date().getDay(), pick = 'all';
    evGrid.innerHTML = EVENTS.map(function (e, i) {
      return '<article class="dn-evc" data-days="' + e.days.join(',') + '" data-dn style="--d:' + (i * 0.1) + 's">' +
        '<span class="dn-evc__now"><i></i>On today</span>' +
        '<div class="dn-evc__ico">' + ico(e.icon) + '</div>' +
        '<div class="dn-evc__when"><span>' + esc(e.when) + '</span><span class="is-time">' + esc(e.time) + '</span></div>' +
        '<h3>' + esc(e.title) + '</h3><p>' + esc(e.desc) + '</p>' +
        '<a class="dn-link" href="#dn-reserve" data-jump="#dn-reserve">Reserve a table ' + ico('arrow-r') + '</a></article>';
    }).join('');
    var evs = $$('.dn-evc', evGrid);
    evs.forEach(function (c) { if (c.getAttribute('data-days').split(',').indexOf(String(today)) > -1) c.classList.add('is-today'); });
    dayBox.innerHTML = '<button type="button" class="dn-day" data-d="all" aria-pressed="true"><b>All</b>week</button>' +
      DAY_NAMES.map(function (n, i) { return '<button type="button" class="dn-day' + (i === today ? ' is-today' : '') + '" data-d="' + i + '" aria-pressed="false"><b>' + n + '</b>&nbsp;</button>'; }).join('');
    var dbtns = $$('.dn-day', dayBox);
    dbtns.forEach(function (b) {
      b.addEventListener('click', function () {
        pick = b.getAttribute('data-d');
        dbtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        evs.forEach(function (c) {
          var ok = pick === 'all' || c.getAttribute('data-days').split(',').indexOf(pick) > -1;
          if (ok) { c.classList.remove('dn-hide'); raf2(function () { c.classList.remove('is-out'); }); }
          else { c.classList.add('is-out'); setTimeout(function () { if (c.classList.contains('is-out')) c.classList.add('dn-hide'); }, reduce ? 0 : 420); }
        });
      });
    });
    $$('[data-jump]', evGrid).forEach(function (a) { a.addEventListener('click', function (e) { var t = $(a.getAttribute('data-jump')); if (t) { e.preventDefault(); scrollToEl(t); } }); });
    observeReveal(evs);
  }

  /* ======================================================================
     RESERVATION FORM (prepares an email enquiry; the team confirms by phone or email)
     ====================================================================== */
  var form = $('#dnForm');
  if (form) {
    var dateEl = $('#dnDate'), timeEl = $('#dnTime'), nameEl = $('#dnName'), telEl = $('#dnTel'), msg = $('#dnMsg');
    var count = $('#dnCount'), party = 2;
    if (window.flatpickr && dateEl) flatpickr(dateEl, { dateFormat: 'D, d M Y', minDate: 'today', disableMobile: true });
    for (var t = HOURS.open; t < HOURS.close; t += 0.5) {
      var hh = Math.floor(t), mm = t % 1 ? '30' : '00', ap = hh >= 12 ? 'PM' : 'AM', lab = (hh % 12 || 12) + ':' + mm + ' ' + ap;
      var o = document.createElement('option'); o.value = lab; o.textContent = lab; timeEl.appendChild(o);
    }
    var setParty = function (n) { party = Math.max(1, Math.min(20, n)); count.textContent = party + (party === 1 ? ' guest' : ' guests'); };
    setParty(2);
    $('#dnMinus').addEventListener('click', function () { setParty(party - 1); });
    $('#dnPlus').addEventListener('click', function () { setParty(party + 1); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = [];
      [dateEl, timeEl, nameEl, telEl].forEach(function (el) { var v = el.value.trim(); var ok = v && (el !== telEl || v.replace(/\D/g, '').length >= 8); el.classList.toggle('is-bad', !ok); if (!ok) bad.push(el); });
      msg.classList.toggle('is-bad', bad.length > 0);
      if (bad.length) { msg.textContent = 'Please fill in the highlighted fields.'; bad[0].focus(); return; }
      var seat = $('input[name="seat"]:checked', form).value;
      var body = 'Table request\n\nName: ' + nameEl.value.trim() + '\nPhone: ' + telEl.value.trim() + '\nDate: ' + dateEl.value + '\nTime: ' + timeEl.value + '\nGuests: ' + party + '\nSeating: ' + seat;
      msg.textContent = 'Thank you, ' + nameEl.value.trim().split(' ')[0] + '. Your email app will open with your request. We will confirm your table by phone or email.';
      window.location.href = 'mailto:' + RES_EMAIL + '?subject=' + encodeURIComponent('Table request: ' + dateEl.value + ', ' + timeEl.value) + '&body=' + encodeURIComponent(body);
    });
    $$('input,select', form).forEach(function (el) { el.addEventListener('input', function () { el.classList.remove('is-bad'); }); });
  }

  /* ======================================================================
     FAQ: only one answer open at a time
     ====================================================================== */
  var faqs = $$('.dn-faq .um-faq__item');
  faqs.forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) faqs.forEach(function (o) { if (o !== d) o.open = false; }); });
  });
})();
