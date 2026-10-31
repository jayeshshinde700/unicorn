/* Unicorn Hospitality - shared helpers for book-a-room.html and find-my-reservation.html
   All data comes from the PHP/MySQL API in /api. Nothing about a booking is kept in localStorage. */
(function () {
  'use strict';

  /* Send a request to the API. Always resolves with {status, body}; rejects only when the server cannot be reached. */
  function call(url, method, payload) {
    var opts = { method: method, credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' } };
    if (method === 'POST') { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(payload || {}); }
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!body || typeof body !== 'object') body = { success: false, message: 'The reservation system returned an unexpected answer. Please try again.', errors: {} };
        return { status: res.status, body: body };
      });
    }, function () {
      var e = new Error('network'); e.network = true; throw e;
    });
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  window.UchApi = {
    get: function (url) { return call(url, 'GET'); },
    post: function (url, payload) { return call(url, 'POST', payload); },

    /* HTML-escape anything that came from a guest or the database before it is put into innerHTML */
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },

    money: function (n, symbol) { return (symbol || '₹') + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); },

    /* 'YYYY-MM-DD' -> '05 Dec 2026' (no timezone shifts) */
    date: function (iso) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
      return m ? m[3] + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : (iso || '');
    },

    /* Date -> 'YYYY-MM-DD' using the visitor's local calendar day */
    iso: function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },

    addDays: function (iso, n) { var p = iso.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n); return window.UchApi.iso(d); },

    nights: function (a, b) {
      var x = a.split('-'), y = b.split('-');
      return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / 86400000);
    },

    /* random hex id used to make a booking request safe to repeat (double click, refresh, retry) */
    token: function () {
      var a = new Uint8Array(16);
      (window.crypto || window.msCrypto).getRandomValues(a);
      return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    },

    /* session-only memory of a successful lookup: booking id + a signed, expiring token (never the email) */
    remember: function (id, token) { try { sessionStorage.setItem('uch_res', JSON.stringify({ id: id, token: token })); } catch (e) {} },
    recall: function () { try { return JSON.parse(sessionStorage.getItem('uch_res') || 'null'); } catch (e) { return null; } },
    forget: function () { try { sessionStorage.removeItem('uch_res'); } catch (e) {} }
  };
})();
