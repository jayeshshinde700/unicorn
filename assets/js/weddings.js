/* Unicon Hospitality - Weddings page (loads only on weddings.html, after the shared script). */
(function () {
  'use strict';
  if (window.__unWeddingsInit) return;        /* prevent duplicate initialisation */
  window.__unWeddingsInit = true;

  /* Preferred-venue options for the enquiry form. Add { id, name } entries here only once real venue details are confirmed;
     while the list is empty the field offers just "No preference / not sure". */
  var VENUES = [];

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $all = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  document.documentElement.classList.add('wd-js');

  /* ---------- preferred-venue options ---------- */
  function renderVenues() {
    var sel = $('#wd-venue');
    if (sel) VENUES.forEach(function (v) { var o = document.createElement('option'); o.value = v.id; o.textContent = v.name; sel.appendChild(o); });
  }

  /* ---------- scroll reveal ---------- */
  function setupReveal() {
    var items = $all('.wd-reveal');
    if (reduce || !('IntersectionObserver' in window)) { items.forEach(function (n) { n.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------- enquiry navigation + form ---------- */
  var form = $('#wdForm'), typeSel = $('#wd-type'), venueSel = $('#wd-venue'), prefill = $('#wdPrefill');

  function selectValue(sel, value) {
    if (!sel || !value) return false;
    var ok = Array.prototype.some.call(sel.options, function (o) { return o.value === value; });
    if (ok) { sel.value = value; var f = sel.closest('.wd-field'); if (f) f.classList.remove('is-bad'); }
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
      var first = $all('input[required], select[required]', form).filter(function (el) { return !el.value && el.type !== 'checkbox'; })[0] || $('#wd-couple');
      if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
    }, reduce ? 0 : 650);
    if (history.replaceState) history.replaceState(null, '', '#enquiry');
  }

  function setupTriggers() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-wd-enquire]');
      if (a) { e.preventDefault(); goToForm(a.getAttribute('data-wd-type'), a.getAttribute('data-wd-venue')); return; }
      var s = e.target.closest && e.target.closest('[data-wd-scroll]');
      if (s) {
        var t = document.getElementById(s.getAttribute('data-wd-scroll'));
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
    var msg = $('#wdMsg'), btn = $('button[type=submit]', form), busy = false;
    $('#wd-date').min = todayStr();

    var rules = {
      'wd-couple':  function (v) { return v.trim().length >= 2; },
      'wd-contact': function (v) { return v.trim().length >= 2; },
      'wd-email':   function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
      'wd-phone':   function (v) { var d = v.replace(/\D/g, ''); return /^[0-9+\-\s()]+$/.test(v.trim()) && d.length >= 7 && d.length <= 15; },
      'wd-date':    function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= todayStr() && !isNaN(Date.parse(v)); },
      'wd-type':    function (v) { return v !== ''; },
      'wd-guests':  function (v) { return /^\d+$/.test(v) && +v >= 1 && +v <= 2000; },
      'wd-rooms':   function (v) { return v === '' || (/^\d+$/.test(v) && +v <= 500); },
      'wd-ok':      function (v, el) { return el.checked; }
    };
    function check(id) {
      var el = document.getElementById(id), ok = rules[id](el.value, el), f = el.closest('.wd-field');
      f.classList.toggle('is-bad', !ok);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) el.setAttribute('aria-describedby', id + '-err'); else el.removeAttribute('aria-describedby');
      return ok;
    }
    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('blur', function () { check(id); });
      ['input', 'change'].forEach(function (ev) { el.addEventListener(ev, function () { if (el.closest('.wd-field').classList.contains('is-bad')) check(id); }); });
    });

    function say(t, type) { msg.textContent = t; msg.className = 'wd-msg' + (type ? ' is-' + type : ''); }
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
              var f = form.querySelector('[name="' + k + '"]'); if (f && f.closest('.wd-field')) f.closest('.wd-field').classList.add('is-bad');
            });
            throw new Error((res.data && res.data.message) || 'failed');
          }
          form.reset(); if (prefill) prefill.classList.remove('is-on');
          say('Thank you. Your wedding enquiry has been received and our team will be in touch.', 'ok');
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
    var wrap = $('[data-wd-accordion]');
    if (!wrap) return;
    var btns = $all('.wd-acc button', wrap);
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

  /* ---------- gallery: category filter + lightbox over the visible images ---------- */
  function setupGallery() {
    var grid = $('#wdGallery');
    if (!grid) return;
    var shots = $all('.wd-shot', grid), chips = $all('.wd-chip');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var f = c.getAttribute('data-filter');
        chips.forEach(function (o) { o.setAttribute('aria-pressed', o === c ? 'true' : 'false'); });
        shots.forEach(function (s) { s.hidden = !(f === 'all' || s.getAttribute('data-cat') === f); });
      });
    });

    var lb = document.createElement('div');
    lb.className = 'wd-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML = '<button type="button" class="wd-lb__x" aria-label="Close">&times;</button>' +
      '<button type="button" class="wd-lb__p" aria-label="Previous image">&#8249;</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="wd-lb__n" aria-label="Next image">&#8250;</button>';
    document.body.appendChild(lb);
    var img = $('img', lb), cap = $('figcaption', lb), list = [], idx = 0, opener = null;

    function show(i) {
      idx = (i + list.length) % list.length;
      var s = list[idx], thumb = $('img', s);
      img.src = s.getAttribute('data-wd-lb');
      img.alt = thumb ? thumb.alt : '';
      cap.textContent = (s.getAttribute('data-cap') || '') + '  (' + (idx + 1) + ' / ' + list.length + ')';
    }
    function open(s) {
      list = shots.filter(function (x) { return !x.hidden; });
      opener = s; show(list.indexOf(s));
      lb.classList.add('is-open'); document.body.style.overflow = 'hidden'; $('.wd-lb__x', lb).focus();
    }
    function close() { lb.classList.remove('is-open'); document.body.style.overflow = ''; if (opener) opener.focus(); }
    shots.forEach(function (s) { s.addEventListener('click', function () { open(s); }); });
    $('.wd-lb__x', lb).addEventListener('click', close);
    $('.wd-lb__p', lb).addEventListener('click', function () { show(idx - 1); });
    $('.wd-lb__n', lb).addEventListener('click', function () { show(idx + 1); });
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

  /* ---------- room carousel (Swiper is loaded by the page) ---------- */
  function setupRooms() {
    var el = $('#wdRoomSwiper');
    if (!el || !window.Swiper || el.swiper) return;
    new Swiper(el, {
      slidesPerView: 1.2, spaceBetween: 16, grabCursor: true, speed: reduce ? 0 : 600, watchOverflow: true,
      pagination: { el: '#wdRoomSwiper .swiper-pagination', clickable: true },
      navigation: { prevEl: '#wdRoomPrev', nextEl: '#wdRoomNext' },
      breakpoints: { 640: { slidesPerView: 2, spaceBetween: 20 }, 992: { slidesPerView: 3, spaceBetween: 24 }, 1280: { slidesPerView: 4, spaceBetween: 24 } }
    });
  }

  renderVenues();
  setupReveal();
  setupTriggers();
  setupForm();
  setupFaq();
  setupGallery();
  setupRooms();

  if (location.hash === '#enquiry') window.setTimeout(function () { var t = $('#enquiry'); if (t) t.scrollIntoView(); }, 400);
})();
