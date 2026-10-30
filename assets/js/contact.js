/* Unicon Hospitality - contact page (loads only on contact.html) */
(function () {
  'use strict';

  /* Verified property details. Fill these in once the business confirms them:
     address  - full postal address shown on the page
     mapQuery - address or "lat,lng" used for the embedded map and Get Directions
     email    - verified company email (leave '' to keep the one in the page markup) */
  var PROPERTY = { address: '', mapQuery: '', email: '' };

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- property details, map and directions ---------- */
  function setupProperty() {
    if (PROPERTY.email) {
      $all('[data-uc="email"]').forEach(function (el) { el.textContent = PROPERTY.email; });
      $all('[data-uc="email-link"]').forEach(function (el) { el.href = 'mailto:' + PROPERTY.email; });
    }
    if (PROPERTY.address) $all('[data-uc="address"]').forEach(function (el) { el.textContent = PROPERTY.address; });

    var dirs = $all('[data-uc="directions"]');
    if (PROPERTY.mapQuery) {
      var q = encodeURIComponent(PROPERTY.mapQuery);
      dirs.forEach(function (a) { a.href = 'https://www.google.com/maps/dir/?api=1&destination=' + q; a.target = '_blank'; a.rel = 'noopener'; });
      var box = document.getElementById('ucMap');
      if (box) {
        box.innerHTML = '<iframe title="Unicon Hospitality on the map" src="https://www.google.com/maps?q=' + q + '&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>';
      }
    } else {
      dirs.forEach(function (a) {
        if (a.classList.contains('uc-link')) a.setAttribute('aria-disabled', 'true');
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var note = document.getElementById('ucDirNote');
          if (note) note.textContent = 'Directions will be available once our property address is confirmed. Please call +91 99204 00267 for help finding us.';
        });
      });
    }
  }

  /* ---------- scroll reveal ---------- */
  function setupReveal() {
    var items = $all('.uc-reveal');
    if (reduce || !('IntersectionObserver' in window)) { items.forEach(function (n) { n.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------- enquiry form ---------- */
  var form = document.getElementById('contactForm');
  var typeSel = form && document.getElementById('cf-type');

  function scrollToForm() {
    var target = document.getElementById('enquiry');
    if (!target) return;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(function () {
      var first = form.querySelector('#cf-name');
      if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
    }, reduce ? 0 : 600);
  }

  function setType(value) {
    if (!typeSel || !value) return;
    var ok = Array.prototype.some.call(typeSel.options, function (o) { return o.value === value; });
    if (!ok) return;
    typeSel.value = value;
    var f = typeSel.closest('.uc-field');
    if (f) f.classList.remove('is-bad');
  }

  function setupTriggers() {
    $all('[data-enquiry]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        setType(a.getAttribute('data-enquiry'));
        scrollToForm();
        if (history.replaceState) history.replaceState(null, '', '#enquiry');
      });
    });
    $all('[data-uc-scroll]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); scrollToForm(); });
    });
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function setupForm() {
    if (!form) return;
    var msg = document.getElementById('contactMsg');
    var btn = form.querySelector('button[type=submit]');
    var inEl = document.getElementById('cf-in'), outEl = document.getElementById('cf-out');
    var busy = false;

    inEl.min = todayStr();
    outEl.min = todayStr();

    var rules = {
      'cf-name':   function (v) { return v.trim().length >= 2; },
      'cf-email':  function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
      'cf-phone':  function (v) { var d = v.replace(/\D/g, ''); return /^[0-9+\-\s()]+$/.test(v.trim()) && d.length >= 7 && d.length <= 15; },
      'cf-type':   function (v) { return v !== ''; },
      'cf-in':     function (v) { return v === '' || v >= todayStr(); },
      'cf-out':    function (v) { return v === '' || (v >= todayStr() && (inEl.value === '' || v > inEl.value)); },
      'cf-guests': function (v) { return v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 1000); },
      'cf-msg':    function (v) { return v.trim().length >= 10; },
      'cf-ok':     function (v, el) { return el.checked; }
    };

    function check(id) {
      var el = document.getElementById(id), ok = rules[id](el.value, el);
      el.closest('.uc-field').classList.toggle('is-bad', !ok);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) el.setAttribute('aria-describedby', id + '-err'); else el.removeAttribute('aria-describedby');
      return ok;
    }

    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('blur', function () { check(id); });
      ['input', 'change'].forEach(function (ev) {
        el.addEventListener(ev, function () { if (el.closest('.uc-field').classList.contains('is-bad')) check(id); });
      });
    });
    inEl.addEventListener('change', function () {
      if (inEl.value) outEl.min = inEl.value;
      if (outEl.value) check('cf-out');
    });

    function say(text, type) { msg.textContent = text; msg.className = 'uc-msg' + (type ? ' is-' + type : ''); }
    function busyState(on) {
      busy = on;
      btn.classList.toggle('is-busy', on);
      btn.setAttribute('aria-disabled', on ? 'true' : 'false');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;                                         /* duplicate-submission guard */
      if (form.website.value) return;                           /* spam trap filled: stay silent */
      var firstBad = null;
      Object.keys(rules).forEach(function (id) { if (!check(id) && !firstBad) firstBad = id; });
      if (firstBad) { say('Please check the highlighted fields.', 'err'); document.getElementById(firstBad).focus(); return; }

      busyState(true);
      say('Sending your enquiry...', '');
      fetch(form.getAttribute('action'), { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, data: d }; });
        })
        .then(function (res) {
          if (!res.ok || !res.data || res.data.ok !== true) {
            var errs = res.data && res.data.errors;
            if (errs) {
              Object.keys(errs).forEach(function (k) {
                var f = form.querySelector('[name="' + k + '"]');
                if (f && f.closest('.uc-field')) f.closest('.uc-field').classList.add('is-bad');
              });
            }
            throw new Error((res.data && res.data.message) || 'failed');
          }
          form.reset();
          say('Thank you. Your enquiry has been received and our team will be in touch.', 'ok');
        })
        .catch(function (err) {
          var m = err && err.message && err.message !== 'failed' && err.message !== 'Failed to fetch' ? err.message + ' ' : '';
          say(m + 'Sorry, your enquiry could not be sent. Please try again, or call +91 99204 00267.', 'err');
        })
        .then(function () { busyState(false); });
    });

    /* preselect from contact.html?type=weddings (or ?subject=) */
    try { var p = new URLSearchParams(location.search); setType(p.get('type') || p.get('subject')); } catch (e) {}
  }

  /* ---------- FAQ accordion (one open at a time) ---------- */
  function setupFaq() {
    var wrap = document.querySelector('[data-uc-accordion]');
    if (!wrap) return;
    var btns = $all('.uc-acc button', wrap);
    wrap.classList.add('is-js');
    function panel(b) { return document.getElementById(b.getAttribute('aria-controls')); }
    function setOpen(b, on) {
      var p = panel(b);
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
      p.classList.toggle('is-open', on);
      p.style.height = on ? p.scrollHeight + 'px' : '0px';
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') === 'true';
        btns.forEach(function (o) { if (o !== b) setOpen(o, false); });
        setOpen(b, !open);
      });
    });
    /* keep an open answer the right height when the viewport (and text wrapping) changes */
    window.addEventListener('resize', function () {
      btns.forEach(function (b) { if (b.getAttribute('aria-expanded') === 'true') panel(b).style.height = panel(b).scrollHeight + 'px'; });
    });
  }

  setupProperty();
  setupReveal();
  setupTriggers();
  setupForm();
  setupFaq();
})();
