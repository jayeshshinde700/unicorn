/* Unicorn Hospitality - home page "Our Rooms" carousel: keeps each card in step with the Rooms page.
   Source of truth: api/rooms.php (the admin dashboard). If it is unreachable, the cards of rooms.html are read instead.
   A room with no usable price shows "Enquire for Price". */
(function () {
  'use strict';
  var slides = [].slice.call(document.querySelectorAll('.main__room__slider [data-room-id]'));
  if (!slides.length || !window.fetch) return;

  function season(d) {                       /* same seasons as rooms.js */
    var m = d.getMonth(), day = d.getDate();
    if (m === 9 || (m === 10 && day <= 20)) return 'festive';
    if ((m === 10 && day >= 21) || m === 11 || m === 0 || m === 1) return 'winter';
    if (m >= 2 && m <= 4) return 'summer';
    return 'monsoon';
  }
  function get(url, ms) {
    var ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, { cache: 'no-cache', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r; });
  }
  function fromFeed() {
    return get('api/rooms.php', 2500).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || d.ok !== true || !Array.isArray(d.rooms) || !d.rooms.length) throw new Error('feed');
      var s = season(new Date()), map = {};
      d.rooms.forEach(function (r) {
        var sp = r.seasonal && +r.seasonal[s] > 0 ? +r.seasonal[s] : 0;
        map[r.id] = { name: r.name, size: +r.size, guests: +r.guests, bed: r.bed, price: sp || +r.price };
      });
      return map;
    });
  }
  function fromRoomsPage() {                 /* built-in cards of rooms.html */
    return get('rooms.html', 4000).then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html'), map = {};
      [].slice.call(doc.querySelectorAll('.rm-card[data-id]')).forEach(function (c) {
        var a = c.querySelector('.rm-card__title a'), cat = c.querySelector('.rm-card__cat');
        map[c.getAttribute('data-id')] = {
          name: a ? a.textContent.trim() : '', size: +c.getAttribute('data-size'), guests: +c.getAttribute('data-guests'),
          bed: cat ? cat.textContent.split('·')[1] : '', price: +c.getAttribute('data-price')
        };
      });
      return map;
    });
  }
  function setText(el, txt) { var n = el.lastChild; if (n && n.nodeType === 3) n.nodeValue = ' ' + txt; else el.appendChild(document.createTextNode(' ' + txt)); }

  function apply(map) {
    slides.forEach(function (sl) {
      var r = map[sl.getAttribute('data-room-id')], spans = sl.querySelectorAll('.room__content__meta span'), price = sl.querySelector('[data-room-price]');
      if (!r) return;
      if (r.name) sl.querySelector('.room__title h5').textContent = r.name;
      if (r.size > 0 && spans[0]) setText(spans[0], r.size + ' sqm');
      if (r.guests > 0 && spans[1]) setText(spans[1], r.guests + ' Guests');
      if (r.bed && spans[2]) setText(spans[2], String(r.bed).trim());
      if (price) price.textContent = r.price > 0 ? '₹' + Number(r.price).toLocaleString('en-IN') : 'Enquire for Price';
    });
  }
  fromFeed().catch(fromRoomsPage).then(apply).catch(function () { /* keep the static cards ("Enquire for Price") */ });
})();
