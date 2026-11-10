/* Unicon Hospitality - footer behaviour (newsletter form + verified-contact details).
   There is no newsletter backend yet, so the form validates the address and says so honestly - it never claims a subscription.
   To go live later, add data-endpoint="<url>" to #newsForm and this script will POST the email there. */
(function () {
  'use strict';
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

  ready(function () {
    /* verified email: only shown once property.js has a real one (placeholder addresses are never published) */
    var P = window.UNICON_PROPERTY || {};
    if (P.email) {
      var li = document.querySelector('.uf [data-uf="email"]');
      if (li) {
        var a = li.querySelector('a'); a.href = 'mailto:' + P.email; a.textContent = P.email; li.hidden = false;
      }
    }

    var form = document.getElementById('newsForm');
    if (!form) return;
    var input = document.getElementById('subscription');
    var msg = document.getElementById('newsMsg');
    function say(t, err) { msg.textContent = t; msg.classList.toggle('is-err', !!err); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!/^\S+@\S+\.\S+$/.test(input.value.trim())) { say('Please enter a valid email address.', true); input.focus(); return; }
      var url = form.getAttribute('data-endpoint');
      if (!url) {
        say('Online newsletter sign-up is not open yet. For offers, call +91 99204 00267 or write to us via the Contact page.', true);
        return;
      }
      fetch(url, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.ok) { say('Thank you - you are subscribed.'); form.reset(); } else say((d && d.message) || 'Sorry, we could not subscribe you. Please try again.', true); })
        .catch(function () { say('Sorry, we could not subscribe you. Please try again.', true); });
    });
  });
})();
