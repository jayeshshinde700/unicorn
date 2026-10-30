/* Offers & Packages page.
   1) The shared site script already starts WOW once (live:false); this file never initialises it again.
   2) The "Celebration Calendar" (seasons + festival campaigns) is rendered here.

   CONFIGURING DATES
   Festival dates move every year, so none are hard-coded. When the hotel confirms a campaign, add it to FESTIVAL_DATES
   below using the festival id (ISO dates, inclusive). Example:
       diwali: { start: '2026-11-05', end: '2026-11-12' }
   A festival with dates is shown as Active (today is inside the range), Upcoming (before it) or Expired (after it).
   A festival without dates shows "Dates to be announced". Expired campaigns are never shown as available. */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---- package cards: make sure they are readable if motion is reduced or WOW is missing ---- */
  if (reduce || !window.WOW) {
    [].slice.call(document.querySelectorAll('.of-card.wow')).forEach(function (c) {
      c.classList.remove('wow'); c.style.visibility = 'visible'; c.style.animation = 'none';
    });
  }

  /* ================= celebration calendar ================= */
  var seasonsEl = document.getElementById('ccSeasons');
  if (!seasonsEl) return;
  var featureEl = document.getElementById('ccFeature');
  var gridEl = document.getElementById('ccGrid');
  var stageEl = document.getElementById('ccStage');
  var collTitle = document.getElementById('ccCollTitle');

  var FESTIVAL_DATES = {
    /* id: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } - add only when confirmed by the hotel */
  };

  var IMG = 'assets/images/unicon/';
  var ICON = {
    festive: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3"/>',
    winter: '<path d="M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>',
    summer: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    monsoon: '<path d="M7 16a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 8a4 4 0 0 1-1 8z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>'
  };
  var ASK = {
    festive: ['Celebration dining', 'Rooms for family gatherings', 'Festive stay planning'],
    winter: ['Celebration dining', 'Rooms for family or friends', 'Late checkout requests'],
    summer: ['Family-friendly stays', 'Group and holiday bookings', 'Extended-stay planning'],
    monsoon: ['Relaxed getaways', 'Rooms for family or friends', 'Celebration dining']
  };

  /* hue = colour wash over the photo so every festival feels distinct; img = photo (unique within a season) */
  var SEASONS = [
    { id: 'festive', name: 'Festive Season', range: 'October to mid-November', img: 'banner/1a.jpg', hue: '#8a4b12',
      lead: 'Lights, sweets and gatherings that bring the family together.',
      items: [
        ['diwali', 'Diwali', 'The festival of lights', 'Celebrate the festival of lights with a stay that feels like a homecoming.', 'gallery/3.jpg', '#a8630c'],
        ['navratri', 'Navratri', 'Nine nights of colour', 'Nine nights of music, dance and colour, with a comfortable stay to return to.', 'gallery/1.avif', '#9b2c5b'],
        ['dussehra', 'Dussehra', 'Victory of good over evil', 'A festive break around Dussehra for family outings and get-togethers.', 'about/2.jpg', '#a33a1c'],
        ['bhai-dooj', 'Bhai Dooj', 'Siblings together', 'Bring siblings and families together for a relaxed celebration.', 'rooms/family.jpg', '#7c5a14'],
        ['chhath-puja', 'Chhath Puja', 'Sunrise and gratitude', 'A calm stay for families travelling for Chhath Puja.', 'gallery/6.jpg', '#b3641a']
      ] },
    { id: 'winter', name: 'Winter & New Year', range: 'Mid-November to February', img: 'dining/rooftop-bar.webp', hue: '#1d3d5c',
      lead: 'Year-end celebrations, harvest festivals and romantic getaways.',
      items: [
        ['christmas', 'Christmas', 'A season of joy', 'Gather for a Christmas celebration in a warm, welcoming setting.', 'dining/restaurant.webp', '#7a1f2b'],
        ['new-years-eve', "New Year's Eve", 'Ring in the new year', 'Welcome the new year with friends and family under one roof.', 'dining/bar.webp', '#2b2d6b'],
        ['makar-sankranti', 'Makar Sankranti', 'Harvest and kites', 'A cheerful break to mark the start of the harvest season.', 'gallery/4.jpg', '#b4741a'],
        ['pongal', 'Pongal', 'Harvest thanksgiving', 'Celebrate the harvest festival with family in comfort.', 'gallery/5.jpg', '#8a5a14'],
        ['republic-day', 'Republic Day', 'A long weekend away', 'Make the most of the Republic Day holiday with a restful escape.', 'about/11.jpg', '#1f5a3a'],
        ['valentines-day', "Valentine's Day", 'For two', 'A romantic stay and a table for two.', 'rooms/premium.jpg', '#9c2346']
      ] },
    { id: 'summer', name: 'Summer Staycation', range: 'March to May', img: 'gallery/7.jpg', hue: '#c0801c',
      lead: 'Colour, school holidays and long, unhurried days.',
      items: [
        ['holi', 'Holi', 'The festival of colours', 'Celebrate Holi with family and friends, then unwind in comfort.', 'gallery/2.avif', '#b02e6e'],
        ['easter', 'Easter', 'A spring weekend', 'A relaxed Easter break for families and friends.', 'rooms/deluxe.jpg', '#5a7a38'],
        ['summer-holidays', 'Summer Holidays', 'Time off, together', 'A staycation for the school-holiday season with space for everyone.', 'about/amenities.webp', '#cf8a10'],
        ['family-vacations', 'Family Vacations', 'Room for everyone', 'Plan a family vacation with rooms and dining that suit all ages.', 'rooms/executive.jpg', '#2f6b7a']
      ] },
    { id: 'monsoon', name: 'Monsoon Escape', range: 'June to September', img: 'about/1.avif', hue: '#1f5a4a',
      lead: 'Rain-fresh getaways and a calendar full of festivals.',
      items: [
        ['independence-day', 'Independence Day', 'A holiday to enjoy', 'Spend the Independence Day holiday in a restful, relaxed setting.', 'banner/1.jpg', '#d1741a'],
        ['raksha-bandhan', 'Raksha Bandhan', 'The bond of siblings', 'A warm celebration for siblings and families.', 'rooms/unicon.webp', '#a8366a'],
        ['janmashtami', 'Janmashtami', 'Midnight celebrations', 'A comfortable stay for families celebrating Janmashtami.', 'dining/bites.webp', '#2d4d8a'],
        ['onam', 'Onam', 'A feast of flavours', 'Mark Onam with family and a table to remember.', 'dining.webp', '#bf8f12'],
        ['ganesh-chaturthi', 'Ganesh Chaturthi', 'Welcoming Ganpati', 'A festive stay around Ganesh Chaturthi for families and groups.', 'gallery/1.avif', '#b8501a'],
        ['eid', 'Eid Celebrations', 'Where relevant', 'Gather for Eid in comfort, with dining and rooms for the whole family.', 'about/2.jpg', '#1d6b55']
      ] }
  ];
  /* regional festivals / long weekends: one flexible campaign in every season */
  var REGIONAL = {
    festive: 'gallery/7.jpg', winter: 'gallery/2.avif', summer: 'gallery/6.jpg', monsoon: 'gallery/5.jpg'
  };

  /* normalise to objects */
  SEASONS.forEach(function (s) {
    s.items = s.items.map(function (a) { return { id: a[0], title: a[1], tag: a[2], text: a[3], img: a[4], hue: a[5], season: s.id }; });
    s.items.push({ id: s.id + '-regional', title: 'Regional Festivals & Long Weekends', tag: 'Your local celebration',
      text: 'Planning a stay around a regional festival or a long weekend? Tell us the dates and we will help shape it.',
      img: REGIONAL[s.id], hue: s.hue, season: s.id, generic: true });
  });

  /* ---- status ---- */
  function status(item) {
    var d = FESTIVAL_DATES[item.id];
    if (!d || !d.start || !d.end) return { key: 'tba', label: 'Dates to be announced', dates: '' };
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var s = new Date(d.start + 'T00:00:00'), e = new Date(d.end + 'T23:59:59');
    var fmt = function (x) { return x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
    var range = fmt(s) + ' – ' + fmt(e);
    if (now > e) return { key: 'expired', label: 'Past campaign', dates: range };
    if (now >= s) return { key: 'active', label: 'Now on', dates: range };
    return { key: 'upcoming', label: 'Coming up', dates: range };
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function svg(id) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[id] + '</svg>'; }
  function bg(item) { return 'background-image:url(' + IMG + item.img + ');--hue:' + item.hue; }

  var state = { season: SEASONS[0].id, item: SEASONS[0].items[0].id };
  function seasonById(id) { return SEASONS.filter(function (s) { return s.id === id; })[0]; }

  /* ---- selector ---- */
  function renderSeasons() {
    seasonsEl.innerHTML = SEASONS.map(function (s) {
      var on = s.id === state.season;
      return '<button type="button" role="tab" class="cc-season' + (on ? ' is-on' : '') + '" id="ccTab-' + s.id + '" data-season="' + s.id +
        '" aria-selected="' + on + '" aria-controls="ccStage" tabindex="' + (on ? 0 : -1) + '" style="' + bg({ img: s.img, hue: s.hue }) + '">' +
        '<span class="cc-season__icon">' + svg(s.id) + '</span>' +
        '<span class="cc-season__name">' + esc(s.name) + '</span>' +
        '<span class="cc-season__range">' + esc(s.range) + '</span></button>';
    }).join('');
  }

  /* ---- featured campaign ---- */
  function renderFeature() {
    var s = seasonById(state.season);
    var it = s.items.filter(function (x) { return x.id === state.item; })[0];
    var st = status(it), ended = st.key === 'expired';
    var ask = ASK[s.id];
    featureEl.setAttribute('data-status', st.key);
    featureEl.innerHTML =
      '<div class="cc-feature__media" style="' + bg(it) + '"><span class="cc-feature__season">' + svg(s.id) + esc(s.name) + '</span></div>' +
      '<div class="cc-feature__body">' +
        '<span class="cc-chip cc-chip--' + st.key + '">' + esc(st.label) + '</span>' +
        '<span class="cc-feature__tag">' + esc(it.tag) + '</span>' +
        '<h3>' + esc(it.title) + '</h3>' +
        '<p>' + esc(it.text) + '</p>' +
        (st.dates ? '<p class="cc-feature__dates">' + esc(st.dates) + '</p>' : '') +
        '<div class="cc-ask"><span>Ask us about</span><ul>' + ask.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>' +
        (ended
          ? '<p class="cc-feature__ended">This campaign has ended. Enquire about our next celebration.</p><div class="cc-feature__cta"><a class="theme-btn btn-style fill" href="contact.html#enquiry"><span>Enquire Now</span></a></div>'
          : '<div class="cc-feature__cta"><a class="theme-btn btn-style fill" href="contact.html#enquiry"><span>Enquire Now</span></a><a class="cc-link" href="rooms.html">Explore Rooms</a></div>') +
      '</div>';
  }

  /* ---- collection ---- */
  function renderGrid() {
    var s = seasonById(state.season);
    collTitle.textContent = s.name + ' celebrations';
    var items = s.items.filter(function (x) { return x.id !== state.item; });
    gridEl.innerHTML = items.map(function (it, i) {
      var st = status(it);
      return '<button type="button" class="cc-card cc-card--' + (i % 5) + ' is-' + st.key + '" data-item="' + it.id + '" style="' + bg(it) + '" aria-label="Feature ' + esc(it.title) + '">' +
        '<span class="cc-card__shade"></span>' +
        '<span class="cc-chip cc-chip--' + st.key + '">' + esc(st.label) + '</span>' +
        '<span class="cc-card__text"><small>' + esc(it.tag) + '</small><strong>' + esc(it.title) + '</strong></span></button>';
    }).join('');
  }

  var swapTimer;
  function paint(animate) {
    var go = function () { renderSeasons(); renderFeature(); renderGrid(); stageEl.classList.remove('is-swapping'); };
    clearTimeout(swapTimer);
    if (animate && !reduce) { stageEl.classList.add('is-swapping'); swapTimer = setTimeout(go, 200); } else { go(); }
  }

  seasonsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.cc-season'); if (!b || b.dataset.season === state.season) return;
    var s = seasonById(b.dataset.season); state.season = s.id; state.item = s.items[0].id; paint(true);
    setTimeout(function () { var t = document.getElementById('ccTab-' + s.id); if (t) t.focus({ preventScroll: true }); }, reduce ? 0 : 230);
  });
  seasonsEl.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var i = SEASONS.map(function (s) { return s.id; }).indexOf(state.season);
    i = (i + (e.key === 'ArrowRight' ? 1 : SEASONS.length - 1)) % SEASONS.length;
    e.preventDefault(); state.season = SEASONS[i].id; state.item = SEASONS[i].items[0].id; paint(true);
    setTimeout(function () { var t = document.getElementById('ccTab-' + SEASONS[i].id); if (t) t.focus({ preventScroll: true }); }, reduce ? 0 : 230);
  });
  gridEl.addEventListener('click', function (e) {
    var c = e.target.closest('.cc-card'); if (!c) return;
    state.item = c.dataset.item; paint(true);
    var top = featureEl.getBoundingClientRect().top + window.pageYOffset - 100;
    window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
  });

  /* open on the season that matches today (first festival of it) */
  var m = new Date().getMonth() + 1;
  state.season = (m === 10 || (m === 11)) ? 'festive' : (m === 12 || m <= 2) ? 'winter' : (m >= 3 && m <= 5) ? 'summer' : (m >= 6 && m <= 9) ? 'monsoon' : 'festive';
  state.item = seasonById(state.season).items[0].id;
  paint(false);
})();
