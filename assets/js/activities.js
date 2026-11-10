/* Local Attractions page (activities.html): category filters, map, experiences, FAQ, reveal */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $all = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var grid = $('#atGrid');
  if (!grid) return;
  var cards = $all('.at-card', grid);
  var chips = $all('.at-chip');
  var statusEl = $('#atStatus');
  var emptyEl = $('#atEmpty');
  var mapEl = $('#atMap');
  var map = null, markers = {};

  function dirUrl(card) {
    var dir = card.getAttribute('data-dir');
    if (!dir) {
      var lat = card.getAttribute('data-lat');
      var lng = card.getAttribute('data-lng');
      dir = (lat && lng) ? (lat + ',' + lng) : (card.getAttribute('data-name') + ', Navi Mumbai');
    }
    return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dir) + '&travelmode=driving';
  }

  /* directions links */
  cards.forEach(function (c) {
    var url = dirUrl(c);
    $all('[data-dir]', c).forEach(function (a) {
      a.href = url;
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    });
  });

  /* ---------- map ---------- */
  function initMap() {
    if (!mapEl || !window.L) {
      if (mapEl) mapEl.innerHTML = '<p style="padding:24px;text-align:center">The map could not load. Please use the Get Directions buttons above.</p>';
      return;
    }
    map = L.map(mapEl, { scrollWheelZoom: false }).setView([19.04, 73.03], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    var icon = L.divIcon({ className: '', html: '<div class="at-pin"></div>', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
    cards.forEach(function (c) {
      var m = L.marker([parseFloat(c.getAttribute('data-lat')), parseFloat(c.getAttribute('data-lng'))], { icon: icon, title: c.getAttribute('data-name'), alt: c.getAttribute('data-name') });
      var pop = document.createElement('div');
      pop.className = 'at-pop';
      var s = document.createElement('strong'); s.textContent = c.getAttribute('data-name');
      var p = document.createElement('span'); p.textContent = c.getAttribute('data-place');
      var a = document.createElement('a'); a.className = 'at-btn at-btn--green'; a.textContent = 'Get Directions';
      a.href = dirUrl(c);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      pop.appendChild(s); pop.appendChild(p); pop.appendChild(a);
      m.bindPopup(pop);
      markers[c.id] = m;
    });
    syncMap(true);
    mapEl.addEventListener('focusin', function () { map.scrollWheelZoom.enable(); });
    mapEl.addEventListener('mouseleave', function () { map.scrollWheelZoom.disable(); });
  }

  function syncMap(fit) {
    if (!map) return;
    var pts = [];
    cards.forEach(function (c) {
      var m = markers[c.id];
      if (c.hidden) { map.removeLayer(m); } else { m.addTo(map); pts.push(m.getLatLng()); }
    });
    if (fit && pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 14 });
  }

  /* ---------- filters ---------- */
  function setChip(name) {
    chips.forEach(function (ch) {
      var on = ch.getAttribute('data-filter') === name;
      ch.classList.toggle('is-active', on);
      ch.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function apply(test, statusText) {
    var shown = 0;
    cards.forEach(function (c) {
      var ok = test(c);
      c.hidden = !ok;
      if (ok) { shown++; c.classList.add('is-in'); }
    });
    emptyEl.hidden = shown !== 0;
    if (statusText) {
      statusEl.innerHTML = '';
      statusEl.appendChild(document.createTextNode(statusText));
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'at-link'; b.setAttribute('data-filter', 'all'); b.textContent = 'Show all attractions';
      statusEl.appendChild(b);
      statusEl.hidden = false;
    } else {
      statusEl.hidden = true;
    }
    syncMap(true);
  }

  function filter(name) {
    setChip(name);
    if (name === 'all') return apply(function () { return true; });
    apply(function (c) { return (' ' + c.getAttribute('data-cats') + ' ').indexOf(' ' + name + ' ') > -1; });
  }

  /* ---------- details modal ---------- */
  var detailModalEl = $('#atDetailModal');
  var bsModalInstance = null;
  function getModalInstance() {
    if (!detailModalEl) return null;
    if (!bsModalInstance && window.bootstrap && window.bootstrap.Modal) {
      bsModalInstance = window.bootstrap.Modal.getInstance(detailModalEl) || new window.bootstrap.Modal(detailModalEl);
    }
    return bsModalInstance;
  }

  function cleanupBackdrop() {
    $all('.modal-backdrop').forEach(function (bd) {
      if (bd && bd.parentNode) bd.parentNode.removeChild(bd);
    });
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
  }

  function closeDetails(callback) {
    var inst = getModalInstance();
    if (inst && detailModalEl && (detailModalEl.classList.contains('show') || detailModalEl.style.display === 'block')) {
      var executed = false;
      var onHidden = function () {
        if (executed) return;
        executed = true;
        detailModalEl.removeEventListener('hidden.bs.modal', onHidden);
        cleanupBackdrop();
        if (callback) callback();
      };
      detailModalEl.addEventListener('hidden.bs.modal', onHidden);
      inst.hide();
      setTimeout(function () {
        if (!executed) {
          executed = true;
          detailModalEl.removeEventListener('hidden.bs.modal', onHidden);
          detailModalEl.classList.remove('show');
          detailModalEl.style.display = 'none';
          cleanupBackdrop();
          if (callback) callback();
        }
      }, 300);
    } else {
      if (detailModalEl) {
        detailModalEl.classList.remove('show');
        detailModalEl.style.display = 'none';
        detailModalEl.setAttribute('aria-hidden', 'true');
      }
      cleanupBackdrop();
      if (callback) callback();
    }
  }

  function openDetails(cardId) {
    var c = $('#' + cardId);
    if (!c) return;
    var name = c.getAttribute('data-name') || '';
    var place = c.getAttribute('data-place') || '';
    var cats = c.getAttribute('data-cats') || '';
    var descEl = $('.at-card__desc', c);
    var desc = descEl ? descEl.textContent : '';
    var imgEl = $('img', c);
    var imgSrc = imgEl ? imgEl.src : '';
    var imgAlt = imgEl ? imgEl.alt : name;

    var mImg = $('#atDetailImg');
    var mBadge = $('#atDetailBadge');
    var mLoc = $('#atDetailLoc span');
    var mTitle = $('#atDetailTitle');
    var mDesc = $('#atDetailDesc');
    var mDir = $('#atDetailDirBtn');
    var mMap = $('#atDetailMapBtn');

    if (mImg) { mImg.src = imgSrc; mImg.alt = imgAlt; }
    if (mBadge) {
      var tagEl = $('.at-tag', c);
      mBadge.textContent = tagEl ? tagEl.textContent : cats.toUpperCase();
    }
    if (mLoc) mLoc.textContent = place;
    if (mTitle) mTitle.textContent = name;
    if (mDesc) mDesc.textContent = desc;

    // Set Get Directions button href, target, and rel for this specific attraction
    if (mDir) {
      var url = dirUrl(c);
      mDir.href = url;
      mDir.setAttribute('href', url);
      mDir.setAttribute('target', '_blank');
      mDir.setAttribute('rel', 'noopener noreferrer');
    }

    // Set View on Map button target ID
    if (mMap) {
      mMap.setAttribute('data-target-id', c.id);
    }

    var inst = getModalInstance();
    if (inst) {
      inst.show();
    } else if (detailModalEl) {
      detailModalEl.classList.add('show');
      detailModalEl.style.display = 'block';
      detailModalEl.removeAttribute('aria-hidden');
    }
  }

  function viewOnMap(cardId) {
    var card = $('#' + cardId);
    if (!card) return;

    // If card was hidden by an active filter, reset to 'all' so card and marker are shown
    if (card.hidden) {
      filter('all');
    }

    var m = markers[card.id];

    // Ensure marker is attached to Leaflet map
    if (map && m && !map.hasLayer(m)) {
      m.addTo(map);
    }

    // 1. Close popup and completely clear backdrop
    closeDetails(function () {
      // 2. Smoothly scroll to the existing Navi Mumbai Attractions Map section
      var mapSection = $('#map');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }

      // 3. Highlight marker and open its popup on the map
      if (map && m) {
        setTimeout(function () {
          map.invalidateSize();
          map.setView(m.getLatLng(), 15, { animate: !reduce });
          m.openPopup();

          // Highlight the selected pin
          $all('.at-pin').forEach(function (pin) { pin.classList.remove('is-highlighted'); });
          var markerEl = m.getElement();
          var pinEl = markerEl ? markerEl.querySelector('.at-pin') : null;
          if (pinEl) {
            pinEl.classList.add('is-highlighted');
            setTimeout(function () { pinEl.classList.remove('is-highlighted'); }, 3500);
          }
        }, reduce ? 50 : 350);
      }
    });
  }

  // Ensure Get Directions link inside popup never has its click prevented by anything
  var detailDirBtn = $('#atDetailDirBtn');
  if (detailDirBtn) {
    detailDirBtn.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  // Close button inside modal
  if (detailModalEl) {
    var closeBtn = $('.at-modal__close', detailModalEl);
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeDetails();
      });
    }
  }

  document.addEventListener('click', function (e) {
    var d = e.target.closest('[data-detail]');
    if (d) {
      e.preventDefault();
      var id = d.getAttribute('data-detail');
      if (!id) {
        var card = d.closest('.at-card');
        if (card) id = card.id;
      }
      openDetails(id);
      return;
    }

    var vm = e.target.closest('[data-view-map], [data-show-map]');
    if (vm) {
      e.preventDefault();
      e.stopPropagation();
      var targetId = vm.getAttribute('data-target-id');
      var card = targetId ? $('#' + targetId) : vm.closest('.at-card');
      if (card) {
        viewOnMap(card.id);
      }
      return;
    }

    var f = e.target.closest('[data-filter]');
    if (f) { filter(f.getAttribute('data-filter')); return; }

    var j = e.target.closest('[data-at-jump]');
    if (j) {
      e.preventDefault();
      filter(j.getAttribute('data-at-jump'));
      $('#attractions').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      return;
    }

    var x = e.target.closest('[data-exp]');
    if (x) {
      var ids = x.getAttribute('data-exp').split(',');
      setChip('');
      apply(function (c) { return ids.indexOf(c.id) > -1; }, x.getAttribute('data-exp-title').replace(/&amp;/g, '&') + ': ');
      $('#attractions').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      return;
    }
  });

  /* ---------- FAQ ---------- */
  $all('.at-acc button').forEach(function (b) {
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') === 'true';
      $all('.at-acc button').forEach(function (o) {
        var on = o === b && !open;
        o.setAttribute('aria-expanded', on ? 'true' : 'false');
        o.closest('.at-acc').setAttribute('data-open', on ? '1' : '0');
      });
    });
  });

  /* ---------- scroll reveal ---------- */
  var items = $all('.at-card, .at-hl > li, .at-exp__card');
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('at-js');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: .1, rootMargin: '0px 0px -30px 0px' });
    items.forEach(function (n) { io.observe(n); });
  }

  initMap();
})();
