/* Mish Ana! guide pages – page.js (no dependencies, ~1 KB).
   Same cookieless measurement as main.js (see CRO-AUDIT.md §4): a page view and CTA clicks, sent to /e.
   Angle "guide" + p=<page slug> tell guide traffic apart. Skipped with GPC / Do Not Track and on localhost. */
(function () {
  'use strict';
  var EVENT_URL = '/e';
  var CF_BEACON_TOKEN = '{{CF_BEACON_TOKEN}}';
  var d = document, nav = navigator, ua = nav.userAgent || '';
  var optOut = nav.globalPrivacyControl === true || nav.doNotTrack === '1' || window.doNotTrack === '1';
  var local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
  var on = !!EVENT_URL && !optOut && !local;
  var q = new URLSearchParams(location.search);
  var dev = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : /Mobi/.test(ua) ? 'mobile' : 'desktop';
  var page = (d.body.getAttribute('data-page') || '').slice(0, 24);

  function track(e, x) {
    if (!on) return;
    var b = { e: e, a: 'guide', l: d.documentElement.lang, d: dev, p: page, s: q.get('utm_source') || '', c: q.get('utm_campaign') || '', k: q.get('utm_content') || '' };
    for (var k in x) b[k] = x[k];
    var j = JSON.stringify(b);
    try {
      if (nav.sendBeacon && nav.sendBeacon(EVENT_URL, new Blob([j], { type: 'text/plain' }))) return;
      fetch(EVENT_URL, { method: 'POST', body: j, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } });
    } catch (err) {}
  }

  d.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a');
    if (!a) return;
    if (a.hasAttribute('data-lang')) { try { localStorage.setItem('mishana:site-lang', a.getAttribute('data-lang')); } catch (err) {} return; }
    if (a.hasAttribute('data-play')) track('cta', { t: 'play_store' });
    else if (/play\.mishana\.workers\.dev/.test(a.href)) track('cta', { t: 'browser' });
  });
  d.querySelectorAll('details').forEach(function (el, i) {
    el.addEventListener('toggle', function () { if (el.open) track('faq', { p: page.slice(0, 20) + ':' + (i + 1) }); });
  });

  track('view');
  window.addEventListener('load', function () {
    if (optOut || local || !/^[0-9a-f]{32}$/i.test(CF_BEACON_TOKEN)) return;
    var s = d.createElement('script');
    s.defer = true; s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_BEACON_TOKEN }));
    d.body.appendChild(s);
  }, { once: true });
})();
