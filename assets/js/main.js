/* Mish Ana! landing – main.js (no dependencies) */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIG
     ------------------------------------------------------------------ */
  var PLAY_URL = 'https://play.google.com/store/apps/details?id=app.mishana.tv';

  // Hero media. Add the 9:16 cut when it exists, e.g.
  //   { ratio: '9x16', media: '(max-aspect-ratio: 4/5)', src: '/assets/video/hero-9x16-720.mp4', poster: '/assets/img/hero-poster-9x16.webp' },
  // The first entry whose `media` matches wins.
  var HERO_MEDIA = [
    { ratio: '16x9', media: '(max-width: 700px)', src: '/assets/video/hero-16x9-540.mp4' },
    { ratio: '16x9', media: 'all', src: '/assets/video/hero-16x9-720.mp4' }
  ];

  var EN = { // strings only used from JS (the rest of English is in the HTML)
    capCiv: 'Most players got this word. One of them, the Mole, got a slightly different one and isn’t told.',
    capMole: 'Psst – that’s the Mole’s word. In the game the Mole isn’t told, so they have to work it out from the clues.',
    capBlank: 'The Blank gets no word, and knows it. Time to bluff.',
    wordB: 'PASTA',
    pause: 'Pause video',
    play: 'Play video'
  };

  var doc = document, root = doc.documentElement;
  var mq = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
  var reduceMotion = mq('(prefers-reduced-motion: reduce)');
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ------------------------------------------------------------------
     PLAY LINK: pass utm_* through as Play's `referrer` (install attribution)
     ------------------------------------------------------------------ */
  var params = new URLSearchParams(location.search);
  var utm = [];
  params.forEach(function (v, k) { if (/^utm_/i.test(k) && v) utm.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); });

  function playHref(lang) {
    var u = PLAY_URL;
    if (utm.length) u += '&referrer=' + encodeURIComponent(utm.join('&'));
    if (lang && lang !== 'en') u += '&hl=' + lang;
    return u;
  }
  function updatePlayLinks(lang) {
    var h = playHref(lang);
    doc.querySelectorAll('[data-play]').forEach(function (a) { a.href = h; });
  }

  // Optional analytics hook: listen for `mishana:cta` or use window.dataLayer if you add a tag manager.
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-play], a[href*="play.mishana.workers.dev"]');
    if (!a) return;
    var type = a.hasAttribute('data-play') ? 'play_store' : 'browser';
    try { doc.dispatchEvent(new CustomEvent('mishana:cta', { detail: { type: type } })); } catch (err) {}
    if (window.dataLayer && window.dataLayer.push) window.dataLayer.push({ event: 'cta_click', cta: type });
  });

  /* ------------------------------------------------------------------
     I18N
     ------------------------------------------------------------------ */
  var LANGS = ['en', 'fr', 'ar'];
  var original = null; // English snapshot
  var current = 'en';

  function snapshot() {
    if (original) return;
    original = { t: {}, alt: {}, aria: {}, title: doc.title, desc: metaDesc().content };
    doc.querySelectorAll('[data-i18n]').forEach(function (el) { original.t[el.dataset.i18n] = el.innerHTML; });
    doc.querySelectorAll('[data-i18n-alt]').forEach(function (el) { original.alt[el.dataset.i18nAlt] = el.alt; });
  }
  function metaDesc() { return doc.querySelector('meta[name="description"]'); }

  function t(key) {
    var d = window.MISHANA_I18N && window.MISHANA_I18N[current];
    if (current !== 'en' && d && d[key] != null) return d[key];
    if (EN[key] != null) return EN[key];
    if (original && original.t[key] != null) return original.t[key];
    return '';
  }

  function applyLang(lang) {
    snapshot();
    current = lang;
    var d = lang === 'en' ? null : window.MISHANA_I18N && window.MISHANA_I18N[lang];
    if (lang !== 'en' && !d) { lang = current = 'en'; }
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    doc.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.dataset.i18n;
      var v = d && d[k] != null ? d[k] : original.t[k];
      if (v != null && el.innerHTML !== v) el.innerHTML = v;
    });
    doc.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var k = el.dataset.i18nAlt; el.alt = d && d[k] ? d[k] : original.alt[k];
    });
    doc.title = d ? d.metaTitle : original.title;
    metaDesc().content = d ? d.metaDesc : original.desc;
    doc.querySelectorAll('.lang a').forEach(function (a) {
      if (a.dataset.lang === lang) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    updatePlayLinks(lang);
    updateLangLinks();
    syncVideoLabel();
    resetDeal();
    root.classList.remove('i18n-wait');
  }

  function updateLangLinks() {
    doc.querySelectorAll('.lang a').forEach(function (a) {
      var p = new URLSearchParams(location.search); p.set('lang', a.dataset.lang);
      a.href = '?' + p.toString();
    });
  }

  function loadDict() {
    return window.__mishanaI18n || new Promise(function (res) {
      if (window.MISHANA_I18N) return res();
      var s = doc.createElement('script'); s.src = '/assets/js/i18n.js'; s.onload = s.onerror = function () { res(); };
      doc.head.appendChild(s);
    });
  }

  function setLang(lang, persist) {
    if (LANGS.indexOf(lang) < 0) lang = 'en';
    if (persist) store.set('mishana:site-lang', lang);
    if (lang === 'en') return applyLang('en');
    loadDict().then(function () { applyLang(lang); });
  }

  doc.querySelectorAll('.lang a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var lang = a.dataset.lang;
      setLang(lang, true);
      var p = new URLSearchParams(location.search); p.set('lang', lang);
      try { history.replaceState(null, '', '?' + p.toString() + location.hash); } catch (err) {}
    });
  });

  /* ------------------------------------------------------------------
     HERO VIDEO (lazy, after load; paused off-screen; honours reduced motion / data saver)
     ------------------------------------------------------------------ */
  var video = doc.querySelector('.tv__video');
  var frame = doc.querySelector('.tv');
  var toggle = doc.querySelector('.vid-toggle');
  var userPaused = false, videoReady = false, heroVisible = true;

  function pickMedia() {
    for (var i = 0; i < HERO_MEDIA.length; i++) if (mq(HERO_MEDIA[i].media)) return HERO_MEDIA[i];
    return HERO_MEDIA[HERO_MEDIA.length - 1];
  }
  function syncVideoLabel() {
    if (!toggle) return;
    var paused = !videoReady || video.paused;
    toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
    toggle.setAttribute('aria-label', t(paused ? 'play' : 'pause'));
  }
  function loadVideo(autoplay) {
    if (!video || videoReady) return;
    var m = pickMedia();
    frame.dataset.ratio = m.ratio;
    if (m.poster) { var img = frame.querySelector('.tv__poster'); img.src = m.poster; }
    video.src = m.src;
    videoReady = true;
    video.addEventListener('playing', function () { video.classList.add('is-on'); syncVideoLabel(); }, { once: true });
    video.addEventListener('pause', syncVideoLabel);
    video.addEventListener('play', syncVideoLabel);
    if (autoplay) play();
  }
  function play() { var p = video.play(); if (p && p.catch) p.catch(function () { syncVideoLabel(); }); }

  if (video) {
    var saveData = navigator.connection && navigator.connection.saveData;
    var autoplay = !reduceMotion && !saveData;
    toggle.hidden = false;
    syncVideoLabel();
    toggle.addEventListener('click', function () {
      if (!videoReady) { userPaused = false; loadVideo(true); return; }
      if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
    });
    if (autoplay) {
      var start = function () {
        (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(function () { loadVideo(heroVisible); });
      };
      if (doc.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (ents) {
        heroVisible = ents[0].isIntersecting;
        if (!videoReady) return;
        if (heroVisible && !userPaused) play(); else if (!heroVisible) video.pause();
      }, { threshold: 0.15 }).observe(frame);
    }
  }

  /* ------------------------------------------------------------------
     DEAL DEMO – mirrors the phone's hold-to-peek card (PH-04).
     The Mole's card looks exactly like everyone else's (roles aren't revealed by default);
     only the caption under the phone tells the visitor. The Blank gets the blank face and IS told.
     ------------------------------------------------------------------ */
  var deal = doc.querySelector('.deal');
  var cap = doc.getElementById('deal-cap');
  var again = doc.querySelector('.deal__again');
  var deals = 0, role = 'civ', downAt = 0, tapTimer = 0, revealed = false;
  function stripTags(s) { var d = doc.createElement('div'); d.innerHTML = s; return d.textContent; }
  function renderDeal() {
    if (!deal) return;
    snapshot();
    deal.querySelector('.deal__word').textContent = stripTags(t(role === 'mole' ? 'wordB' : 'wordA'));
    if (role === 'blank') deal.setAttribute('data-blank', ''); else deal.removeAttribute('data-blank');
    if (revealed) cap.textContent = t(role === 'civ' ? 'capCiv' : role === 'mole' ? 'capMole' : 'capBlank');
    else cap.textContent = '';
  }
  function newDeal() {
    deals++;
    // 1st deal: majority word, 2nd: the Mole's word, 3rd: Blank, then random (~1 in 4 Mole, 1 in 8 Blank)
    var r = Math.random();
    role = deals === 1 ? 'civ' : deals === 2 ? 'mole' : deals === 3 ? 'blank' : r < 0.25 ? 'mole' : r < 0.375 ? 'blank' : 'civ';
    revealed = false; hide(); renderDeal();
  }
  function show() { clearTimeout(tapTimer); deal.dataset.state = 'shown'; }
  function hide() {
    if (!deal) return;
    if (deal.dataset.state === 'shown') { revealed = true; deal.dataset.state = 'hidden'; renderDeal(); }
  }
  function resetDeal() { if (deal) renderDeal(); }
  if (deal) {
    deal.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    deal.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      downAt = Date.now(); show();
      try { deal.setPointerCapture(e.pointerId); } catch (err) {}
    });
    deal.addEventListener('pointerup', function () {
      // a quick tap shows the word for 2 s; a hold shows it while held, like the game
      if (Date.now() - downAt < 300) { clearTimeout(tapTimer); tapTimer = setTimeout(hide, 2000); } else hide();
    });
    deal.addEventListener('pointercancel', hide);
    deal.addEventListener('keydown', function (e) {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); downAt = Date.now(); show(); }
    });
    deal.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); clearTimeout(tapTimer); tapTimer = setTimeout(hide, 1500); }
    });
    deal.addEventListener('blur', function () { if (Date.now() - downAt > 300) hide(); });
    again.addEventListener('click', newDeal);
    newDeal();
  }

  /* ------------------------------------------------------------------
     STICKY MOBILE CTA (after the hero CTA leaves, hidden at the final CTA)
     ------------------------------------------------------------------ */
  var sticky = doc.getElementById('sticky');
  var heroCtas = doc.getElementById('hero-ctas');
  var finalCtas = doc.getElementById('final-ctas');
  var heroPassed = false, finalVisible = false;
  function syncSticky() {
    var on = heroPassed && !finalVisible;
    sticky.classList.toggle('on', on);
    sticky.setAttribute('aria-hidden', on ? 'false' : 'true');
    sticky.querySelector('a').tabIndex = on ? 0 : -1;
  }
  if (sticky && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (ents) {
      var e = ents[0];
      // show whenever the hero CTA is off-screen: scrolled past, or still below the fold on short screens
      heroPassed = !e.isIntersecting;
      syncSticky();
    }).observe(heroCtas);
    new IntersectionObserver(function (ents) { finalVisible = ents[0].isIntersecting; syncSticky(); }).observe(finalCtas);
  }

  /* ------------------------------------------------------------------
     REVEAL ON SCROLL
     ------------------------------------------------------------------ */
  var rv = doc.querySelectorAll('.rv, .step');
  doc.querySelectorAll('.hero .rv').forEach(function (el, i) { el.style.setProperty('--i', i); });
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rv.forEach(function (el) { io.observe(el); });
  } else {
    rv.forEach(function (el) { el.classList.add('in'); });
  }

  /* ------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------ */
  snapshot();
  updatePlayLinks('en');
  updateLangLinks();
  var initial = root.getAttribute('data-lang-init') || 'en';
  if (initial !== 'en') setLang(initial, false);
})();
