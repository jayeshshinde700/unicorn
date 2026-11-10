/* Unicon Hospitality - shared property details, map and directions (used by contact.html and about.html).
   Fill these in ONCE the business has confirmed them; every page that loads this file updates itself.
     address  - full postal address shown on the page
     mapQuery - "lat,lng" of the property: the OpenStreetMap embed and Get Directions (Google Maps) both use it.
               Current value is the pin Google Maps resolves for The Stone Arch, Digha; confirm it on the map
     email    - verified company email (leave '' to keep the one in the page markup)
   While address / mapQuery are empty no map is embedded and Get Directions explains why, so nothing misleading is published. */
(function () {
  'use strict';
  var PROPERTY = window.UNICON_PROPERTY = window.UNICON_PROPERTY || { address: 'MIDC Rd, Digha Gaon, Dighe, The Stone Arch, Navi Mumbai, Mumbai, India, 400708', mapQuery: '19.1759967,72.9991538', email: '' };

  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function setup() {
    if (PROPERTY.email) {
      $all('[data-uc="email"]').forEach(function (el) { el.textContent = PROPERTY.email; });
      $all('[data-uc="email-link"]').forEach(function (el) { el.href = 'mailto:' + PROPERTY.email; });
    }
    if (PROPERTY.address) $all('[data-uc="address"]').forEach(function (el) { el.textContent = PROPERTY.address; });

    var dirs = $all('[data-uc="directions"]');
    if (PROPERTY.mapQuery) {
      var q = encodeURIComponent(PROPERTY.mapQuery);
      dirs.forEach(function (a) { a.href = 'https://www.google.com/maps/dir/?api=1&destination=' + q; a.target = '_blank'; a.rel = 'noopener'; });
      var ll = PROPERTY.mapQuery.split(',').map(parseFloat), d = 0.004;
      var bbox = [ll[1] - d, ll[0] - d * 0.6, ll[1] + d, ll[0] + d * 0.6].join(',');
      var osm = 'https://www.openstreetmap.org/export/embed.html?bbox=' + encodeURIComponent(bbox) + '&layer=mapnik&marker=' + ll[0] + ',' + ll[1];
      $all('#ucMap, [data-uc="map"]').forEach(function (box) {
        box.innerHTML = '<iframe title="Unicon Hospitality on the map" src="' + osm + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';
      });
    } else {
      dirs.forEach(function (a) {
        if (a.classList.contains('uc-link')) a.setAttribute('aria-disabled', 'true');
        a.addEventListener('click', function (e) {
          e.preventDefault();
          $all('#ucDirNote, [data-uc="dir-note"]').forEach(function (n) {
            n.textContent = 'Directions will be available once our property address is confirmed. Please call +91 99204 00267 for help finding us.';
          });
        });
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
