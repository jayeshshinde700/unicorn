/* Unicon Hospitality - About page script. Scroll-reveal only; everything else comes from the shared site script. */
(function () {
  'use strict';
  var items = Array.prototype.slice.call(document.querySelectorAll('.about-reveal'));
  if (!items.length) return;

  items.forEach(function (el) {
    var d = parseInt(el.getAttribute('data-delay'), 10);
    if (d) el.style.setProperty('--d', d);
  });

  function show(el) { el.classList.add('is-in'); }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) { items.forEach(show); return; }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach(function (el) { io.observe(el); });

  /* safety net: never leave content hidden */
  setTimeout(function () { items.forEach(show); }, 6000);
})();
