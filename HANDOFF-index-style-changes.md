


**C. New top-level "Rooms" menu item.** Insert as a new block between the "Stay" `</li>` (original line 117) and the "Offers" `<li>` (between original line 118, the blank line, and original line 119, the Offers <li>):

ADD:
```html
                                    <li class="navigation__menu--item">
                                        <a href="rooms.html" class="navigation__menu--item__link">Rooms</a>
                                    </li>
```
Result (desktop menu order): Book, Stay, **Rooms**, Offers, About, Contact.

**D. New "Rooms" link in the mobile menu.** Insert directly above the existing Offers link (original line 809):

ADD:
```html
                            <a class="um-mnav__link" href="rooms.html">Rooms</a>
```
placed immediately above
```html
                            <a class="um-mnav__link" href="#offers">Offers</a>
```

---

## 2. `assets/css/style.css`: append this block at the very END of the file

The original file ended at line 13502. Add these lines after it. Nothing existing is edited or removed.

```css
/* ===== HERO SLIDER (2026-10-26): cinematic push transition + text reveal =====
   main.js adds .hero-fx (text prepared) and .hero-go (page loaded, play). Without the script everything simply stays visible.
   Timing lives in the JS (HERO_SPEED / HERO_DELAY); easing curves are the three variables below. */
.banner__slider{--hero-ease:cubic-bezier(.7,0,.2,1);--hero-out:cubic-bezier(.16,1,.3,1);--hero-in:cubic-bezier(.5,0,.75,0);--hero-gold:#D9BE8C}

/* until the script has prepared the text keep it hidden (no flash); shows by itself after 2.5s if the script never runs */
.banner__slider.hero-cine:not(.hero-fx) .banner__slide__content{visibility:hidden;animation:heroShow 0s linear 2.5s forwards}
@keyframes heroShow{to{visibility:visible}}

/* the old CSS-only entrance animations are replaced by the effects below */
.banner__slider.hero-fx .swiper-slide-active .banner__slider__image,
.banner__slider.hero-fx .swiper-slide-active .banner__slide__content .subtitle__icon,
.banner__slider.hero-fx .swiper-slide-active .banner__slide__content h1,
.banner__slider.hero-fx .swiper-slide-active .banner__slide__content .sub__text,
.banner__slider.hero-fx .swiper-slide-active .banner__slide__content .theme-btn{animation:none}

/* --- the slide movement --- */
.banner__slider.hero-fx .swiper-slide{transition-timing-function:var(--hero-ease);will-change:transform}
/* the slide that is leaving darkens slowly; the one arriving is clear straight away */
.banner__slider.hero-fx .banner__slider__image::after{content:"";position:absolute;inset:0;z-index:1;background:#06130f;opacity:.6;pointer-events:none;transition:opacity 1.5s var(--hero-ease)}
.banner__slider.hero-fx .swiper-slide-active .banner__slider__image::after{opacity:0;transition:opacity .25s ease}
/* the picture settles from 1.07 to 1 as it arrives, and drifts forward a little as it leaves */
.banner__slider.hero-fx .banner__slider__image{transform:scale(1.07);transition:transform 1.8s var(--hero-ease)}
.banner__slider.hero-go .swiper-slide-active .banner__slider__image{transform:none;transition:transform 2.8s var(--hero-out)}

/* --- text panel: fades up, a gold line draws down its left edge --- */
.banner__slider.hero-fx .banner__slide__content{opacity:0;transform:translate3d(0,22px,0);transition:opacity .45s ease,transform .45s ease}
.banner__slider.hero-go .swiper-slide-active .banner__slide__content{opacity:1;transform:none;transition:opacity 1s ease .4s,transform 1.2s var(--hero-out) .4s}
.banner__slider.hero-fx .banner__slide__content::after{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:4px 0 0 4px;background:var(--hero-gold);transform:scaleY(0);transform-origin:top;transition:transform .4s ease}
.banner__slider.hero-go .swiper-slide-active .banner__slide__content::after{transform:none;transition:transform 1.3s var(--hero-out) .75s}

/* --- heading: every word rises out of its own mask, one after another --- */
.banner__slider.hero-fx .hw{display:inline-block;vertical-align:top;overflow:hidden;padding:.15em .12em .25em;margin:-.15em -.12em -.25em}
.banner__slider.hero-fx .hw>span{display:inline-block;opacity:0;transform:translate3d(0,125%,0) rotate(6deg);transform-origin:0 100%;transition:transform .55s var(--hero-in),opacity .35s ease}
.banner__slider.hero-go .swiper-slide-active .hw>span{opacity:1;transform:none;transition:transform 1.3s var(--hero-out) calc(.8s + var(--i) * .09s),opacity .5s ease calc(.8s + var(--i) * .09s)}

/* --- paragraph: words come into focus --- */
.banner__slider.hero-fx .hs{display:inline-block;opacity:0;transform:translate3d(0,16px,0);filter:blur(5px);transition:opacity .35s ease,transform .35s ease,filter .35s ease}
.banner__slider.hero-go .swiper-slide-active .hs{opacity:1;transform:none;filter:blur(0);transition:opacity .9s ease calc(1.2s + var(--i) * .022s),transform 1.1s var(--hero-out) calc(1.2s + var(--i) * .022s),filter .9s ease calc(1.2s + var(--i) * .022s)}

/* --- button: pops up last --- */
.banner__slider.hero-fx .hero-btn{opacity:0;transform:translate3d(0,18px,0) scale(.94);transform-origin:left center;transition:opacity .35s ease,transform .35s ease}
.banner__slider.hero-go .swiper-slide-active .hero-btn{opacity:1;transform:none;transition:opacity .8s ease 1.7s,transform 1s var(--hero-out) 1.7s}

/* --- slide counter + progress bars --- */
.banner__slider .hero-ui-wrap{position:absolute;left:0;right:0;bottom:76px;z-index:6;margin:0 auto;pointer-events:none}
.banner__slider.hero-fx .hero-ui-wrap{opacity:0;transition:opacity .6s ease}
.banner__slider.hero-go .hero-ui-wrap{opacity:1;transition:opacity 1s ease 1.8s}
.hero-ui{display:flex;align-items:center;gap:22px;width:max-content;max-width:100%;color:#fff;pointer-events:auto;text-shadow:0 1px 10px rgba(0,0,0,.55)}
.hero-ui__count{display:flex;align-items:center;gap:12px;font-family:var(--jost);font-size:13px;font-weight:600;letter-spacing:.14em;line-height:1}
.hero-ui__num{display:block;height:1em;font-family:var(--glida);font-size:26px;font-weight:600;letter-spacing:0;line-height:1;font-variant-numeric:lining-nums;overflow:hidden}
.hero-ui__strip{display:block;transition:transform .9s var(--hero-ease)}
.hero-ui__strip i{display:block;height:1em;font-style:normal}
.hero-ui__count em{display:block;width:30px;height:1px;background:rgba(255,255,255,.6)}
.hero-ui__total{opacity:.8}
.hero-ui__bars{display:flex;gap:10px}
.hero-ui__bar{position:relative;width:56px;height:20px;padding:0;border:0;background:none;cursor:pointer}
.hero-ui__bar::before,.hero-ui__bar span{content:"";position:absolute;left:0;top:50%;height:2px;margin-top:-1px}
.hero-ui__bar::before{right:0;background:rgba(255,255,255,.35);transition:background .3s ease}
.hero-ui__bar:hover::before{background:rgba(255,255,255,.7)}
.hero-ui__bar span{width:100%;background:var(--hero-gold);transform:scaleX(0);transform-origin:left}
.hero-ui__bar.is-done span{transform:scaleX(1)}
.hero-ui__bar.is-active span{animation:heroFill var(--hero-t,6s) linear forwards}
.banner__slider.is-paused .hero-ui__bar.is-active span{animation-play-state:paused}
@keyframes heroFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (max-width:767px){.banner__slider .hero-ui-wrap{bottom:76px}.hero-ui{gap:16px}.hero-ui__bar{width:36px}.hero-ui__num{font-size:22px}}

/* --- arrows nudge on hover --- */
.banner__slider .rts__slider__nav svg{transition:transform .45s var(--hero-out)}
.banner__slider .rts__slider__nav .next:hover svg{transform:translateX(8px)}
.banner__slider .rts__slider__nav .prev:hover svg{transform:translateX(-8px)}

/* people who asked for less motion: no staggering delays (the global rule above already makes the movement instant) */
@media (prefers-reduced-motion:reduce){
  .banner__slider.hero-fx *,.banner__slider.hero-fx .banner__slide__content::after{transition-delay:0s!important}
}
```

