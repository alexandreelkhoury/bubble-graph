/* Mish Ana! landing – main.js (no dependencies) */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIG
     ------------------------------------------------------------------ */
  var PLAY_URL = 'https://play.google.com/store/apps/details?id=app.mishana.tv';

  // Cloudflare Web Analytics (cookieless). Paste the site token from
  // Cloudflare dashboard → Analytics & Logs → Web Analytics → Add a site → "JS snippet" (the 32-hex "token").
  // While this still holds the placeholder, the beacon is not loaded.
  var CF_BEACON_TOKEN = '{{CF_BEACON_TOKEN}}';

  // Cookieless click/scroll events, POSTed with sendBeacon to the site Worker (worker/index.js),
  // which writes them to Workers Analytics Engine. Set to '' to switch custom events off.
  var EVENT_URL = '/e';

  // Hero media. build.mjs writes the files it picked on the .tv frame (data-src / data-src-sm): the caption-free
  // loop when it exists (then data-caps: HTML captions in the page language, see CAPTIONS), else the captioned one.
  // To add a 9:16 cut, put an entry first, e.g.
  //   { ratio: '9x16', media: '(max-aspect-ratio: 4/5)', src: '/assets/video/hero-9x16-720.mp4', poster: '/assets/img/hero-poster-9x16.webp' },
  // The first entry whose `media` matches wins.
  var tvEl = document.querySelector('.tv');
  var HERO_MEDIA = [
    { ratio: '16x9', media: '(max-width: 700px)', src: (tvEl && tvEl.getAttribute('data-src-sm')) || '/assets/video/hero-16x9-540.mp4' },
    { ratio: '16x9', media: 'all', src: (tvEl && tvEl.getAttribute('data-src')) || '/assets/video/hero-16x9-720.mp4' }
  ];

  // Captions of the hero loop (caption-free render): build.mjs copies the cues of assets/video/hero-clean.json into
  // data-caps: [{ k: i18n key, s: [[from, to], …] in loop seconds, hot: 'm' = magenta box, sub: 1 = the small amber line }].
  var CAPTIONS = [];
  try { CAPTIONS = JSON.parse((tvEl && tvEl.getAttribute('data-caps')) || '[]'); } catch (e) {}

  var EN = { // strings only used from JS (the rest of English is in the HTML)
    capCiv: 'Most players got this word. One of them, the Mole, got a slightly different one and isn’t told.',
    capMole: 'Psst – that’s the Mole’s word. In the game the Mole isn’t told, so they have to work it out from the clues.',
    capBlank: 'The Blank gets no word, and knows it. Time to bluff.',
    wordB: 'PASTA',
    pause: 'Pause video',
    play: 'Play video',
    reelPause: 'Pause the animation',
    reelPlay: 'Play the animation',
    shareTitle: 'Mish Ana! – play in your browser',
    shareText: 'Open this on a laptop connected to the TV:',
    copied: 'Link copied. Open it on your laptop.',
    sendTitle: 'Mish Ana! – play it on the big screen',
    sendText: 'Open this link on a laptop or TV browser, put it on the big screen, and everyone scans the QR code with their phone.',
    sheetTitle: 'Play it on the big screen',
    sheetBody: 'Mish Ana! is played on a big screen. Open this link there; phones join by scanning the QR code.',
    sheetStep1: 'On your laptop or TV browser, type:',
    sheetStep2: 'Then scan the QR code on the screen with this phone.',
    tapToCopy: 'Tap to copy',
    waLink: 'WhatsApp it to me',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    emailLink: 'Email it to me',
    moreShare: 'More…',
    emailSubject: 'Mish Ana! – open this on your laptop or TV',
    openHere: 'Just looking? Open the game here',
    closeSheet: 'Close',
    cap_opening: 'Your TV. Everyone’s phone. <b>One liar.</b>',
    cap_friends: 'Friends join from their phones. <b>No app.</b>',
    cap_secret: 'Everyone gets a <b>secret word…</b>',
    cap_different: '…but one is <b>different.</b>',
    cap_clues: 'Give one-word <b>clues.</b>',
    cap_fit: 'Spot who doesn’t <b>fit.</b>',
    cap_out: 'Vote them <b>out.</b>',
    cap_mole: 'Caught the <b>Mole!</b>',
    cap_moleWord: 'Sami was the Mole'
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
  // Browser-version links (marked data-browser by build.mjs) keep the visitor's utm_* parameters too.
  function updateBrowserLinks() {
    if (!utm.length) return;
    doc.querySelectorAll('a[data-browser]').forEach(function (a) {
      var base = a.getAttribute('href').split('?')[0];
      a.href = base + '?' + utm.join('&');
    });
  }

  /* ------------------------------------------------------------------
     MEASUREMENT – cookieless, no identifiers, no storage.
     Skipped entirely with Global Privacy Control or Do Not Track, and on localhost.
     ------------------------------------------------------------------ */
  var angle = window.__mishanaAngle || 'default';
  var device = window.__mishanaDevice || 'other';
  var optOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  var isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
  var trackOn = !!EVENT_URL && !optOut && !isLocal;

  function track(event, props) {
    if (!trackOn) return;
    var body = { e: event, a: angle, l: current, d: device, s: params.get('utm_source') || '', c: params.get('utm_campaign') || '', k: params.get('utm_content') || '' };
    if (props) for (var k in props) body[k] = props[k];
    var json = JSON.stringify(body);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(EVENT_URL, new Blob([json], { type: 'text/plain' }))) return;
      fetch(EVENT_URL, { method: 'POST', body: json, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } });
    } catch (err) {}
  }

  function loadBeacon() {
    if (optOut || isLocal || !/^[0-9a-f]{32}$/i.test(CF_BEACON_TOKEN)) return;
    var s = doc.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_BEACON_TOKEN }));
    doc.body.appendChild(s);
  }

  // CTA clicks: data-play = Google Play, otherwise the browser version. data-cta = position on the page.
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-play], a[href*="play.mishana.workers.dev"]');
    if (!a) return;
    if ((a.hasAttribute('data-send') && sendMode()) || a.closest('.send-sheet')) return; // phones: tracked by the send-link flow below
    var type = a.hasAttribute('data-play') ? 'play_store' : 'browser';
    var pos = a.getAttribute('data-cta') || 'other';
    track('cta', { t: type, p: pos });
    try { doc.dispatchEvent(new CustomEvent('mishana:cta', { detail: { type: type, position: pos, angle: angle } })); } catch (err) {}
    if (window.dataLayer && window.dataLayer.push) window.dataLayer.push({ event: 'cta_click', cta: type, position: pos, angle: angle });
  });

  // FAQ opens (which objections people check)
  doc.querySelectorAll('.qa details').forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) track('faq', { p: d.getAttribute('data-q') || '' }); });
  });

  // Scroll depth, once per threshold
  var depthSent = {};
  function onScroll() {
    var h = doc.documentElement.scrollHeight - window.innerHeight;
    if (h <= 0) return;
    var pct = (window.scrollY / h) * 100;
    [25, 50, 75, 100].forEach(function (t) {
      if (pct >= t - 1 && !depthSent[t]) { depthSent[t] = 1; track('depth', { p: String(t) }); }
    });
  }
  if (trackOn) window.addEventListener('scroll', function () { (window.requestIdleCallback || setTimeout)(onScroll); }, { passive: true });

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
    doc.title = (d && d.metaTitle) || original.title;
    metaDesc().content = (d && d.metaDesc) || original.desc;
    doc.querySelectorAll('.lang a').forEach(function (a) {
      if (a.dataset.lang === lang) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    updatePlayLinks(lang);
    updateBrowserLinks();
    updateLangLinks();
    syncVideoLabel();
    if (typeof syncCaps === 'function') syncCaps(true);
    resetDeal();
    syncReel();
    root.classList.remove('i18n-wait');
  }

  // Each language has its own URL (/, /fr/, /ar/, pre-rendered by build.mjs). Keep ad params (utm_*, angle) when switching.
  function updateLangLinks() {
    doc.querySelectorAll('.lang a').forEach(function (a) {
      if (!a.dataset.path) a.dataset.path = (a.getAttribute('href') || '/').split('?')[0];
      var p = new URLSearchParams(location.search); p.delete('lang');
      var q = p.toString();
      a.href = a.dataset.path + (q ? '?' + q : '');
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

  // Switching language = following the link to that language's page; remember the choice for next visits to "/".
  doc.querySelectorAll('.lang a').forEach(function (a) {
    a.addEventListener('click', function () {
      store.set('mishana:site-lang', a.dataset.lang);
      track('lang', { p: a.dataset.lang });
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

  // HTML captions over the caption-free loop (one video for every language). Driven by the video clock, so they
  // follow pauses and loops; before the video plays, the first cue sits on the poster (it is the loop's first frame).
  var capEl = frame && CAPTIONS.length ? frame.querySelector('.tv__cap') : null;
  var subEl = frame && CAPTIONS.length ? frame.querySelector('.tv__sub') : null;
  var capKey = '', subKey = '', capRaf = 0;
  function cuesAt(t) {
    var main = null, sub = null;
    for (var i = 0; i < CAPTIONS.length; i++) for (var j = 0; j < CAPTIONS[i].s.length; j++) {
      var g = CAPTIONS[i].s[j];
      if (t >= g[0] && t < g[1]) { if (CAPTIONS[i].sub) sub = CAPTIONS[i]; else main = CAPTIONS[i]; }
    }
    return [main, sub];
  }
  function showCue(el, cue, prev, force) {
    var k = cue ? cue.k : '';
    if (k === prev && !force) return prev;
    if (!cue) { el.classList.remove('is-on'); return k; }
    el.innerHTML = t(k);
    el.setAttribute('data-hot', cue.hot || 'a');
    el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
    return k;
  }
  function renderCap(cues, force) {
    if (!capEl) return;
    capKey = showCue(capEl, cues[0], capKey, force);
    if (subEl) subKey = showCue(subEl, cues[1], subKey, force);
  }
  function capTick() {
    capRaf = 0;
    if (!videoReady || video.paused) return;
    renderCap(cuesAt(video.currentTime));
    capRaf = requestAnimationFrame(capTick);
  }
  function syncCaps(force) {
    if (!capEl) return;
    capEl.hidden = false; if (subEl) subEl.hidden = false;
    renderCap(cuesAt(videoReady ? video.currentTime : 0), force);
    if (!capRaf && videoReady && !video.paused) capRaf = requestAnimationFrame(capTick);
  }
  if (capEl && video) {
    video.addEventListener('play', function () { syncCaps(); });
    video.addEventListener('seeked', function () { syncCaps(); });
  }

  var saveData = navigator.connection && navigator.connection.saveData;
  if (video) {
    var autoplay = !reduceMotion && !saveData;
    toggle.hidden = false;
    syncVideoLabel();
    syncCaps();
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
     REEL – "a round in 15 seconds": 4 beats × 3.75 s.
     The progress bar's CSS animation is the clock (pausable); animationend advances.
     Plays only while on screen; pause button (WCAG 2.2.2); reduced motion = static, tap to step.
     ------------------------------------------------------------------ */
  var reel = doc.getElementById('reel');
  var reelBtns = reel ? reel.querySelectorAll('.reel__steps button') : [];
  var scenes = reel ? reel.querySelectorAll('.sc') : [];
  var reelCap = reel && reel.querySelector('.reel__cap');
  var reelPauseBtn = reel && reel.querySelector('.reel__pause');
  var reelStep = 0, reelUserPaused = false, reelVisible = false, reelLoops = 0, liveTimer = 0;

  function setReelStep(i) {
    reelStep = (i + 4) % 4;
    reel.setAttribute('data-step', String(reelStep));
    reelBtns.forEach(function (b, n) {
      if (n === reelStep) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.parentNode.classList.toggle('done', n < reelStep);
      // restart the progress animation on the current button
      var bar = b.querySelector('.reel__prog i'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    });
    var next = scenes[reelStep];
    next.classList.add('is-live');
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { scenes.forEach(function (s, n) { if (n !== reelStep) s.classList.remove('is-live'); }); }, 420);
    syncReelCap();
  }
  function syncReelCap() {
    if (!reelCap) return;
    var txt = reelBtns[reelStep] && reelBtns[reelStep].querySelector('.reel__txt');
    reelCap.textContent = txt ? txt.textContent : '';
  }
  function syncReelPlay() {
    var on = !reduceMotion && reelVisible && !reelUserPaused;
    reel.classList.toggle('is-playing', on);
  }
  function syncReel() {
    if (!reel) return;
    syncReelCap();
    reelPauseBtn.setAttribute('aria-label', t(reelUserPaused ? 'reelPlay' : 'reelPause'));
  }
  if (reel) {
    if (reduceMotion) reel.classList.add('is-static');
    setReelStep(0);
    reelBtns.forEach(function (b, n) {
      b.addEventListener('click', function () { setReelStep(n); track('reel', { p: 'tap' + (n + 1) }); });
    });
    reel.addEventListener('animationend', function (e) {
      if (reduceMotion || e.animationName.indexOf('prog') !== 0) return;
      if (reelStep === 3) { reelLoops++; if (reelLoops === 1) track('reel', { p: 'complete' }); }
      setReelStep(reelStep + 1);
    });
    reelPauseBtn.addEventListener('click', function () {
      reelUserPaused = !reelUserPaused; syncReelPlay(); syncReel();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (ents) { reelVisible = ents[0].isIntersecting; syncReelPlay(); }, { threshold: 0.35 }).observe(reel.querySelector('.reel__stage'));
    } else { reelVisible = true; syncReelPlay(); }
    syncReel();
  }

  /* ------------------------------------------------------------------
     SHARE / COPY the browser-version link (phone visitors aren't at their laptop)
     ------------------------------------------------------------------ */
  doc.querySelectorAll('[data-share]').forEach(function (btn) {
    if (device === 'desktop') { btn.hidden = true; return; }
    var done = btn.parentNode.querySelector('.share__done');
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-share');
      track('share', { p: 'notv' });
      if (navigator.share) {
        navigator.share({ title: t('shareTitle'), text: t('shareText'), url: url }).catch(function () {});
        return;
      }
      var ok = function () { if (done) done.textContent = t('copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { location.href = url; });
      else location.href = url;
    });
  });

  /* ------------------------------------------------------------------
     SEND THE LINK (pre-launch, phones). Buttons marked data-send (hero, sticky, final; build.mjs adds them while
     playStoreLive is false) open the browser game on a laptop/desktop as usual. On phones the game needs a big screen,
     so the button shares the link (native share sheet) or opens a small sheet: copy / email it to me / open here anyway.
     The label switch is pure CSS (same media query), so nothing moves on load.
     ------------------------------------------------------------------ */
  var SEND_MQ = '(pointer: coarse), (max-width: 700px)';
  function sendMode() { return mq(SEND_MQ); }
  function sendUrl(a) {
    var p = new URLSearchParams();
    params.forEach(function (v, k) { if (/^utm_/i.test(k) && v) p.set(k, v); });
    p.set('utm_content', 'share');
    return a.getAttribute('href').split('?')[0] + '?' + p.toString();
  }
  var sheet = null, sheetUrl = '', sheetPos = '';
  // Our own sheet first (the OS share sheet is unreliable in TikTok/IG webviews and gives no instructions):
  // 1. the short URL to type on the laptop / TV browser that is usually already in the room (tap to copy),
  //    WhatsApp-to-myself first, then copy / email / the OS share sheet; 2. "then scan the QR code with this phone".
  var ICON_WA = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8.9 7.9c.3-.6.6-.6.9-.6h.6c.2 0 .4.1.6.5l.8 1.8c.1.3 0 .5-.1.7l-.5.6c-.2.2-.2.4 0 .7.4.7 1.6 2.1 3 2.6.3.1.5.1.7-.1l.7-.8c.2-.3.4-.3.7-.2l1.7.8c.3.2.4.3.4.6 0 .5-.2 1.4-1 1.9-.8.5-2 .6-3.6-.1-2.3-1-3.8-3-4.2-3.7-.5-.8-1-2.3-.5-3.4z" fill="currentColor"/></svg>';
  function sheetEl() {
    if (sheet) return sheet;
    sheet = doc.createElement('dialog');
    sheet.className = 'send-sheet';
    sheet.setAttribute('aria-labelledby', 'send-title');
    sheet.innerHTML = '<form method="dialog" class="send-sheet__x"><button type="submit" data-k="closeSheet" aria-label=""><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></form>' +
      '<h2 id="send-title"></h2>' +
      '<p class="send-sheet__step"><span class="g__n" aria-hidden="true">1</span><span class="send-sheet__s1"></span></p>' +
      '<button type="button" class="send-sheet__url" data-act="copy" dir="ltr"><span class="send-sheet__u"></span><small class="send-sheet__tap"></small></button>' +
      '<div class="send-sheet__btns"><a class="btn btn--play btn--lg" data-act="wa" href="#" rel="noopener"></a>' +
      '<div class="send-sheet__row"><button type="button" class="btn btn--ghost" data-act="copy2"></button><a class="btn btn--ghost" data-act="email" href="#"></a><button type="button" class="btn btn--ghost" data-act="more" hidden></button></div></div>' +
      '<p class="micro send-sheet__done" role="status" aria-live="polite"></p>' +
      '<p class="send-sheet__step send-sheet__step--2"><span class="g__n" aria-hidden="true">2</span><span class="send-sheet__s2"></span></p>' +
      '<a class="send-sheet__open" data-act="open" href="#"></a>';
    doc.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) { sheet.close ? sheet.close() : sheet.removeAttribute('open'); return; } // tap on the backdrop
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'copy' || act === 'copy2') {
        e.preventDefault();
        var done = function () { sheet.querySelector('.send-sheet__done').textContent = t('linkCopied'); track('link_copied', { p: sheetPos }); };
        var legacy = function () { // older browsers / non-secure contexts
          var ta = doc.createElement('textarea'); ta.value = sheetUrl; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0';
          sheet.appendChild(ta); ta.select(); var ok = false; try { ok = doc.execCommand('copy'); } catch (err) {}
          ta.remove(); if (ok) done(); else selectUrl();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(sheetUrl).then(done, legacy);
        else legacy();
      } else if (act === 'wa') track('wa_link', { p: sheetPos });
      else if (act === 'email') track('email_link', { p: sheetPos });
      else if (act === 'more') {
        e.preventDefault();
        track('share_more', { p: sheetPos });
        navigator.share({ title: t('sendTitle'), text: t('sendText'), url: sheetUrl }).catch(function () {});
      } else if (act === 'open') track('open_here', { p: sheetPos });
    });
    return sheet;
  }
  function selectUrl() { // last resort for copy: select the URL text so the phone's own Copy menu appears
    var u = sheet.querySelector('.send-sheet__u'), r = doc.createRange(); r.selectNodeContents(u);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function openSheet(url, pos) {
    var s = sheetEl(); sheetUrl = url; sheetPos = pos;
    var msg = t('sendText') + '\n' + url;
    s.querySelector('h2').textContent = t('sheetTitle');
    s.querySelector('.send-sheet__s1').textContent = t('sheetStep1');
    s.querySelector('.send-sheet__u').textContent = url.replace(/^https?:\/\//, '').split('?')[0];
    s.querySelector('.send-sheet__tap').textContent = t('tapToCopy');
    s.querySelector('.send-sheet__s2').textContent = t('sheetStep2');
    var wa = s.querySelector('[data-act="wa"]');
    wa.innerHTML = ICON_WA + '<span></span>'; wa.lastChild.textContent = t('waLink');
    wa.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    s.querySelector('[data-act="copy2"]').textContent = t('copyLink');
    var em = s.querySelector('[data-act="email"]');
    em.textContent = t('emailLink');
    em.href = 'mailto:?subject=' + encodeURIComponent(t('emailSubject')) + '&body=' + encodeURIComponent(t('sendText') + '\n\n' + url);
    var more = s.querySelector('[data-act="more"]');
    more.textContent = t('moreShare');
    more.hidden = !(navigator.share && (!navigator.canShare || navigator.canShare({ url: url })));
    var op = s.querySelector('[data-act="open"]'); op.textContent = t('openHere'); op.href = url;
    s.querySelector('[data-k="closeSheet"]').setAttribute('aria-label', t('closeSheet'));
    s.querySelector('.send-sheet__done').textContent = '';
    if (s.showModal) { if (!s.open) s.showModal(); } else s.setAttribute('open', '');
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-send]');
    if (!a || !sendMode()) return;
    e.preventDefault();
    var url = sendUrl(a), pos = a.getAttribute('data-cta') || 'other';
    track('share_opened', { p: pos, t: 'sheet' });
    openSheet(url, pos);
  });

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
      if (deals === 1 && !deal.dataset.tracked) { deal.dataset.tracked = '1'; track('demo', { p: 'peek' }); }
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
    doc.querySelectorAll('.deal__as').forEach(function (b) {
      b.addEventListener('click', function () {
        deals = Math.max(deals, 3); role = b.getAttribute('data-role'); revealed = false; hide(); renderDeal();
        track('demo', { p: role });
        deal.focus({ preventScroll: true });
      });
    });
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
  // Content is visible by default. An element is only hidden ("armed") after IntersectionObserver has reported it
  // off-screen, so it can rise in when it scrolls into view. If IO has not reported anything after 1.5 s (webviews
  // where it stalls), everything is revealed, so a section is never left blank.
  var rv = doc.querySelectorAll('.rv');
  function revealAll() { rv.forEach(function (el) { el.classList.add('in'); }); }
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var ioFired = false;
    var io = new IntersectionObserver(function (ents) {
      ioFired = true;
      ents.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        else if (!e.target.classList.contains('in')) e.target.classList.add('rv-armed');
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rv.forEach(function (el) { io.observe(el); });
    setTimeout(function () { if (!ioFired) { io.disconnect(); revealAll(); } }, 1500);
  } else {
    revealAll();
  }

  /* ------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------ */
  snapshot();
  updatePlayLinks('en');
  updateBrowserLinks();
  updateLangLinks();
  var initial = root.getAttribute('data-lang-init') || 'en';
  if (initial !== 'en') { current = initial; setLang(initial, false); }
  track('view', { p: location.hash ? location.hash.slice(1, 20) : '' });
  if (doc.readyState === 'complete') loadBeacon(); else window.addEventListener('load', loadBeacon, { once: true });
})();
