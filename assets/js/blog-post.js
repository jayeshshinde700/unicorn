/* Unicon Journal article pages: reading progress, like/save, sharing. Same localStorage keys as blog.js. */
(function () {
  'use strict';
  var LK = 'unicon.journal.likes', BK = 'unicon.journal.saved';
  function load(k) { try { var v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  var likes = load(LK), saved = load(BK);
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };

  function paint() {
    $$('[data-like]').forEach(function (b) { b.setAttribute('aria-pressed', String(likes.indexOf(b.dataset.like) > -1)); });
    $$('[data-save]').forEach(function (b) { b.setAttribute('aria-pressed', String(saved.indexOf(b.dataset.save) > -1)); });
  }
  function toggle(list, id) { var i = list.indexOf(id); if (i > -1) list.splice(i, 1); else list.push(id); }
  paint();

  var note = document.getElementById('jpCopied'), url = location.href.split('#')[0], title = document.title;
  function say(t) { if (!note) return; note.textContent = t; clearTimeout(say.t); say.t = setTimeout(function () { note.textContent = ''; }, 2500); }

  document.addEventListener('click', function (e) {
    var l = e.target.closest('[data-like]'), s = e.target.closest('[data-save]'), sh = e.target.closest('[data-share]');
    if (l) { toggle(likes, l.dataset.like); save(LK, likes); paint(); }
    if (s) { toggle(saved, s.dataset.save); save(BK, saved); paint(); }
    if (!sh) return;
    e.preventDefault();
    var kind = sh.dataset.share;
    if (kind === 'whatsapp') window.open('https://wa.me/?text=' + encodeURIComponent(title + ' ' + url), '_blank', 'noopener');
    else if (kind === 'facebook') window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), '_blank', 'noopener');
    else if (kind === 'copy') {
      var done = function () { say('Link copied'); }, fail = function () { say('Copy failed. Please copy the address bar link.'); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, fail);
      else {
        var t = document.createElement('textarea'); t.value = url; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
        try { document.execCommand('copy') ? done() : fail(); } catch (x) { fail(); } document.body.removeChild(t);
      }
    }
  });

  /* reading progress across the article body */
  var bar = document.getElementById('jpBar'), body = document.getElementById('jpBody'), tick = false;
  function progress() {
    tick = false; if (!bar || !body) return;
    var r = body.getBoundingClientRect(), total = r.height - window.innerHeight * 0.5;
    var p = total > 0 ? Math.min(1, Math.max(0, (-r.top + window.innerHeight * 0.3) / total)) : 1;
    bar.style.width = (p * 100).toFixed(1) + '%';
  }
  window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(progress); } }, { passive: true });
  window.addEventListener('resize', progress); progress();

  /* smooth in-page anchors unless the visitor prefers reduced motion */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.style.scrollBehavior = 'smooth';
})();