---

## 3. `assets/js/2026-10-22-unicorn-hospitality-v2-main.js`: replace the hero code

Inside `if (window.Swiper) {` (line 68), the hero code at **original lines 69 to 92** is replaced by the new block below. The code after it (`/* rooms: duplicate the cards once ... */`) is unchanged.

### FROM (original lines 69 to 92)
```js
    /* hero videos: only the visible slide plays (saves data + CPU); photo poster shows if a video is missing */
    function playActiveVideo(sw) {
      $$('.banner__slider video').forEach(function (v) { v.pause(); });
      var v = sw.slides[sw.activeIndex] && sw.slides[sw.activeIndex].querySelector('video');
      if (v) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    }
    /* hero slider: changes every 4 seconds, arrows work, loops forever.
       (Own timer + own arrow handlers, so it works even when the OS has "reduce animations" turned on.) */
    var HERO_DELAY = 4000;                       /* 4 seconds - change here */
    var hero = new Swiper('.banner__slider', {
      loop: true, speed: 900, effect: 'fade', fadeEffect: { crossFade: true },
      allowTouchMove: true,
      on: { init: playActiveVideo, slideChangeTransitionStart: playActiveVideo }
    });
    var heroTimer;
    function heroStart() {
      clearInterval(heroTimer);
      heroTimer = setInterval(function () { if (!document.hidden) hero.slideNext(); }, HERO_DELAY);
    }
    heroStart();
    hero.on('touchEnd', heroStart);
    var hn = $('.rts__slider__nav .next'), hp = $('.rts__slider__nav .prev');
    if (hn) hn.addEventListener('click', function () { hero.slideNext(); heroStart(); });
    if (hp) hp.addEventListener('click', function () { hero.slidePrev(); heroStart(); });
```

