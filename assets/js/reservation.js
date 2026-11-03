/* Unicorn Hospitality - Find My Reservation (find-my-reservation.html)
   Every detail shown here comes from MySQL through api/bookings/*.php.
   After a successful lookup the page keeps only the Booking ID and a signed, expiring access token in sessionStorage
   (cleared when the tab closes). Refreshing the page re-checks that token with the server. */
(function () {
  'use strict';
  var A = window.UchApi;
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var state = { booking: null, token: null, settings: null, busy: false, fp: {}, previewSeq: 0 };
  var money = function (n) { return A.money(n); };
  var setText = function (id, t) { $(id).textContent = t; };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
  var guestsText = function (a, c) { return plural(a, 'Adult', 'Adults') + (c ? ', ' + plural(c, 'Child', 'Children') : ''); };
  var GENERIC = "We couldn't find a reservation matching those details. Please check your Booking ID and email address or contact our reservations team.";

  function toast(msg) { var t = $('rsvToast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('is-on'); }, 4200); }
  function showResult(which) {
    $('lookupError').classList.toggle('is-visible', which === 'error');
    $('lookupResult').classList.toggle('is-visible', which === 'result');
    $('lookupCard').style.display = which === 'result' ? 'none' : '';
  }
  function setLoading(on) {
    var b = $('btnLookup'); b.classList.toggle('is-loading', on); b.disabled = on; $('lookupId').disabled = on; $('lookupEmail').disabled = on;
    b.querySelector('span').textContent = on ? 'Searching...' : 'Find My Reservation';
  }
  function fieldErr(id, msg) { var el = $(id), g = el.closest('.bk-form-group'); g.classList.toggle('has-error', !!msg); if (msg) g.querySelector('.bk-error-msg').textContent = msg; }

  /* ---------- lookup ---------- */
  function lookupWith(payload, quiet) {
    return A.post('api/bookings/lookup.php', payload).then(function (res) {
      if (res.body.success) { showBooking(res.body.data); return true; }
      A.forget();
      if (quiet) { showResult(null); return false; }
      var title = res.status === 429 ? 'Please wait a moment' : (res.status === 422 ? 'Please check your details' : 'Reservation not found');
      lookupFailed(title, res.status === 404 ? GENERIC : (res.body.message || GENERIC));
      return false;
    }, function () {
      if (!quiet) lookupFailed('Connection problem', 'We could not reach the reservation system. Please check your connection and try again, or contact our reservations team.');
      return false;
    });
  }
  function lookupFailed(title, text) { setText('lookupErrorTitle', title); setText('lookupErrorText', text); showResult('error'); $('lookupCard').style.display = ''; }

  $('lookupForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = $('lookupId').value.trim().toUpperCase(), email = $('lookupEmail').value.trim();
    fieldErr('lookupId', id ? '' : 'Please enter your Booking ID.');
    fieldErr('lookupEmail', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : 'Please enter a valid email address.');
    if (!id || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { (!id ? $('lookupId') : $('lookupEmail')).focus(); return; }
    showResult(null); setLoading(true);
    lookupWith({ bookingId: id, email: email }).then(function () { setLoading(false); });
  });
  $('lookupId').addEventListener('input', function () { fieldErr('lookupId', ''); });
  $('lookupEmail').addEventListener('input', function () { fieldErr('lookupEmail', ''); });

  /* ---------- show a booking ---------- */
  function showBooking(b) {
    state.booking = b; state.token = b.accessToken;
    A.remember(b.bookingId, b.accessToken);
    var st = $('resStatus'); st.classList.toggle('is-cancelled', b.status === 'cancelled'); st.classList.toggle('is-pending', b.status === 'pending');
    setText('resStatusText', b.status.charAt(0).toUpperCase() + b.status.slice(1));
    setText('resBookingId', b.bookingId);
    $('resThumb').src = b.room.image || 'assets/images/unicon/rooms/deluxe.jpg'; $('resThumb').alt = b.room.name;
    setText('resRoomName', b.room.name);
    setText('resRoomMeta', [b.room.bed, b.room.size ? b.room.size + ' m²' : ''].filter(Boolean).join(' · '));
    setText('resGuestName', 'Guest: ' + b.guest.firstName + ' ' + b.guest.lastName);
    setText('resCheckIn', A.date(b.stay.checkIn) + ' · from ' + b.stay.checkInTime);
    setText('resCheckOut', A.date(b.stay.checkOut) + ' · by ' + b.stay.checkOutTime);
    setText('resNights', String(b.stay.nights));
    setText('resGuests', guestsText(b.stay.adults, b.stay.children));
    setText('resTotal', money(b.pricing.total) + (b.pricing.taxAmount > 0 ? ' (incl. ' + money(b.pricing.taxAmount) + ' tax)' : '') + (b.pricing.discount > 0 ? ' · coupon ' + b.pricing.couponCode + ' saved ' + money(b.pricing.discount) : ''));
    setText('resPayment', paymentText(b));
    setText('resCreated', new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
    setText('resRequests', b.guest.specialRequests || 'None');
    setText('resPolicy', b.policy.cancellation + ' ' + b.policy.payment);
    var cancelled = b.status === 'cancelled';
    $('btnModify').disabled = !b.canModify; $('btnCancel').disabled = !b.canCancel;
    $('btnModify').title = b.canModify ? '' : b.modifyNote; $('btnCancel').title = b.canCancel ? '' : b.cancelNote;
    var note = cancelled ? 'This reservation was cancelled' + (b.cancelledAt ? ' on ' + new Date(b.cancelledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '') + '. The room has been released.' : (!b.canModify ? b.modifyNote : (!b.canCancel ? b.cancelNote : ''));
    var nb = $('resActionNote'); nb.textContent = note; nb.style.display = note ? '' : 'none';
    showResult('result');
    var u = new URL(location.href); u.searchParams.set('id', b.bookingId); history.replaceState(null, '', u.pathname + u.search);
    $('lookupResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* re-check the access token with the server (also gives a fresh token). Resolves true if still valid. */
  function refreshBooking() {
    if (!state.booking) return Promise.resolve(false);
    return A.post('api/bookings/lookup.php', { bookingId: state.booking.bookingId, token: state.token }).then(function (res) {
      if (res.body.success) { state.booking = res.body.data; state.token = res.body.data.accessToken; A.remember(state.booking.bookingId, state.token); return true; }
      expired(); return false;
    }, function () { toast('We could not reach the reservation system. Please try again.'); return false; });
  }
  function expired() {
    A.forget(); state.booking = null; state.token = null;
    showResult(null); lookupFailed('Please look up your reservation again', 'For your security, your reservation view timed out. Enter your Booking ID and email address to open it again.');
  }

  /* ---------- download + calendar (token-protected links) ---------- */
  $('btnDownload').addEventListener('click', function () {
    refreshBooking().then(function (ok) { if (ok) window.open('api/bookings/download.php?id=' + encodeURIComponent(state.booking.bookingId) + '&token=' + encodeURIComponent(state.token), '_blank', 'noopener'); });
  });
  $('btnCalendar').addEventListener('click', function () {
    refreshBooking().then(function (ok) {
      if (!ok) return;
      var a = document.createElement('a'); a.href = 'api/bookings/calendar.php?id=' + encodeURIComponent(state.booking.bookingId) + '&token=' + encodeURIComponent(state.token);
      a.download = state.booking.bookingId + '.ics'; document.body.appendChild(a); a.click(); a.remove();
      toast('Calendar file downloaded');
    });
  });
  $('btnAnother').addEventListener('click', function () {
    A.forget(); state.booking = null; state.token = null; $('lookupForm').reset(); showResult(null);
    var u = new URL(location.href); u.searchParams.delete('id'); history.replaceState(null, '', u.pathname + u.search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------- modal helpers ---------- */
  var lastFocus = null;
  function openModal(id) { lastFocus = document.activeElement; var m = $(id); m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; var f = m.querySelector('input:not([readonly]),select,button.bk-btn-secondary,button'); if (f) f.focus({ preventScroll: true }); }
  function closeModal(id) { var m = $(id); m.classList.remove('is-open'); m.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  $$('.rsv-modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) closeModal(m.id); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $$('.rsv-modal.is-open').forEach(function (m) { closeModal(m.id); }); });

  /* ---------- settings (country codes, limits) come from the same API as the booking page ---------- */
  function loadSettings() {
    if (state.settings) return Promise.resolve(state.settings);
    var t = A.iso(new Date());
    return A.get('api/rooms.php?check_in=' + t + '&check_out=' + A.addDays(t, 1) + '&adults=1&children=0').then(function (res) {
      state.settings = res.body.success ? res.body.data.settings : { maxAdults: 6, maxChildren: 4, countryCodes: { '+91': 'India (+91)' }, contact: { phone: '+91 99204 00267' } };
      return state.settings;
    }, function () { state.settings = { maxAdults: 6, maxChildren: 4, countryCodes: { '+91': 'India (+91)' }, contact: { phone: '+91 99204 00267' } }; return state.settings; });
  }

  /* ---------- modify ---------- */
  function fillCount(id, min, max, cur, one, many) {
    var h = ''; for (var i = min; i <= max; i++) h += '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + i + ' ' + (i === 1 ? one : many) + '</option>';
    $(id).innerHTML = h;
  }
  function mdPayload(preview) {
    return { bookingId: state.booking.bookingId, token: state.token, checkIn: $('mdIn').value, checkOut: $('mdOut').value, adults: +$('mdAdults').value, children: +$('mdChildren').value,
      phoneCountry: $('mdCountry').value, phone: $('mdPhone').value, specialRequests: $('mdRequests').value, preview: !!preview };
  }
  function mdFieldErrors(errs) {
    var map = { checkIn: 'mdIn', checkOut: 'mdOut', adults: 'mdAdults', children: 'mdChildren', phone: 'mdPhone', phoneCountry: 'mdPhone' };
    $$('#modifyForm .bk-form-group').forEach(function (g) { g.classList.remove('has-error'); });
    Object.keys(errs || {}).forEach(function (k) { if (map[k]) { var g = $(map[k]).closest('.bk-form-group'); g.classList.add('has-error'); var m = g.querySelector('.bk-error-msg'); if (m) m.textContent = errs[k]; } });
  }
  /* what the guest sees in the "Payment" box */
  function paymentText(b) {
    var p = b.payment || {};
    if (p.status === 'refunded') return 'Refunded ' + money(p.refundedAmount) + ' (5-7 working days to reach your account)';
    if (p.status === 'partial_refund') return 'Paid ' + money(p.paidAmount) + ', refunded ' + money(p.refundedAmount);
    if (p.status === 'paid') return p.method === 'free' ? 'Covered by coupon' : p.method === 'manual' ? 'Paid ' + money(p.paidAmount) : 'Paid online ' + money(p.paidAmount) + (p.paymentId ? ' · ref ' + p.paymentId : '');
    return 'Pay at the hotel';
  }
  var previewSoon = (function () { var t; return function () { clearTimeout(t); t = setTimeout(preview, 350); }; })();
  function preview() {
    var seq = ++state.previewSeq, q = $('mdQuote');
    q.classList.remove('is-bad'); q.textContent = 'Checking availability...'; $('mdError').style.display = 'none';
    A.post('api/bookings/modify.php', mdPayload(true)).then(function (res) {
      if (seq !== state.previewSeq) return;
      if (res.body.success) {
        var d = res.body.data, p = d.pricing;
        mdFieldErrors({});
        q.innerHTML = 'New stay: <b>' + p.nights + ' night' + (p.nights === 1 ? '' : 's') + ' × ' + A.esc(money(p.pricePerNight)) + '</b>' + (p.taxAmount > 0 ? ' + ' + A.esc(money(p.taxAmount)) + ' tax' : '') + '. New total: <b>' + A.esc(money(p.total)) + '</b> (was ' + A.esc(money(d.previousTotal)) + ').';
        $('mdSave').disabled = false;
      } else {
        q.classList.add('is-bad'); q.textContent = res.body.message; mdFieldErrors(res.body.errors); $('mdSave').disabled = true;
        if (res.status === 403) { $('mdSave').disabled = true; }
      }
    }, function () { if (seq === state.previewSeq) { q.classList.add('is-bad'); q.textContent = 'We could not reach the reservation system.'; $('mdSave').disabled = true; } });
  }
  $('btnModify').addEventListener('click', function () {
    var b = state.booking; if (!b || !b.canModify) return;
    loadSettings().then(function (s) {
      setText('modifySub', b.room.name + ' · ' + b.bookingId + ' · keeps the rate you booked at (' + money(b.pricing.pricePerNight) + ' / night)');
      fillCount('mdAdults', 1, s.maxAdults, b.stay.adults, 'Adult', 'Adults'); fillCount('mdChildren', 0, s.maxChildren, b.stay.children, 'Child', 'Children');
      $('mdCountry').innerHTML = Object.keys(s.countryCodes).map(function (k) { return '<option value="' + A.esc(k) + '"' + (k === b.guest.phoneCountry ? ' selected' : '') + '>' + A.esc(s.countryCodes[k]) + '</option>'; }).join('');
      $('mdPhone').value = b.guest.phone; $('mdRequests').value = b.guest.specialRequests;
      var cfg = { dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y', minDate: 'today', disableMobile: true };
      if (state.fp.i) { state.fp.i.destroy(); state.fp.o.destroy(); }
      state.fp.i = flatpickr('#mdIn', Object.assign({}, cfg, { defaultDate: b.stay.checkIn, onChange: function (d, v) {
        var nx = A.addDays(v, 1); state.fp.o.set('minDate', nx); if ($('mdOut').value <= v) state.fp.o.setDate(nx, false); previewSoon(); } }));
      state.fp.o = flatpickr('#mdOut', Object.assign({}, cfg, { defaultDate: b.stay.checkOut, minDate: A.addDays(b.stay.checkIn < A.iso(new Date()) ? A.iso(new Date()) : b.stay.checkIn, 1), onChange: previewSoon }));
      mdFieldErrors({}); $('mdError').style.display = 'none'; $('mdQuote').textContent = ''; $('mdSave').disabled = false;
      openModal('modifyModal');
    });
  });
  ['mdAdults', 'mdChildren'].forEach(function (id) { $(id).addEventListener('change', previewSoon); });
  $('mdPhone').addEventListener('input', previewSoon); $('mdCountry').addEventListener('change', previewSoon);
  $('modifyForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('mdSave'); btn.classList.add('is-loading'); btn.disabled = true; $('mdError').style.display = 'none';
    A.post('api/bookings/modify.php', mdPayload(false)).then(function (res) {
      btn.classList.remove('is-loading');
      if (res.body.success) {
        closeModal('modifyModal'); showBooking(res.body.data);
        toast('Your reservation has been updated' + (res.body.data.emailStatus === 'sent' ? ' and a new confirmation was emailed.' : '.'));
        return;
      }
      btn.disabled = false; mdFieldErrors(res.body.errors);
      var e1 = $('mdError'); e1.textContent = res.body.message; e1.style.display = '';
      if (res.status === 404) { closeModal('modifyModal'); expired(); }
    }, function () { btn.classList.remove('is-loading'); btn.disabled = false; var e1 = $('mdError'); e1.textContent = 'We could not reach the reservation system. Your reservation was not changed.'; e1.style.display = ''; });
  });

  /* ---------- cancel ---------- */
  $('btnCancel').addEventListener('click', function () {
    var b = state.booking; if (!b || !b.canCancel) return;
    setText('cnId', b.bookingId);
    $('cnSummary').innerHTML = '<div><span>Room</span><strong>' + A.esc(b.room.name) + '</strong></div><div><span>Dates</span><strong>' + A.esc(A.date(b.stay.checkIn) + ' – ' + A.date(b.stay.checkOut)) + '</strong></div><div><span>Total</span><strong>' + A.esc(money(b.pricing.total)) + '</strong></div>';
    var refundable = b.payment && b.payment.status === 'paid' && b.payment.method === 'razorpay';
    setText('cnPolicy', b.policy.cancellation + ' Once cancelled, the room is released and this cannot be undone.' + (refundable ? ' Your payment of ' + money(b.payment.paidAmount) + ' will be refunded to your original payment method within 5-7 working days.' : ''));
    $('cnError').style.display = 'none'; $('cnConfirm').disabled = false;
    openModal('cancelModal');
  });
  $('cnConfirm').addEventListener('click', function () {
    var btn = this; btn.disabled = true; btn.classList.add('is-loading'); $('cnError').style.display = 'none';
    A.post('api/bookings/cancel.php', { bookingId: state.booking.bookingId, token: state.token }).then(function (res) {
      btn.classList.remove('is-loading');
      if (res.body.success) { closeModal('cancelModal'); showBooking(res.body.data); toast('Your reservation has been cancelled.'); return; }
      btn.disabled = false; var e1 = $('cnError'); e1.textContent = res.body.message; e1.style.display = '';
      if (res.status === 404) { closeModal('cancelModal'); expired(); }
    }, function () { btn.classList.remove('is-loading'); btn.disabled = false; var e1 = $('cnError'); e1.textContent = 'We could not reach the reservation system. Your reservation was not cancelled.'; e1.style.display = ''; });
  });

  /* ---------- page start: prefill the ID, and re-open a lookup made earlier in this tab (the server re-checks the token) ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var qid = (new URLSearchParams(location.search).get('id') || '').trim().toUpperCase();
    var saved = A.recall();
    if (qid) $('lookupId').value = qid;
    if (saved && saved.token && (!qid || qid === saved.id)) {
      setLoading(true);
      lookupWith({ bookingId: saved.id, token: saved.token }, true).then(function (ok) { setLoading(false); if (!ok && !qid) $('lookupId').focus(); });
    } else if (qid) $('lookupEmail').focus();
  });
})();
