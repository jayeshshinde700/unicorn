/* Unicon Hospitality - Meetings & Events page (loads only on meetings-events.html, after the shared script). */
(function () {
  'use strict';
  if (window.__unEventsInit) return;          /* prevent duplicate initialisation */
  window.__unEventsInit = true;

  /* ---------------------------------------------------------------------------------------------
     VENUE CONTENT - CONFIGURE HERE.
     Replace each entry with verified Unicon details and your own photograph, then set verified:true
     to remove the "pending approval" flag. Leave a field null / [] to show "To be confirmed".
       capacity  : e.g. "Up to 120 guests"          seating   : ["Theatre", "Classroom", "Banquet", "U-shape"]
       area      : e.g. "180 sq m"                  facilities: ["Projector & screen", "Wi-Fi"]
       photoIsStock:true shows an "Illustrative image" tag - set false once the image is a real Unicon photo.
     The details below are NOT verified. They are development placeholders only. */
  var VENUES = [
    { id: 'event-space-1', verified: false, photoIsStock: true,
      name: 'Event Space One (name to be confirmed)',
      image: 'assets/images/events/banquet-setup.webp',
      description: 'Placeholder description. A flexible space for meetings, seminars or gatherings. Replace with the approved venue description.',
      capacity: null, seating: [], area: null, facilities: [] },
    { id: 'event-space-2', verified: false, photoIsStock: true,
      name: 'Event Space Two (name to be confirmed)',
      image: 'assets/images/events/conference-hall.webp',
      description: 'Placeholder description. Replace with the approved venue description and confirmed arrangements.',
      capacity: null, seating: [], area: null, facilities: [] },
    { id: 'event-space-3', verified: false, photoIsStock: true,
      name: 'Boardroom (name to be confirmed)',
      image: 'assets/images/events/boardroom-meeting.webp',
      description: 'Placeholder description for a smaller meeting space. Replace with the approved venue description.',
      capacity: null, seating: [], area: null, facilities: [] }
  ];

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $all = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(id) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  document.documentElement.classList.add('ev-js');

  /* ---------- venue cards (rendered from VENUES) ---------- */
  function spec(iconId, label, value) {
    var body = value ? esc(value) : '<span class="tbc">To be confirmed</span>';
    return '<li>' + icon(iconId) + '<div><b>' + label + '</b>' + body + '</div></li>';
  }
  function renderVenues() {
    var host = $('[data-ev-venues]');
    if (!host) return;
    host.innerHTML = VENUES.map(function (v, i) {
      return '<article class="ev-venue ev-reveal" style="--d:' + (i * 0.08) + 's">' +
        '<div class="ev-venue__media"><img src="' + esc(v.image) + '" width="1400" height="933" loading="lazy" decoding="async" alt="' + esc(v.name) + (v.photoIsStock ? ' (illustrative stock photograph)' : '') + '">' +
        (v.verified ? '' : '<span class="ev-flag">Placeholder &ndash; pending approval</span>') +
        (v.photoIsStock ? '<span class="ev-credit">Illustrative image</span>' : '') + '</div>' +
        '<div class="ev-venue__body"><h3>' + esc(v.name) + '</h3><p class="ev-venue__txt">' + esc(v.description) + '</p>' +
        '<ul class="ev-specs">' +
        spec('i-people', 'Capacity', v.capacity) +
        spec('ev-i-seat', 'Seating arrangements', v.seating && v.seating.length ? v.seating.join(', ') : '') +
        spec('i-area', 'Area', v.area) +
        spec('i-check', 'Facilities', v.facilities && v.facilities.length ? v.facilities.join(', ') : '') +
        '</ul><a href="#enquiry" class="theme-btn btn-style fill no-border" data-ev-enquire data-ev-venue="' + esc(v.id) + '"><span>Enquire About This Space</span></a></div></article>';
    }).join('');

    /* seating-layout icon is local to this page */
    if (!document.getElementById('ev-i-seat')) {
      var sp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      sp.setAttribute('width', '0'); sp.setAttribute('height', '0'); sp.setAttribute('style', 'position:absolute'); sp.setAttribute('aria-hidden', 'true');
      sp.innerHTML = '<symbol id="ev-i-seat" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/></symbol>';
      document.body.insertBefore(sp, document.body.firstChild);
    }

    var sel = $('#ev-venue');
    if (sel) VENUES.forEach(function (v) {
      var o = document.createElement('option'); o.value = v.id; o.textContent = v.name; sel.appendChild(o);
    });
  }

  /* ---------- scroll reveal ---------- */
  function setupReveal() {
    var items = $all('.ev-reveal');
    if (reduce || !('IntersectionObserver' in window)) { items.forEach(function (n) { n.classList.add('is-in'); }); return; }
    /* threshold 0: tall cards must never wait for a share of their height to be visible */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (n) { io.observe(n); });
    /* anything above the viewport (anchor jump, reload mid-page, fast scroll) is shown at once so no card is left invisible */
    function sweep() {
      items.forEach(function (n) { if (!n.classList.contains('is-in') && n.getBoundingClientRect().top < window.innerHeight) { n.classList.add('is-in'); io.unobserve(n); } });
    }
    window.addEventListener('scroll', sweep, { passive: true });
    window.addEventListener('load', sweep);
    window.setTimeout(sweep, 1500);
  }

  /* ---------- enquiry navigation + form ---------- */
  var form = $('#evForm'), typeSel = $('#ev-type'), venueSel = $('#ev-venue'), prefill = $('#evPrefill');

  function selectValue(sel, value) {
    if (!sel || !value) return false;
    var ok = Array.prototype.some.call(sel.options, function (o) { return o.value === value; });
    if (ok) { sel.value = value; var f = sel.closest('.ev-field'); if (f) f.classList.remove('is-bad'); }
    return ok;
  }
  function venueName(id) { var v = VENUES.filter(function (x) { return x.id === id; })[0]; return v ? v.name : ''; }

  function goToForm(type, venue) {
    var target = $('#enquiry');
    if (!target || !form) return;
    var bits = [];
    selectValue(typeSel, type); selectValue(venueSel, venue);          /* only the clicked trigger's values change; the rest is kept */
    if (typeSel.value) bits.push(typeSel.options[typeSel.selectedIndex].text);
    if (venueSel.value) bits.push(venueName(venueSel.value));
    if (prefill) {
      prefill.textContent = bits.length ? 'Enquiring about: ' + bits.join(' - ') : '';
      prefill.classList.toggle('is-on', bits.length > 0);
    }
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(function () {
      var first = $all('input[required], select[required]', form).filter(function (el) { return !el.value && el.type !== 'checkbox'; })[0] || $('#ev-name');
      if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
    }, reduce ? 0 : 650);
    if (history.replaceState) history.replaceState(null, '', '#enquiry');
  }

  function setupTriggers() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-ev-enquire]');
      if (a) { e.preventDefault(); goToForm(a.getAttribute('data-ev-type'), a.getAttribute('data-ev-venue')); return; }
      var s = e.target.closest && e.target.closest('[data-ev-scroll]');
      if (s) {
        var t = document.getElementById(s.getAttribute('data-ev-scroll'));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); if (history.replaceState) history.replaceState(null, '', '#' + t.id); }
      }
    });
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function setupForm() {
    if (!form) return;
    var msg = $('#evMsg'), btn = $('button[type=submit]', form), busy = false;
    $('#ev-date').min = todayStr();

    var rules = {
      'ev-name':    function (v) { return v.trim().length >= 2; },
      'ev-company': function (v) { return v.trim().length >= 2; },
      'ev-email':   function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
      'ev-phone':   function (v) { var d = v.replace(/\D/g, ''); return /^[0-9+\-\s()]+$/.test(v.trim()) && d.length >= 7 && d.length <= 15; },
      'ev-type':    function (v) { return v !== ''; },
      'ev-date':    function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= todayStr() && !isNaN(Date.parse(v)); },
      'ev-guests':  function (v) { return /^\d+$/.test(v) && +v >= 1 && +v <= 1000; },
      'ev-ok':      function (v, el) { return el.checked; }
    };
    function check(id) {
      var el = document.getElementById(id), ok = rules[id](el.value, el), f = el.closest('.ev-field');
      f.classList.toggle('is-bad', !ok);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) el.setAttribute('aria-describedby', id + '-err'); else el.removeAttribute('aria-describedby');
      return ok;
    }
    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('blur', function () { check(id); });
      ['input', 'change'].forEach(function (ev) { el.addEventListener(ev, function () { if (el.closest('.ev-field').classList.contains('is-bad')) check(id); }); });
    });

    function say(t, type) { msg.textContent = t; msg.className = 'ev-msg' + (type ? ' is-' + type : ''); }
    function setBusy(on) { busy = on; btn.classList.toggle('is-busy', on); btn.setAttribute('aria-disabled', on ? 'true' : 'false'); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      if (form.website.value) return;                                     /* honeypot filled: stay silent */
      var firstBad = null;
      Object.keys(rules).forEach(function (id) { if (!check(id) && !firstBad) firstBad = id; });
      if (firstBad) { say('Please check the highlighted fields.', 'err'); document.getElementById(firstBad).focus(); return; }

      setBusy(true); say('Sending your enquiry...', '');
      var data = new FormData(form);
      var vn = venueName(data.get('venue')); if (vn) data.set('venue', vn);   /* send the readable venue name */
      fetch(form.getAttribute('action'), { method: 'POST', body: data, headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (!res.ok || !res.data || res.data.ok !== true) {
            var errs = res.data && res.data.errors;
            if (errs) Object.keys(errs).forEach(function (k) {
              var f = form.querySelector('[name="' + k + '"]'); if (f && f.closest('.ev-field')) f.closest('.ev-field').classList.add('is-bad');
            });
            throw new Error((res.data && res.data.message) || 'failed');
          }
          form.reset(); if (prefill) prefill.classList.remove('is-on');
          say('Thank you. Your event enquiry has been received and our team will be in touch.', 'ok');
        })
        .catch(function (err) {
          var m = err && err.message && err.message !== 'failed' && err.message !== 'Failed to fetch' ? err.message + ' ' : '';
          say(m + 'Sorry, your enquiry could not be sent. Please try again, or call +91 99204 00267.', 'err');
        })
        .then(function () { setBusy(false); });
    });
  }

  /* ---------- FAQ accordion ---------- */
  function setupFaq() {
    var wrap = $('[data-ev-accordion]');
    if (!wrap) return;
    var btns = $all('.ev-acc button', wrap);
    wrap.classList.add('is-js');
    function panel(b) { return document.getElementById(b.getAttribute('aria-controls')); }
    function setOpen(b, on) { b.setAttribute('aria-expanded', on ? 'true' : 'false'); panel(b).style.height = on ? panel(b).scrollHeight + 'px' : '0px'; }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') === 'true';
        btns.forEach(function (o) { if (o !== b) setOpen(o, false); });
        setOpen(b, !open);
      });
    });
    window.addEventListener('resize', function () { btns.forEach(function (b) { if (b.getAttribute('aria-expanded') === 'true') panel(b).style.height = panel(b).scrollHeight + 'px'; }); });
  }

  /* ---------- lightbox (prev / next, keyboard, swipe) ---------- */
  function setupLightbox() {
    var shots = $all('[data-ev-lb]');
    if (!shots.length) return;
    var lb = document.createElement('div');
    lb.className = 'ev-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML = '<button type="button" class="ev-lb__x" aria-label="Close">&times;</button>' +
      '<button type="button" class="ev-lb__p" aria-label="Previous image">&#8249;</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="ev-lb__n" aria-label="Next image">&#8250;</button>';
    document.body.appendChild(lb);
    var img = $('img', lb), cap = $('figcaption', lb), idx = 0, opener = null;

    function show(i) {
      idx = (i + shots.length) % shots.length;
      var s = shots[idx], thumb = $('img', s);
      img.src = s.getAttribute('data-ev-lb');
      img.alt = thumb ? thumb.alt : '';
      cap.textContent = (s.getAttribute('data-cap') || '') + '  (' + (idx + 1) + ' / ' + shots.length + ')';
    }
    function open(i, from) { opener = from; show(i); lb.classList.add('is-open'); document.body.style.overflow = 'hidden'; $('.ev-lb__x', lb).focus(); }
    function close() { lb.classList.remove('is-open'); document.body.style.overflow = ''; if (opener) opener.focus(); }
    shots.forEach(function (s, i) { s.addEventListener('click', function () { open(i, s); }); });
    $('.ev-lb__x', lb).addEventListener('click', close);
    $('.ev-lb__p', lb).addEventListener('click', function () { show(idx - 1); });
    $('.ev-lb__n', lb).addEventListener('click', function () { show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') {                                          /* keep focus inside the dialog */
        var f = $all('button', lb), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    var x0 = null;                                                         /* swipe */
    lb.addEventListener('touchstart', function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  renderVenues();
  setupReveal();
  setupTriggers();
  setupForm();
  setupFaq();
  setupLightbox();

  /* arriving with #enquiry in the URL: make sure the form is brought into view after layout settles */
  if (location.hash === '#enquiry') window.setTimeout(function () { var t = $('#enquiry'); if (t) t.scrollIntoView(); }, 400);
})();