### TO (new block, replaces the lines above)
```js
    /* ---- HERO SLIDER: cinematic push transition + word-by-word text reveal ----
       The animation itself is CSS (style.css, block "HERO SLIDER"). This script only:
       splits the text into words, runs the autoplay timer, the counter + progress bars, and plays the visible video.
       (Own timer + own arrow handlers, so it works even when the OS has "reduce animations" turned on.) */
    var HERO_DELAY = 3000;                       /* how long a slide rests after it has finished moving (ms) - change here */
    var HERO_SPEED = 1300;                       /* how long the slide movement takes (ms) - change here */
    function initHero() {
      var el = $('.banner__slider');
      if (!el) return;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var count = $$('.swiper-slide', el).length;

      /* 1. prepare the text: heading + paragraph become words, the button gets a wrapper (CSS animates these) */
      function split(node, masked) {
        var words = node.textContent.trim().split(/\s+/);
        node.textContent = '';
        words.forEach(function (w, i) {
          var inner = document.createElement('span'), outer = inner;
          inner.textContent = w;
          inner.style.setProperty('--i', i);
          if (masked) { outer = document.createElement('span'); outer.className = 'hw'; outer.appendChild(inner); }
          else inner.className = 'hs';
          if (i) node.appendChild(document.createTextNode(' '));
          node.appendChild(outer);
        });
      }
      $$('.banner__slide__content h1', el).forEach(function (n) { split(n, true); });
      $$('.banner__slide__content .sub__text', el).forEach(function (n) { split(n, false); });
      $$('.banner__slide__content .theme-btn', el).forEach(function (b) {
        var wrap = document.createElement('div'); wrap.className = 'hero-btn';
        b.parentNode.insertBefore(wrap, b); wrap.appendChild(b);
      });

      /* 2. counter + progress bars (built here so the page still works without this script) */
      var ui = document.createElement('div'); ui.className = 'container hero-ui-wrap';
      var nums = '', bars = '';
      for (var n = 0; n < count; n++) {
        nums += '<i>0' + (n + 1) + '</i>';
        bars += '<button type="button" class="hero-ui__bar" aria-label="Show slide ' + (n + 1) + '"><span></span></button>';
      }
      ui.innerHTML = '<div class="hero-ui"><div class="hero-ui__count" aria-hidden="true"><span class="hero-ui__num"><span class="hero-ui__strip">' + nums +
        '</span></span><em></em><span class="hero-ui__total">0' + count + '</span></div><div class="hero-ui__bars">' + bars + '</div></div>';
      el.appendChild(ui);
      var strip = $('.hero-ui__strip', ui), barEls = $$('.hero-ui__bar', ui);
      function setUi(i, ms) {
        ui.style.setProperty('--hero-t', ms + 'ms');
        strip.style.transform = 'translate3d(0,' + (-i) + 'em,0)';
        barEls.forEach(function (b, k) {
          b.classList.toggle('is-done', k < i);
          b.classList.remove('is-active');
          if (k === i) { void b.offsetWidth; b.classList.add('is-active'); }   /* reflow = restart the fill */
        });
      }

      /* 3. the slider */
      el.classList.add('hero-fx');
      var hero = new Swiper(el, {
        loop: true, speed: reduce ? 0 : HERO_SPEED, effect: 'creative',
        creativeEffect: {
          limitProgress: 1,
          prev: { translate: ['-26%', 0, -1] },                  /* old slide drifts back (the dimming is CSS) */
          next: { translate: ['100%', 0, 0] }                     /* new slide glides over it */
        },
        grabCursor: true, allowTouchMove: true,
        keyboard: { enabled: true, onlyInViewport: true },
        on: { slideChangeTransitionStart: function (sw) { onSlide(sw, HERO_SPEED + HERO_DELAY); }, slideChangeTransitionEnd: settle }
      });

      /* videos: the arriving slide starts playing when it starts moving; the old one stops once it has gone.
         The neighbours are pre-loaded so the picture is ready before the slide arrives. */
      function play(v) { if (!v) return; v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      function videoAt(sw, i) { var s = sw.slides[i]; return s && s.querySelector('video'); }
      function settle(sw) {
        var keep = videoAt(sw, sw.activeIndex);
        $$('video', el).forEach(function (v) { if (v !== keep) v.pause(); });
      }
      function warm(sw) {
        var len = sw.slides.length;
        [sw.activeIndex + 1, sw.activeIndex - 1].forEach(function (i) {
          var v = videoAt(sw, (i + len) % len); if (v && v.preload !== 'auto') v.preload = 'auto';
        });
      }

      /* timer: restarts on every slide change (arrows, bars, swipe, keyboard); waits while the hero is off-screen or the tab is hidden */
      var timer, left = 0, t0 = 0, started = false, hold = { tab: document.hidden };
      function holding() { return hold.off || hold.tab; }
      function advance() {
        if (hero.animating) { timer = setTimeout(advance, 150); return; }
        hero.slideNext();
      }
      function run(ms) {
        clearTimeout(timer); left = ms; t0 = Date.now();
        el.classList.toggle('is-paused', !!holding());
        if (!holding()) timer = setTimeout(advance, left);
      }
      function setHold(key, on) {
        var was = holding(); hold[key] = on;
        if (!started || was === holding()) return;
        if (holding()) { clearTimeout(timer); left = Math.max(0, left - (Date.now() - t0)); }
        else { t0 = Date.now(); timer = setTimeout(advance, left); }
        el.classList.toggle('is-paused', !!holding());
      }
      function onSlide(sw, ms) {
        var v = videoAt(sw, sw.activeIndex);
        play(v); warm(sw);
        setTimeout(function () { settle(sw); }, HERO_SPEED + 500);   /* backup for slideChangeTransitionEnd */
        setUi(sw.realIndex, ms);
        started = true; run(ms);
      }

      /* first slide: wait until the page has loaded, then play the intro */
      var introDone = false;
      function intro() {
        if (introDone) return; introDone = true;
        el.classList.add('hero-go');
        onSlide(hero, HERO_DELAY + 900);
      }
      function introSoon() { requestAnimationFrame(function () { requestAnimationFrame(intro); }); }
      $$('video', el).forEach(function (v) { v.pause(); });
      play(videoAt(hero, hero.activeIndex)); warm(hero);
      if (document.readyState === 'complete') introSoon(); else window.addEventListener('load', introSoon);
      setTimeout(intro, 2800);                    /* safety net (rAF does not run in a background tab) */

      document.addEventListener('visibilitychange', function () { setHold('tab', document.hidden); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (e) {
          var seen = e[0].isIntersecting;
          setHold('off', !seen);
          if (seen) play(videoAt(hero, hero.activeIndex)); else $$('video', el).forEach(function (v) { v.pause(); });
        }, { threshold: 0.2 }).observe(el);
      }

      /* controls */
      var hn = $('.rts__slider__nav .next'), hp = $('.rts__slider__nav .prev');
      if (hn) hn.addEventListener('click', function () { hero.slidePrev(); });   /* the theme's .next icon points LEFT and sits on the left */
      if (hp) hp.addEventListener('click', function () { hero.slideNext(); });   /* the .prev icon points RIGHT and sits on the right */
      barEls.forEach(function (b, k) { b.addEventListener('click', function () { if (k !== hero.realIndex) hero.slideToLoop(k); }); });
    }
    initHero();
```

