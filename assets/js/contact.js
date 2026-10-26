/* Unicorn Hospitality - contact page form (loads only on contact.html) */
(function () {
  'use strict';
  var form = document.getElementById('contactForm');
  if (!form) return;

  /* To make the form live, paste your Formspree / Web3Forms / own endpoint URL here.
     Leave it empty to run in demo mode (nothing is sent). */
  var ENDPOINT = '';

  var msg = document.getElementById('contactMsg');
  var btn = form.querySelector('button[type=submit]');
  var rules = {
    'cf-name':    function (v) { return v.trim().length >= 2; },
    'cf-email':   function (v) { return /^\S+@\S+\.\S+$/.test(v.trim()); },
    'cf-phone':   function (v) { return v.trim() === '' || /^[0-9+\-\s()]{7,18}$/.test(v.trim()); },
    'cf-subject': function (v) { return v !== ''; },
    'cf-msg':     function (v) { return v.trim().length >= 10; },
    'cf-ok':      function (v, el) { return el.checked; }
  };

  function check(id) {
    var el = document.getElementById(id), ok = rules[id](el.value, el);
    el.closest('.um-field').classList.toggle('is-bad', !ok);
    return ok;
  }
  Object.keys(rules).forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('blur', function () { check(id); });
    el.addEventListener('input', function () { if (el.closest('.um-field').classList.contains('is-bad')) check(id); });
    el.addEventListener('change', function () { if (el.closest('.um-field').classList.contains('is-bad')) check(id); });
  });

  /* preselect the topic from a link such as contact.html?subject=Dining%20%26%20table%20reservation */
  try {
    var pre = new URLSearchParams(location.search).get('subject'), sel = document.getElementById('cf-subject');
    if (pre) Array.prototype.forEach.call(sel.options, function (o) { if (o.text === pre) sel.value = o.value || o.text; });
  } catch (e) {}

  function say(text, type) { msg.textContent = text; msg.className = 'um-form-msg' + (type ? ' is-' + type : ''); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.website.value) return;                       /* spam trap filled: stay silent */
    var firstBad = null;
    Object.keys(rules).forEach(function (id) { if (!check(id) && !firstBad) firstBad = id; });
    if (firstBad) { say('Please check the highlighted fields.', 'err'); document.getElementById(firstBad).focus(); return; }

    if (!ENDPOINT) {
      say('Thank you! (Demo mode: connect a form endpoint in 2026-10-24-contact-page.js to receive real enquiries.)', 'ok');
      form.reset(); return;
    }
    btn.disabled = true; say('Sending...', '');
    fetch(ENDPOINT, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); say('Thank you! We have your message and will reply shortly.', 'ok'); form.reset(); })
      .catch(function () { say('Sorry, that did not go through. Please call +91 99204 00267 or email us directly.', 'err'); })
      .then(function () { btn.disabled = false; });
  });
})();