/* Unicon Journal landing page: filters, search, likes, saved stories, newsletter. Likes/saves live in this browser only (localStorage). */
(function () {
  'use strict';
  var LK = 'unicon.journal.likes', BK = 'unicon.journal.saved';
  function load(k) { try { var v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable: state lasts for this visit only */ } }
  var likes = load(LK), saved = load(BK);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  var grid = $('#jbGrid'); if (!grid) return;
  var cards = $$('.jb-card', grid), chips = $$('.jb-chip'), input = $('#jbSearch'), clear = $('#jbClear');
  var status = $('#jbStatus'), empty = $('#jbEmpty'), emptyMsg = $('#jbEmptyMsg');
  var state = { cat: 'all', q: '' };

  function paintButtons() {
    $$('[data-like]').forEach(function (b) { b.setAttribute('aria-pressed', String(likes.indexOf(b.dataset.like) > -1)); });
    $$('[data-save]').forEach(function (b) { b.setAttribute('aria-pressed', String(saved.indexOf(b.dataset.save) > -1)); });
    var n = $('#jbSavedCount'); if (n) n.textContent = saved.length;
  }
  function toggle(list, id) { var i = list.indexOf(id); if (i > -1) list.splice(i, 1); else list.push(id); }

  document.addEventListener('click', function (e) {
    var l = e.target.closest('[data-like]'), s = e.target.closest('[data-save]');
    if (l) { toggle(likes, l.dataset.like); save(LK, likes); paintButtons(); }
    if (s) { toggle(saved, s.dataset.save); save(BK, saved); paintButtons(); if (state.cat === 'saved') apply(); }
  });

  function apply() {
    var q = state.q.trim().toLowerCase(), words = q ? q.split(/\s+/) : [], shown = 0;
    cards.forEach(function (c) {
      var okCat = state.cat === 'all' || (state.cat === 'saved' ? saved.indexOf(c.dataset.id) > -1 : c.dataset.cat === state.cat);
      var hay = c.dataset.title + ' ' + c.dataset.keywords;
      var okQ = words.every(function (w) { return hay.indexOf(w) > -1; });
      var show = okCat && okQ;
      c.hidden = !show;
      c.classList.remove('jb-s1', 'jb-s2', 'jb-s3', 'jb-s4');
      if (show) { shown++; c.classList.add('jb-s' + ((shown - 1) % 4 + 1)); }
    });
    grid.classList.toggle('is-single', shown === 1);
    empty.hidden = shown > 0;
    if (!shown) emptyMsg.textContent = state.cat === 'saved' && !q ? 'You have not saved any stories yet. Use the bookmark on a story to keep it here.' : 'Nothing matches your search. Try a different word or category.';
    status.textContent = shown + (shown === 1 ? ' story' : ' stories') + (q ? ' for “' + state.q.trim() + '”' : '');
    clear.hidden = !input.value;
  }
  function setCat(cat) {
    state.cat = cat;
    chips.forEach(function (c) { var on = c.dataset.filter === cat; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
    apply();
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { setCat(c.dataset.filter); }); });
  $$('[data-jb-filter]').forEach(function (a) { a.addEventListener('click', function () { setCat(a.dataset.jbFilter); }); });
  input.addEventListener('input', function () { state.q = input.value; apply(); });
  $('#jbSearchForm').addEventListener('submit', function (e) { e.preventDefault(); });
  function reset() { input.value = ''; state.q = ''; setCat('all'); }
  clear.addEventListener('click', function () { input.value = ''; state.q = ''; apply(); input.focus(); });
  $('#jbReset').addEventListener('click', reset);

  /* Newsletter: the site has no mailing-list backend yet, so this opens the visitor's email app with a prefilled request instead of claiming to subscribe them. */
  var nf = $('#jbNewsForm'), ne = $('#jbNewsEmail'), nm = $('#jbNewsMsg');
  nf.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = ne.value.trim();
    nm.className = 'jb-news__msg';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { nm.classList.add('is-err'); nm.textContent = 'Please enter a valid email address.'; ne.focus(); return; }
    nm.classList.add('is-ok');
    nm.textContent = 'Your email app should open with a subscription request. Please send it to complete your sign-up. Nothing has been stored yet.';
    window.location.href = 'mailto:stay@uniconhospitality.example?subject=' + encodeURIComponent('Journal subscription request') + '&body=' + encodeURIComponent('Please add me to The Unicon Journal mailing list: ' + v);
  });

  paintButtons(); apply();
  if (location.hash && /^#cat-/.test(location.hash)) setCat(location.hash.slice(5));
})();