What it needs / does:
- It relies on Swiper 11 (already loaded from the CDN in `index.html`). It uses Swiper's `creative` effect, which is included in the Swiper bundle.
- It adds two classes to `.banner__slider` at run time: `hero-fx` (text prepared) and `hero-go` (page loaded, play). The CSS in section 2 is built around these.
- It wraps the hero `<h1>` and `.sub__text` words in `<span>`s and wraps each hero button in `<div class="hero-btn">`.
- It builds a counter and three progress bars inside `.banner__slider` (`.hero-ui-wrap`).
- Timing values at the top of the block: `HERO_DELAY = 3000` (rest time per slide, ms) and `HERO_SPEED = 1300` (movement time, ms).
- Arrow fix: the theme's `.next` icon points LEFT and sits on the left, and `.prev` points RIGHT on the right, so the click handlers are swapped (right arrow = next slide).
- Only the visible slide's video plays, and the timer pauses when the hero is off-screen or the tab is hidden.

---

## 4. Same navbar edits in the other two pages

`about.html` and `contact.html` got the same navbar changes as section 1 (A, B, C), plus the mobile-menu link (D) in `contact.html`. In `about.html` the mobile menu is the older theme markup, where `href="/en/rooms"` was changed to `href="rooms.html"`.

## 5. Things your partner should know

- `rooms.html` reads its rooms from `api/rooms.php` (the admin feed) and falls back to the rooms written in the page if the feed is unavailable.
- The admin is at `/admin/`. The first visit creates the admin account.
- There are no changes to Bootstrap, the Swiper CDN links, `main.js`, `plugins.min.js` or `gdpr.js`.
