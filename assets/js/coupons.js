/* Unicorn Hospitality - coupons.html
   The list comes from api/coupons/list.php, which reads the coupons you create in the admin dashboard (Coupons).
   Nothing is hard-coded here: add, change or switch off a coupon in the admin and this page follows. */
(function () {
  'use strict';
  var list = document.getElementById('cpList');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmt(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? +m[3] + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : ''; }

  function card(c) {
    var soon = c.state === 'scheduled';
    var when = soon ? 'Starts ' + fmt(c.startsOn) : (c.validTo ? 'Book before ' + fmt(c.validTo) : 'Available now');
    return '<article class="cp-card' + (soon ? ' is-soon' : '') + '">' +
      '<div class="cp-card__main"><span class="cp-card__tag">' + esc(when) + '</span>' +
      '<h2>' + esc(c.title) + '</h2><p class="cp-card__off">' + esc(c.headline) + '</p>' +
      (c.description ? '<p class="cp-card__desc">' + esc(c.description) + '</p>' : '') +
      (c.terms.length ? '<ul class="cp-card__terms">' + c.terms.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
      '<div class="cp-card__side"><span class="cp-card__label">Coupon code</span>' +
      '<code class="cp-card__code">' + (soon ? '&bull;&bull;&bull;&bull;&bull;&bull;' : esc(c.code)) + '</code>' +
      (soon ? '' : '<button type="button" class="cp-btn" data-copy="' + esc(c.code) + '">Copy code</button>' +
        '<a class="cp-btn cp-btn--gold" href="book-a-room.html?coupon=' + encodeURIComponent(c.code) + '">Book with this code</a>') + '</div></article>';
  }

  fetch('api/coupons/list.php', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
    if (!j || !j.success) throw new Error('bad');
    var cs = j.data.coupons || [];
    list.innerHTML = cs.length ? cs.map(card).join('') :
      '<div class="cp-empty"><h2>No coupons right now</h2><p>New offers appear here as soon as they are announced. Have a look at our <a href="offers.html">special packages</a> in the meantime.</p></div>';
  }).catch(function () {
    list.innerHTML = '<div class="cp-empty"><h2>We could not load the coupons</h2><p>Please refresh the page or try again in a moment.</p></div>';
  });

  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]'); if (!b) return;
    var code = b.getAttribute('data-copy'), done = function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy code'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, function () { window.prompt('Copy this code:', code); });
    else window.prompt('Copy this code:', code);
  });
})();
