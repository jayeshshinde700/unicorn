/* Unicorn Hospitality - Book a Room (book-a-room.html)
   Rooms, availability and prices come from api/rooms.php (MySQL). The booking is saved by api/bookings/create.php.
   Nothing is stored in localStorage: this page keeps its state in memory only. */
(function () {
  'use strict';
  var A = window.UchApi;
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var state = {
    step: 1, rooms: [], settings: null, selectedId: null, category: 'all',
    checkIn: '', checkOut: '', adults: 2, children: 0,
    requestToken: null, coupon: null, couponTried: false, submitting: false, paying: false, seq: 0, loadError: false, fp: {}
  };

  /* ---------- small helpers ---------- */
  var money = function (n) { return A.money(n, state.settings ? state.settings.currencySymbol : undefined); };
  var nightsLabel = function (n) { return n + ' Night' + (n === 1 ? '' : 's'); };
  var guestsLabel = function (a, c) { return a + ' Adult' + (a === 1 ? '' : 's') + (c > 0 ? ', ' + c + ' Child' + (c === 1 ? '' : 'ren') : ''); };
  var nights = function () { return state.checkIn && state.checkOut ? Math.max(0, A.nights(state.checkIn, state.checkOut)) : 0; };
  var selected = function () { return state.rooms.filter(function (r) { return r.id === state.selectedId; })[0] || null; };
  var setText = function (id, t) { var e = $(id); if (e) e.textContent = t; };
  var show = function (el, on) { if (el) el.style.display = on ? '' : 'none'; };
  var debounce = function (fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; };

  /* the booking request token makes the "Confirm" click safe to repeat; it lives for this browser tab only */
  function requestToken() {
    if (!state.requestToken) {
      try { state.requestToken = sessionStorage.getItem('uch_req') || ''; } catch (e) {}
      if (!state.requestToken) { state.requestToken = A.token(); try { sessionStorage.setItem('uch_req', state.requestToken); } catch (e) {} }
    }
    return state.requestToken;
  }
  function resetRequestToken() { state.requestToken = null; try { sessionStorage.removeItem('uch_req'); } catch (e) {} }

  /* ---------- selects for adults / children ---------- */
  function fillCountSelects() {
    var s = state.settings || { maxAdults: 6, maxChildren: 4 };
    [['filterAdults', 'formAdults'], ['filterChildren', 'formChildren']].forEach(function (pair, idx) {
      var isAdult = idx === 0, max = isAdult ? s.maxAdults : s.maxChildren, min = isAdult ? 1 : 0, cur = isAdult ? state.adults : state.children;
      pair.forEach(function (id) {
        var sel = $(id), html = '';
        for (var i = min; i <= max; i++) html += '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + i + (isAdult ? ' Adult' : ' Child') + (i === 1 ? '' : (isAdult ? 's' : 'ren')) + '</option>';
        sel.innerHTML = html;
      });
    });
    var cc = $('guestCountry');
    if (state.settings && cc && cc.options.length <= 1) {
      var keep = cc.value;
      cc.innerHTML = Object.keys(state.settings.countryCodes).map(function (k) { return '<option value="' + A.esc(k) + '">' + A.esc(state.settings.countryCodes[k]) + '</option>'; }).join('');
      cc.value = keep || '+91';
    }
  }

  /* ---------- date pickers (Flatpickr, already loaded on this page) ---------- */
  function initDates() {
    var today = new Date(), tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    state.checkIn = A.iso(today); state.checkOut = A.iso(tomorrow);
    var qs = new URLSearchParams(location.search), qi = qs.get('check_in'), qo = qs.get('check_out'), iso = /^\d{4}-\d{2}-\d{2}$/;
    if (qi && qo && iso.test(qi) && iso.test(qo) && qi >= state.checkIn && qo > qi) { state.checkIn = qi; state.checkOut = qo; }
    var qa = parseInt(qs.get('adults'), 10), qc = parseInt(qs.get('children'), 10);
    if (qa >= 1 && qa <= 12) state.adults = qa;
    if (qc >= 0 && qc <= 10) state.children = qc;
    ['filterAdults', 'formAdults'].forEach(function (id) { if ($(id)) $(id).value = state.adults; });
    ['filterChildren', 'formChildren'].forEach(function (id) { if ($(id)) $(id).value = state.children; });
    var cfg = { minDate: 'today', dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y', disableMobile: true };
    function make(id, def, minDate, onChange) { return flatpickr('#' + id, Object.assign({}, cfg, { defaultDate: def, minDate: minDate }, { onChange: function (d, str) { onChange(str); } })); }
    state.fp.in1 = make('filterCheckIn', state.checkIn, 'today', function (v) { setDates('in', v); });
    state.fp.out1 = make('filterCheckOut', state.checkOut, state.checkOut, function (v) { setDates('out', v); });
    state.fp.in2 = make('formCheckIn', state.checkIn, 'today', function (v) { setDates('in', v); });
    state.fp.out2 = make('formCheckOut', state.checkOut, state.checkOut, function (v) { setDates('out', v); });
  }

  var refreshSoon = debounce(function () { loadRooms(); }, 350);

  function setDates(which, v) {
    if (!v) return;
    if (which === 'in') {
      state.checkIn = v;
      var next = A.addDays(v, 1);
      state.fp.out1.set('minDate', next); state.fp.out2.set('minDate', next);
      if (state.checkOut <= v) state.checkOut = next;
    } else state.checkOut = v;
    ['in1', 'in2'].forEach(function (k) { state.fp[k].setDate(state.checkIn, false); });
    ['out1', 'out2'].forEach(function (k) { state.fp[k].setDate(state.checkOut, false); });
    renderSummaries();
    refreshSoon();          /* availability is recalculated by the server whenever the dates change */
  }

  function setGuests(a, c) {
    state.adults = a; state.children = c;
    ['filterAdults', 'formAdults'].forEach(function (id) { $(id).value = a; });
    ['filterChildren', 'formChildren'].forEach(function (id) { $(id).value = c; });
    renderRooms(); renderSummaries();
    refreshSoon();
  }

  /* ---------- load rooms + availability from MySQL ---------- */
  function loadRooms() {
    var seq = ++state.seq;
    show($('roomsLoader'), true); show($('roomsGrid'), false); show($('roomsError'), false);
    var q = new URLSearchParams({ check_in: state.checkIn, check_out: state.checkOut, adults: state.adults, children: state.children, type: 'all' });
    return A.get('api/rooms.php?' + q.toString()).then(function (res) {
      if (seq !== state.seq) return;
      show($('roomsLoader'), false);
      if (!res.body.success) {
        var msg = res.status === 422 ? firstError(res.body) || res.body.message : 'We cannot load room availability right now. Please try again in a moment or call us on ' + phone() + '.';
        return loadFailed(msg, res.status !== 422);
      }
      state.loadError = false;
      var d = res.body.data;
      var firstLoad = !state.settings;
      state.settings = d.settings; state.rooms = d.rooms;
      if (firstLoad) { fillCountSelects(); applyPolicyText(); }
      /* keep the chosen room only while the server says it can still be booked */
      var sel = selected();
      if (state.selectedId && (!sel || !sel.availability || !sel.availability.bookable)) {
        var wasLater = state.step > 1;
        var name = sel ? sel.name : 'The selected room';
        state.selectedId = null;
        if (wasLater) { goToStep(1, true); alertRoom(name + ' is not available for these dates or guests. Please choose another room.'); }
      }
      renderRooms(); renderSummaries(); updateActionBar();
      var r = new URLSearchParams(location.search).get('room');
      if (r && !state.preselected) { state.preselected = true; var m = state.rooms.filter(function (x) { return x.id.toLowerCase() === r.toLowerCase(); })[0]; if (m) selectRoom(m.id); }
    }, function () {
      if (seq !== state.seq) return;
      show($('roomsLoader'), false);
      loadFailed('We cannot reach the reservation system right now. Please check your connection and try again, or call us on ' + phone() + '.', true);
    });
  }
  function phone() { return state.settings && state.settings.contact ? state.settings.contact.phone : '+91 99204 00267'; }
  function firstError(body) { var e = body.errors || {}, k = Object.keys(e)[0]; return k ? e[k] : ''; }
  function loadFailed(msg, systemDown) {
    state.loadError = true; state.rooms = []; state.selectedId = null;
    setText('roomsErrorText', msg); show($('roomsError'), true); show($('roomsGrid'), false);
    updateActionBar();
    if (systemDown) $('btnProceedToDetails').disabled = true;
  }
  function applyPolicyText() {
    var s = state.settings; if (!s) return;
    setText('policyText', s.cancellationText + ' Check-in is from ' + s.checkInTime + ' and check-out is by ' + s.checkOutTime + '. ' + s.paymentNote);
  }

  /* ---------- room cards ---------- */
  function renderRooms() {
    var grid = $('roomsGrid');
    if (state.loadError) return;
    show(grid, true);
    var list = state.rooms.filter(function (r) { return state.category === 'all' || r.category === state.category; });
    var nts = nights();
    setText('searchSummary', nightsLabel(nts) + ' · ' + guestsLabel(state.adults, state.children) + ' · ' + A.date(state.checkIn) + ' to ' + A.date(state.checkOut));
    if (!list.length) { grid.innerHTML = '<div class="col-12 text-center py-5"><h4>No rooms match this category.</h4><p class="text-muted">Please switch category or adjust your filters.</p></div>'; return; }
    grid.innerHTML = '';
    list.forEach(function (room) {
      var av = room.availability || { bookable: false, reason: 'unavailable', available: 0, quote: { total: 0, subtotal: 0 } };
      var isSel = room.id === state.selectedId;
      var card = document.createElement('article');
      card.className = 'bk-card' + (isSel ? ' is-selected' : '') + (av.bookable ? '' : ' is-unavailable');
      card.dataset.roomId = room.id;
      var badge = room.badge && room.badge.text ? '<span class="bk-card__badge ' + (room.badge.style === 'gold' ? 'bk-card__badge--gold' : '') + '">' + A.esc(room.badge.text) + '</span>' : '';
      var amen = (room.amenities || []).slice(0, 4).map(function (a) { return '<span class="bk-amenity-chip"><svg class="ico"><use href="#i-' + A.esc(a.icon || 'star') + '"/></svg><span>' + A.esc(a.label) + '</span></span>'; }).join('');
      var availText, availCls = '';
      if (av.bookable) { availText = av.available <= 3 ? 'Only ' + av.available + ' left' : av.available + ' available'; availCls = av.available <= 3 ? ' is-low' : ''; }
      else if (av.reason === 'capacity') availText = 'Sleeps up to ' + room.guests + ' guests';
      else if (av.reason === 'soldout') availText = 'Sold out for these dates';
      else availText = 'Unavailable';
      var q = av.quote || {};
      var calc = nts + ' night' + (nts === 1 ? '' : 's') + ' × ' + money(room.price) + ' = ' + money(q.subtotal);
      card.innerHTML =
        '<span class="bk-card__selected-pill"><svg class="ico" width="14" height="14"><use href="#i-check"/></svg> Selected</span>' +
        '<div class="bk-card__img-wrap"><img src="' + A.esc(room.image || 'assets/images/unicon/rooms/uni-deluxe.png') + '" alt="' + A.esc(room.imageAlt || room.name) + '" class="bk-card__img" loading="lazy">' + badge + '</div>' +
        '<div class="bk-card__body">' +
          '<div class="bk-card__header"><h3 class="bk-card__name">' + A.esc(room.name) + '</h3><p class="bk-card__tagline">' + A.esc(room.tagline || room.short || '') + '</p></div>' +
          '<div class="bk-card__price-wrap"><span class="bk-card__price">' + money(room.price) + '</span><span class="bk-card__per-night">/ night' + (state.settings && state.settings.taxPercent > 0 ? ' + taxes' : '') + '</span></div>' +
          '<div class="bk-card__calc">' + A.esc(calc) + '</div>' +
          '<span class="bk-card__avail' + availCls + (av.bookable ? '' : ' is-out') + '">' + A.esc(availText) + '</span>' +
          '<div class="bk-card__specs"><span class="bk-card__spec"><svg class="ico"><use href="#i-area"/></svg> ' + (room.size || 0) + ' m²</span>' +
            '<span class="bk-card__spec"><svg class="ico"><use href="#i-user"/></svg> Up to ' + (room.guests || 2) + ' Guests</span>' +
            '<span class="bk-card__spec"><svg class="ico"><use href="#i-bed"/></svg> ' + A.esc(room.bed || 'King bed') + '</span></div>' +
          '<div class="bk-card__amenities">' + amen + '</div>' +
          '<div class="bk-card__actions"><button type="button" class="bk-card__select" data-select="' + A.esc(room.id) + '"' + (av.bookable ? '' : ' disabled') + '>' + (isSel ? '✓ Selected' : (av.bookable ? 'Select & Continue' : 'Not available')) + '</button>' +
          '<button type="button" class="bk-card__toggle" data-toggle="' + A.esc(room.id) + '">View Details</button></div>' +
        '</div>' +
        '<div class="bk-card__details"><h6>About This Stay</h6><p>' + A.esc(room.description || room.short || 'Thoughtfully designed space with premium bedding and serene interiors.') + '</p>' +
          (room.notes ? '<h6>Policies &amp; Notes</h6><p>' + A.esc(room.notes) + '</p>' : '') + '</div>';
      grid.appendChild(card);
    });
  }

  function selectRoom(id) {
    var r = state.rooms.filter(function (x) { return x.id === id; })[0];
    if (!r || !r.availability || !r.availability.bookable) return;
    state.selectedId = id;
    show($('roomSelectionAlert'), false);
    renderRooms(); renderSummaries(); updateActionBar();
    goToStep(2);
  }

  function updateActionBar() {
    var r = selected(), btn = $('btnProceedToDetails');
    if (!r) {
      setText('actionRoomTitle', 'No room selected'); setText('actionRoomSub', 'Choose your preferred room or suite from the list above.');
    } else {
      var q = r.availability.quote;
      setText('actionRoomTitle', r.name);
      setText('actionRoomSub', q.nights + ' night' + (q.nights === 1 ? '' : 's') + ' × ' + money(q.pricePerNight) + ' = ' + money(q.subtotal) + (q.taxAmount > 0 ? ' + ' + money(q.taxAmount) + ' taxes' : '') + ' · Total ' + money(q.total));
    }
    btn.disabled = state.loadError;
  }

  /* ---------- coupon: the server calculates the discount; here we only show it and send the code with the booking ---------- */
  function couponKey() { return [state.selectedId, state.checkIn, state.checkOut].join('|'); }
  function couponMsg(text, bad) { var m = $('couponMsg'); if (!m) return; m.textContent = text || ''; m.className = 'bk-coupon__msg' + (text ? (bad ? ' is-bad' : ' is-ok') : ''); }
  function clearCoupon(silent) {
    if (!state.coupon) return;
    state.coupon = null; resetRequestToken();
    $('couponCode').value = ''; show($('btnRemoveCoupon'), false); show($('btnApplyCoupon'), true); $('couponCode').disabled = false;
    couponMsg(silent ? '' : 'Coupon removed.', false);
  }
  function applyCoupon() {
    var r = selected(), code = $('couponCode').value.trim();
    if (!r) return;
    if (!code) return couponMsg('Please enter a coupon code.', true);
    var btn = $('btnApplyCoupon'); btn.disabled = true; couponMsg('Checking...', false);
    A.post('api/coupons/apply.php', { roomId: r.id, checkIn: state.checkIn, checkOut: state.checkOut, adults: state.adults, children: state.children, couponCode: code, email: readGuest().email })
      .then(function (res) {
        btn.disabled = false;
        if (!res.body.success) { couponMsg(res.body.message || 'This coupon cannot be used.', true); return; }
        var d = res.body.data;
        state.coupon = { code: d.code, pricing: d.pricing, key: couponKey() };
        resetRequestToken();                     /* a different price must never reuse an earlier payment hold */
        $('couponCode').value = d.code; $('couponCode').disabled = true; show($('btnRemoveCoupon'), true); show($('btnApplyCoupon'), false);
        couponMsg(d.code + ' applied: ' + d.headline + '. You save ' + money(d.pricing.discount) + '.', false);
        renderSummaries();
      }, function () { btn.disabled = false; couponMsg('Could not reach the server. Please try again.', true); });
  }

  /* price shown to the guest: the room quote, or the quote with the coupon applied */
  function activeQuote(r) {
    if (state.coupon && state.coupon.key !== couponKey()) { clearCoupon(true); couponMsg('Your coupon was removed because your stay changed. Please apply it again.', true); }
    return state.coupon ? state.coupon.pricing : r.availability.quote;
  }

  /* ---------- summaries (steps 2 and 3, desktop sidebar + compact mobile bar) ---------- */
  function renderSummaries() {
    var r = selected(); if (!r || !r.availability) return;
    var q = activeQuote(r), s = state.settings || {}, n = q.nights;
    var hasDisc = q.discount > 0;
    ['summary', 'summaryFinal'].forEach(function (p) {
      show($(p + 'DiscountRow'), hasDisc);
      if (hasDisc) { setText(p + 'DiscountLabel', 'Coupon ' + state.coupon.code + ':'); setText(p + 'DiscountVal', '- ' + money(q.discount)); }
    });
    var img = r.image || 'assets/images/unicon/rooms/uni-deluxe.png';
    var taxLabel = q.taxAmount > 0 ? (s.taxLabel || 'Taxes') + ' (' + q.taxPercent + '%):' : 'Taxes & Fees:';
    var taxVal = q.taxAmount > 0 ? money(q.taxAmount) : (s.taxNote || 'Included');
    $('summaryThumb').src = img; $('summaryFinalThumb').src = img;
    setText('summaryRoomName', r.name); setText('summaryFinalRoomName', r.name);
    setText('summaryRoomRate', money(q.pricePerNight) + ' / night'); setText('summaryFinalRoomRate', money(q.pricePerNight) + ' / night');
    setText('summaryCheckInText', A.date(state.checkIn)); setText('summaryCheckOutText', A.date(state.checkOut));
    setText('summaryNightsText', nightsLabel(n)); setText('summaryFinalNights', nightsLabel(n));
    setText('summaryGuestsText', guestsLabel(state.adults, state.children)); setText('summaryFinalGuests', guestsLabel(state.adults, state.children));
    setText('summaryRateCalculation', n + ' × ' + money(q.pricePerNight) + ' = ' + money(q.subtotal));
    setText('summaryFinalBreakdown', n + ' × ' + money(q.pricePerNight) + ' = ' + money(q.subtotal));
    setText('summaryTaxLabel', taxLabel); setText('summaryTaxVal', taxVal); setText('summaryFinalTaxLabel', taxLabel); setText('summaryFinalTaxVal', taxVal);
    setText('summaryTotalPrice', money(q.total)); setText('summaryFinalTotal', money(q.total));
    setText('summaryMini', money(q.total));
    /* review card */
    var g = readGuest();
    setText('revRoomName', r.name);
    setText('revDates', A.date(state.checkIn) + ' – ' + A.date(state.checkOut));
    setText('revNights', nightsLabel(n)); setText('revGuests', guestsLabel(state.adults, state.children));
    setText('revGuestName', (g.firstName + ' ' + g.lastName).trim() || '-'); setText('revGuestEmail', g.email || '-');
    setText('revGuestPhone', g.phone ? g.phoneCountry + ' ' + g.phone : '-'); setText('revSpecialRequests', g.specialRequests || 'No special requests');
  }

  function readGuest() {
    return {
      firstName: $('guestFirstName').value.trim(), lastName: $('guestLastName').value.trim(), email: $('guestEmail').value.trim(),
      phoneCountry: $('guestCountry').value, phone: $('guestPhone').value.replace(/[^\d]/g, ''), specialRequests: $('guestSpecialRequests').value.trim()
    };
  }

  /* ---------- validation (shown on blur and on submit, never while typing) ---------- */
  var RULES = {
    guestFirstName: function (v) { return v ? (/^[\p{L}\p{M}][\p{L}\p{M} .'\-]*$/u.test(v) ? '' : 'Please enter a valid first name.') : 'Please enter your first name.'; },
    guestLastName: function (v) { return v ? (/^[\p{L}\p{M}][\p{L}\p{M} .'\-]*$/u.test(v) ? '' : 'Please enter a valid last name.') : 'Please enter your last name.'; },
    guestEmail: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Please enter a valid email address.'; },
    guestPhone: function (v) {
      var d = v.replace(/\D/g, ''), cc = $('guestCountry').value;
      if (cc === '+91') return /^[6-9]\d{9}$/.test(d) ? '' : 'Please enter a valid 10-digit mobile number.';
      return d.length >= 6 && d.length <= 14 ? '' : 'Please enter a valid mobile number.';
    }
  };
  function setFieldError(el, msg) {
    var grp = el.closest('.bk-form-group'); if (!grp) return;
    grp.classList.toggle('has-error', !!msg); el.classList.toggle('is-invalid', !!msg);
    var m = grp.querySelector('.bk-error-msg'); if (m && msg) m.textContent = msg;
  }
  function checkField(id) { var el = $(id), msg = RULES[id](el.value.trim()); setFieldError(el, msg); return !msg; }
  function checkGuests() {
    var r = selected(), over = r && state.adults + state.children > r.guests;
    var el = $('formAdults'), grp = el.closest('.bk-form-group');
    grp.classList.toggle('has-error', !!over);
    if (over) setText('guestsError', r.name + ' sleeps up to ' + r.guests + ' guests. Please reduce the number of guests or choose another room.');
    return !over;
  }
  function validateGuestForm() {
    var ok = true;
    Object.keys(RULES).forEach(function (id) { if (!checkField(id)) ok = false; });
    if (!checkGuests()) ok = false;
    if (nights() < 1) ok = false;
    if (!ok) { var bad = document.querySelector('#guestDetailsForm .has-error input, #guestDetailsForm .has-error select'); if (bad) bad.focus(); }
    return ok;
  }

  /* ---------- wizard ---------- */
  function alertRoom(msg) { setText('roomSelectionAlert', ''); var a = $('roomSelectionAlert'); a.querySelector('span').textContent = msg; show(a, true); a.style.display = 'flex'; }
  function goToStep(n, silent) {
    if (n >= 2 && !selected()) { alertRoom('Please select a room to proceed with your booking.'); window.scrollTo({ top: $('roomSelectionAlert').getBoundingClientRect().top + window.pageYOffset - 140, behavior: 'smooth' }); return; }
    if (n === 3 && !validateGuestForm()) return;
    if (n < 3) resetRequestToken();      /* the guest is editing: a later payment must be for what they see then */
    state.step = n;
    $$('.bk-step').forEach(function (b) {
      var s = +b.dataset.step; b.classList.remove('is-active', 'is-completed', 'is-clickable');
      if (s === n) b.classList.add('is-active'); else if (s < n) b.classList.add('is-completed', 'is-clickable');
    });
    $$('.bk-step-panel').forEach(function (p) { p.classList.remove('is-active'); });
    $('stepPanel-' + n).classList.add('is-active');
    show($('confirmError'), false);
    renderSummaries();
    if (n === 3 && !state.coupon && !state.couponTried && $('couponCode').value.trim()) { state.couponTried = true; applyCoupon(); }   /* a code arriving from coupons.html (?coupon=CODE) */
    if (!silent) window.scrollTo({ top: document.querySelector('.bk-steps-wrap').getBoundingClientRect().top + window.pageYOffset - 30, behavior: 'smooth' });
  }

  /* ---------- confirm = 2 steps. 1) create.php holds the room and returns a Razorpay order  2) after payment, verify.php confirms it ----------
     The reservation only exists after step 2 succeeds (the server asks Razorpay itself whether the money arrived). */
  function confirmBooking() {
    if (state.submitting) return;
    var r = selected(); if (!r) return goToStep(1);
    var g = readGuest();
    state.submitting = true; setBusy(true, 'Preparing payment...'); show($('confirmError'), false);
    A.post('api/bookings/create.php', {
      roomId: r.id, checkIn: state.checkIn, checkOut: state.checkOut, adults: state.adults, children: state.children,
      firstName: g.firstName, lastName: g.lastName, email: g.email, phoneCountry: g.phoneCountry, phone: g.phone, specialRequests: g.specialRequests,
      couponCode: state.coupon ? state.coupon.code : '', requestToken: requestToken()
    }).then(function (res) {
      if (res.body.success) {
        var d = res.body.data;
        if (d.checkout) return openPayment(d);          /* normal case: pay now */
        state.submitting = false; setBusy(false);
        return bookingSaved(d);                          /* coupon covered everything, or already paid */
      }
      state.submitting = false; setBusy(false);
      var errs = res.body.errors || {};
      if (res.status === 422) {
        if (errs.couponCode) { clearCoupon(true); couponMsg(errs.couponCode, true); return confirmFailed(errs.couponCode); }
        goToStep(2, true);
        Object.keys(errs).forEach(function (k) {
          var map = { firstName: 'guestFirstName', lastName: 'guestLastName', email: 'guestEmail', phone: 'guestPhone', phoneCountry: 'guestPhone' };
          if (map[k]) setFieldError($(map[k]), errs[k]);
        });
        var other = ['checkIn', 'checkOut', 'adults', 'children', 'requestToken'].filter(function (k) { return errs[k]; })[0];
        if (other) { if (other === 'requestToken') resetRequestToken(); alertRoom(errs[other]); goToStep(1, true); }
        return;
      }
      confirmFailed(res.body.message || 'We could not start your booking.');
      if (res.status === 409) loadRooms();      /* refresh availability so the guest sees what is left */
    }, function () {
      state.submitting = false; setBusy(false);
      confirmFailed('We could not reach the reservation system, so nothing was charged. Please check your connection and try again.');
    });
  }

  function openPayment(d) {
    var c = d.checkout;
    if (!window.Razorpay) { state.submitting = false; setBusy(false); return confirmFailed('The secure payment window could not load. Please check your connection (or ad blocker) and try again.'); }
    state.paying = false;
    var rz = new Razorpay({
      key: c.keyId, order_id: c.orderId, amount: c.amount, currency: c.currency, name: c.name, description: c.description,
      prefill: c.prefill, theme: { color: c.themeColor }, notes: { booking_id: d.bookingId },
      handler: function (resp) { state.paying = true; verifyPayment(d.bookingId, resp); },
      modal: { escape: false, ondismiss: function () {
        if (state.paying) return;
        state.submitting = false; setBusy(false);
        var until = c.holdExpiresAt ? new Date(c.holdExpiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
        confirmFailed('The payment was not completed, so no reservation has been made.' + (until ? ' We are holding your room until ' + until + '.' : '') + ' Press "Pay & Confirm" to try again.');
      } }
    });
    rz.on('payment.failed', function (f) { confirmFailed(((f.error && f.error.description) || 'The payment failed.') + ' You can try again in the payment window.'); });
    setBusy(true, 'Waiting for payment...');
    rz.open();
  }

  function verifyPayment(bookingId, resp) {
    setBusy(true, 'Confirming your payment...');
    A.post('api/payments/verify.php', { bookingId: bookingId, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature })
      .then(function (res) {
        state.submitting = false; state.paying = false; setBusy(false);
        if (res.body.success) return bookingSaved(res.body.data);
        confirmFailed((res.body.message || 'We could not confirm your payment.') + ' Please do not pay again. Your Booking ID is ' + bookingId + '.');
      }, function () {
        state.submitting = false; state.paying = false; setBusy(false);
        confirmFailed('Your payment went through but we lost connection while confirming it. Please do not pay again: your booking will be confirmed automatically and e-mailed to you. Booking ID: ' + bookingId + '.');
      });
  }
  function confirmFailed(msg) { setText('confirmErrorText', msg); var e = $('confirmError'); e.style.display = 'flex'; e.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  function setBusy(on, label) {
    ['btnFinalConfirm', 'btnFinalConfirmSidebar'].forEach(function (id) {
      var b = $(id); b.disabled = on; b.classList.toggle('is-loading', on);
      var s = b.querySelector('span'); if (s) s.textContent = on ? (label || 'Please wait...') : 'Pay & Confirm';
    });
  }

  function bookingSaved(b) {
    resetRequestToken();
    A.remember(b.bookingId, b.accessToken);
    setText('modalBookingId', b.bookingId);
    setText('modalGuestName', b.guest.firstName + ' ' + b.guest.lastName);
    setText('modalRoomName', b.room.name);
    setText('modalDates', A.date(b.stay.checkIn) + ' – ' + A.date(b.stay.checkOut) + ' (' + b.stay.nights + 'N)');
    setText('modalTotal', money(b.pricing.total));
    setText('modalStatus', b.status);
    setText('modalPayment', b.payment && b.payment.method === 'free' ? 'Covered by coupon' : b.payment && b.payment.paidAmount ? 'Paid online ' + money(b.payment.paidAmount) : 'Paid');
    state.coupon = null; $('couponCode').value = ''; $('couponCode').disabled = false; show($('btnRemoveCoupon'), false); show($('btnApplyCoupon'), true); couponMsg('', false);
    setText('bkModalTitle', b.status === 'pending' ? 'Request Received' : 'Booking Confirmed!');
    var note = { sent: 'A confirmation email has been sent to ' + b.guest.email + '.', failed: 'Your booking is saved, but we could not send the confirmation email. Please keep your Booking ID.', disabled: 'Email confirmations are switched off. Please keep your Booking ID.' }[b.emailStatus] || 'Please keep your Booking ID.';
    setText('modalEmailNote', note);
    $('btnModalFindRes').href = 'find-my-reservation.html?id=' + encodeURIComponent(b.bookingId);
    $('btnPrintReceipt').dataset.url = 'api/bookings/download.php?id=' + encodeURIComponent(b.bookingId) + '&token=' + encodeURIComponent(b.accessToken);
    $('bkSuccessModal').classList.add('is-open');
    $('guestDetailsForm').reset(); fillCountSelects();
  }

  /* ---------- events ---------- */
  function bind() {
    $$('.bk-type-btn').forEach(function (b) { b.addEventListener('click', function () {
      $$('.bk-type-btn').forEach(function (x) { x.classList.remove('is-active'); }); b.classList.add('is-active');
      state.category = b.dataset.cat; renderRooms();
    }); });
    $('roomsGrid').addEventListener('click', function (e) {
      var sel = e.target.closest('[data-select]'), tg = e.target.closest('[data-toggle]');
      if (sel) { selectRoom(sel.dataset.select); return; }
      if (tg) { var d = tg.closest('.bk-card').querySelector('.bk-card__details'); d.classList.toggle('is-open'); tg.textContent = d.classList.contains('is-open') ? 'Hide Details' : 'View Details'; return; }
      var card = e.target.closest('.bk-card'); if (card && !e.target.closest('.bk-card__details')) selectRoom(card.dataset.roomId);
    });
    $('filterAdults').addEventListener('change', function () { setGuests(+this.value, state.children); });
    $('filterChildren').addEventListener('change', function () { setGuests(state.adults, +this.value); });
    $('formAdults').addEventListener('change', function () { setGuests(+this.value, state.children); checkGuests(); });
    $('formChildren').addEventListener('change', function () { setGuests(state.adults, +this.value); checkGuests(); });
    $('btnSearch').addEventListener('click', function () { loadRooms(); });
    $('bkStepsNav').addEventListener('click', function (e) { var b = e.target.closest('.bk-step'); if (b && b.classList.contains('is-clickable')) goToStep(+b.dataset.step); });
    $('btnProceedToDetails').addEventListener('click', function () { goToStep(2); });
    $('btnBackToRooms').addEventListener('click', function () { goToStep(1); });
    $('guestDetailsForm').addEventListener('submit', function (e) { e.preventDefault(); goToStep(3); });
    $('btnSummaryProceed').addEventListener('click', function () { goToStep(3); });
    $('btnBackToDetails').addEventListener('click', function () { goToStep(2); });
    $('btnEditRoom').addEventListener('click', function () { goToStep(1); });
    $('btnEditGuests').addEventListener('click', function () { goToStep(2); });
    $('btnFinalConfirm').addEventListener('click', confirmBooking);
    $('btnApplyCoupon').addEventListener('click', applyCoupon);
    $('btnRemoveCoupon').addEventListener('click', function () { clearCoupon(false); renderSummaries(); });
    $('couponCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } });
    $('couponCode').addEventListener('input', function () { this.value = this.value.toUpperCase(); });
    $('btnFinalConfirmSidebar').addEventListener('click', confirmBooking);
    Object.keys(RULES).forEach(function (id) {
      var el = $(id);
      el.addEventListener('blur', function () { checkField(id); renderSummaries(); });
      el.addEventListener('input', function () { if (el.classList.contains('is-invalid')) { var msg = RULES[id](el.value.trim()); if (!msg) setFieldError(el, ''); } });
    });
    $('guestCountry').addEventListener('change', function () { if ($('guestPhone').value) checkField('guestPhone'); });
    $('guestSpecialRequests').addEventListener('blur', renderSummaries);
    $$('.bk-summary__toggle').forEach(function (b) { b.addEventListener('click', function () {
      var open = !b.closest('.bk-summary').classList.contains('is-open');
      b.closest('.bk-summary').classList.toggle('is-open', open); b.setAttribute('aria-expanded', String(open));
    }); });
    $('btnPrintReceipt').addEventListener('click', function () { if (this.dataset.url) window.open(this.dataset.url, '_blank', 'noopener'); });
    $('bkSuccessModal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('is-open'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('bkSuccessModal').classList.remove('is-open'); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    fillCountSelects(); initDates(); bind();
    var pre = (new URLSearchParams(location.search).get('coupon') || '').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 40);
    if (pre) { $('couponCode').value = pre; couponMsg('Code ' + pre + ' will be applied once you choose a room.', false); }
    loadRooms();
  });
})();
