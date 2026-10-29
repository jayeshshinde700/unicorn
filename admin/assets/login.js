/* Unicorn Hospitality - admin sign-in page: show password, caps-lock hint, strength meter, lock countdown */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var form = $('#lgForm'), pass = $('#lgPass'), eye = $('#lgEye'), caps = $('#lgCaps'), btn = $('#lgBtn');
  if (!form) return;

  /* show / hide password */
  if (eye) eye.addEventListener('click', function () {
    var show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    var p2 = $('#lgPass2'); if (p2) p2.type = pass.type;
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    pass.focus();
  });

  /* caps lock hint */
  function capsCheck(e) { if (e.getModifierState && caps) caps.hidden = !e.getModifierState('CapsLock'); }
  [pass, $('#lgPass2')].forEach(function (el) { if (el) { el.addEventListener('keydown', capsCheck); el.addEventListener('keyup', capsCheck); el.addEventListener('blur', function () { caps.hidden = true; }); } });

  /* strength meter (first-time setup only) */
  var meter = $('#lgMeter'), txt = $('#lgMeterTxt');
  if (meter) {
    var words = ['At least 10 characters. A few random words make a strong password.', 'Too weak. Add more characters.', 'Getting there. Mix in more variety.', 'Good password.', 'Excellent password.'];
    pass.addEventListener('input', function () {
      var v = pass.value, s = 0;
      if (v.length >= 10) s++;
      if (v.length >= 14) s++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v)) s++;
      if (/[^A-Za-z0-9]/.test(v) || v.length >= 18) s++;
      if (v.length < 10) s = v.length ? 1 : 0;
      meter.setAttribute('data-s', s);
      txt.textContent = words[s];
    });
  }

  /* lock countdown */
  var err = $('#lgErr');
  if (err && err.getAttribute('data-lock')) {
    var left = parseInt(err.getAttribute('data-lock'), 10), out = err.querySelector('.lg__count');
    var tick = function () {
      if (left <= 0) { out.textContent = ''; btn.disabled = false; err.querySelector('span').textContent = 'You can try again now.'; return; }
      var m = Math.floor(left / 60), s = left % 60;
      out.textContent = '(' + m + ':' + (s < 10 ? '0' : '') + s + ')';
      left--; setTimeout(tick, 1000);
    };
    tick();
  }

  /* busy state, and no double submit */
  form.addEventListener('submit', function (e) {
    if (btn.classList.contains('is-busy')) { e.preventDefault(); return; }
    var u = $('#lgUser'), bad = !u.value.trim() || !pass.value;
    if (bad) { e.preventDefault(); form.classList.remove('is-error'); void form.offsetWidth; form.classList.add('is-error'); (u.value.trim() ? pass : u).focus(); return; }
    btn.classList.add('is-busy');
  });
})();
