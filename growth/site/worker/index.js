// Mish Ana! site Worker. Serves the static site (env.ASSETS) and one tiny endpoint:
//   POST /e  – cookieless page events from /assets/js/main.js, written to Workers Analytics Engine.
// No cookies are read or set, nothing identifies a visitor, and the IP address is never stored.
// Only /e reaches this code ("run_worker_first" in wrangler.jsonc); every other path is a static asset.

const EVENTS = new Set(['view', 'cta', 'faq', 'depth', 'lang', 'reel', 'share', 'demo', 'share_opened', 'link_copied', 'email_link', 'open_here']);
const MAX_BODY = 1024;

// Short, safe strings only (slugs, codes): no free text reaches the dataset.
const clean = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n).replace(/[^A-Za-z0-9_.:-]/g, '') : '');

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/e') return env.ASSETS.fetch(request);

    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return new Response(null, { status: 403 });

    let d;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY) throw new Error('too large');
      d = JSON.parse(text);
    } catch {
      return new Response(null, { status: 400 });
    }
    const event = clean(d.e, 16);
    if (!EVENTS.has(event)) return new Response(null, { status: 400 });

    if (env.EVENTS) {
      env.EVENTS.writeDataPoint({
        indexes: [event],
        blobs: [
          event,                 // blob1  event
          clean(d.t, 16),        // blob2  type (play_store | browser)
          clean(d.p, 24),        // blob3  position / detail (hero, sticky, final, faq id, 50 …)
          clean(d.a, 16),        // blob4  ad angle (reveal, passphone, … default)
          clean(d.l, 4),         // blob5  page language
          clean(d.d, 8),         // blob6  device class (android | ios | desktop | mobile)
          clean(d.s, 24),        // blob7  utm_source
          clean(d.c, 48),        // blob8  utm_campaign
          clean(d.k, 48),        // blob9  utm_content
          clean(request.cf && request.cf.country, 2) // blob10 country (from Cloudflare, coarse)
        ],
        doubles: [1]
      });
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
};
