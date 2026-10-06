#!/usr/bin/env node
/*
  Mish Ana! site build – no dependencies.  Run:  node build.mjs   (Node 18+)

  Sources (edit these)                       Output (deploy this): dist/
  ─────────────────────────────────────────  ──────────────────────────────────────────────
  site.config.json   origin + switches       /index.html, /fr/index.html, /ar/index.html
  index.html         home template (EN copy) /<slug>/index.html, /fr/<slug>/…, /ar/<slug>/…
  assets/js/i18n.js  FR + AR home copy       /guides/, /privacy/, /404.html
  content/home.json  per-language SEO meta   /sitemap.xml, /robots.txt, /llms.txt, /llms-full.txt
  content/<lang>/*.html  guide pages         /assets/**, icons, manifest, _headers

  The origin is injected everywhere (canonical, hreflang, sitemap, OG/Twitter, JSON-LD, robots, llms).
  Changing the domain = edit "origin" in site.config.json, run `node build.mjs`, deploy.
  The build fails loudly on: invalid JSON-LD, a leftover {{SITE_URL}}, or a broken internal link.
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const cfg = JSON.parse(rd('site.config.json'));
const ORIGIN = String(cfg.origin || '').replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+$/i.test(ORIGIN)) throw new Error(`site.config.json: "origin" must look like https://www.example.com (got ${cfg.origin})`);
const OUT = path.join(ROOT, cfg.outDir || 'dist');
const LIVE = !!cfg.playStoreLive;
const PLAY = cfg.playUrl;
const BROWSER = cfg.browserUrl;
const BROWSER_SHORT = BROWSER.replace(/^https?:\/\//, '');
const LANGS = ['en', 'fr', 'ar'];
const HOME = { en: '/', fr: '/fr/', ar: '/ar/' };
const OG_LOCALE = { en: 'en_US', fr: 'fr_FR', ar: 'ar_LB' };
const abs = (p) => ORIGIN + p;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (s) => String(s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const dateFmt = (d, lang) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB-u-nu-latn' : lang === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z'));

/* ------------------------------------------------------------------ shared facts (one definition, reused everywhere) */
const home = JSON.parse(rd('content/home.json'));
const DEF = home.definition; // { en, fr, ar } one-sentence product definition
const GAME_ID = abs('/#game');
const ORG_ID = abs('/#org');
const SITE_ID = abs('/#website');

/* UI chrome for generated pages */
const UI = {
  en: { skip: 'Skip to content', home: 'Home', guides: 'Guides', updated: 'Last updated', faq: 'Frequently asked questions', more: 'More guides',
        langNav: 'Language', crumbs: 'Breadcrumb', footer: 'Footer', privacy: 'Privacy', contact: 'Contact', about: 'About', footTag: 'Mish Ana! – The secret-word party game',
        tm: 'Android TV, Google TV, Google Play and Chromecast are trademarks of Google LLC.',
        ctaTitle: 'Play Mish Ana! tonight', ctaInstall: 'Install on my TV', ctaInstallSub: 'Free to play · via Google Play', ctaBrowser: 'Play in your browser', ctaBrowserSub: 'Free · works on any TV with a laptop',
        ctaBodyLive: 'Install it on your Android TV or Google TV from your phone, or open the free browser version on a laptop connected to the TV. Phones join by scanning a QR code.',
        ctaBodySoon: 'The Android TV and Google TV app is coming to Google Play. You can play the full game today, free, in a browser: open it on a laptop connected to the TV and everyone joins by scanning the QR code with their phone.',
        navCta: LIVE ? 'Install on my TV' : 'Play free', aboutBox: 'About Mish Ana!', readIn: 'Also in' },
  fr: { skip: 'Aller au contenu', home: 'Accueil', guides: 'Guides', updated: 'Mis à jour le', faq: 'Questions fréquentes', more: 'À lire aussi',
        langNav: 'Langue', crumbs: 'Fil d’Ariane', footer: 'Pied de page', privacy: 'Confidentialité', contact: 'Contact', about: 'À propos', footTag: 'Mish Ana! – Le jeu d’ambiance du mot secret',
        tm: 'Android TV, Google TV, Google Play et Chromecast sont des marques de Google LLC.',
        ctaTitle: 'Jouez à Mish Ana! ce soir', ctaInstall: 'Installer sur ma télé', ctaInstallSub: 'Jeu gratuit · via Google Play', ctaBrowser: 'Jouer dans le navigateur', ctaBrowserSub: 'Gratuit · sur n’importe quelle télé avec un ordi',
        ctaBodyLive: 'Installe-le sur ton Android TV ou Google TV depuis ton téléphone, ou ouvre la version navigateur gratuite sur un ordinateur branché à la télé. Les téléphones rejoignent la partie en scannant un QR code.',
        ctaBodySoon: 'L’application Android TV et Google TV arrive bientôt sur Google Play. Le jeu complet est déjà jouable gratuitement dans un navigateur : ouvre-le sur un ordinateur branché à la télé, et chacun rejoint la partie en scannant le QR code avec son téléphone.',
        navCta: LIVE ? 'Installer' : 'Jouer', aboutBox: 'À propos de Mish Ana!', readIn: 'Aussi en' },
  ar: { skip: 'روح عالمحتوى', home: 'الرئيسية', guides: 'أدلّة', updated: 'آخر تحديث', faq: 'أسئلة متكرّرة', more: 'اقرأ كمان',
        langNav: 'اللغة', crumbs: 'مسار التنقّل', footer: 'تذييل الصفحة', privacy: 'الخصوصية', contact: 'تواصل معنا', about: 'عن اللعبة', footTag: 'مش أنا! – لعبة الكلمة السرّية للسهرات',
        tm: 'Android TV و Google TV و Google Play و Chromecast علامات تجارية تابعة لـ Google LLC.',
        ctaTitle: 'العبوا «مش أنا!» الليلة', ctaInstall: 'نزّلها عتلفزيوني', ctaInstallSub: 'اللعب ببلاش · عبر Google Play', ctaBrowser: 'العب بالمتصفّح', ctaBrowserSub: 'ببلاش · على أي تلفزيون مع لابتوب',
        ctaBodyLive: 'نزّلها على Android TV أو Google TV من تلفونك، أو افتح نسخة المتصفّح المجانية على لابتوب موصول بالتلفزيون. التلفونات بتفوت بمسح كود QR.',
        ctaBodySoon: 'تطبيق Android TV و Google TV جايي قريبًا على Google Play. بس فيكن تلعبوا اللعبة كاملة هلّق ببلاش بالمتصفّح: افتحوها على لابتوب موصول بالتلفزيون، وكل واحد بيفوت بمسح كود QR بتلفونو.',
        navCta: LIVE ? 'نزّلها' : 'العب', aboutBox: 'عن «مش أنا!»', readIn: 'كمان بـ' }
};
const LANG_LABEL = { en: 'EN', fr: 'FR', ar: 'عربي' };
const LANG_NAME = { en: 'English', fr: 'Français', ar: 'العربية' };

/* ------------------------------------------------------------------ helpers */
function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function write(rel, data) { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); }
function copy(rel) {
  const src = path.join(ROOT, rel), dst = path.join(OUT, rel);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dst, { recursive: true, filter: (s) => !/\.(md|raw\.mp4)$/.test(s) && !s.endsWith('.DS_Store') });
}
function fillPlaceholders(s) {
  s = s.split('{{SITE_URL}}').join(ORIGIN).split('{{BROWSER_URL}}').join(BROWSER).split('{{BROWSER_SHORT}}').join(BROWSER_SHORT);
  if (cfg.contactEmail) s = s.split('{{CONTACT_EMAIL}}').join(cfg.contactEmail);
  if (cfg.ownerName) s = s.split('{{OWNER_NAME}}').join(cfg.ownerName);
  if (cfg.cfBeaconToken) s = s.split('{{CF_BEACON_TOKEN}}').join(cfg.cfBeaconToken);
  return s;
}
const ld = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj).replace(/</g, '\\u003c')}\n</script>`;

/* Replace the inner HTML of every element carrying data-i18n="key" (balanced-tag scan, no DOM needed). */
function replaceI18n(html, dict) {
  const open = /<([a-zA-Z][\w-]*)\b[^>]*?\sdata-i18n="([^"]+)"[^>]*>/g;
  let out = '', last = 0, m;
  while ((m = open.exec(html))) {
    if (m.index < last) continue;
    const tag = m[1].toLowerCase(), key = m[2], start = m.index + m[0].length;
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi'); re.lastIndex = start;
    let depth = 1, t, end = -1;
    while ((t = re.exec(html))) { if (t[0].endsWith('/>')) continue; depth += t[1] ? -1 : 1; if (!depth) { end = t.index; break; } }
    if (end < 0) throw new Error(`Unbalanced <${tag} data-i18n="${key}">`);
    out += html.slice(last, start) + (dict[key] != null ? dict[key] : html.slice(start, end));
    last = end; open.lastIndex = end;
  }
  html = out + html.slice(last);
  html = html.replace(/(<[^>]*?\salt=")([^"]*)("[^>]*?\sdata-i18n-alt="([^"]+)")/g, (s, a, v, b, k) => (dict[k] != null ? a + esc(dict[k]) + b : s));
  html = html.replace(/(<[^>]*?\saria-label=")([^"]*)("[^>]*?\sdata-i18n-aria="([^"]+)")/g, (s, a, v, b, k) => (dict[k] != null ? a + esc(dict[k]) + b : s));
  return html;
}

/* ------------------------------------------------------------------ guides (content/<lang>/*.html) */
function loadArticles() {
  const list = [];
  for (const lang of LANGS) {
    const dir = path.join(ROOT, 'content', lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
      // <!--LIVE-->shown when playStoreLive is true<!--SOON-->shown before the Play launch<!--/LIVE-->
      const raw = fs.readFileSync(path.join(dir, f), 'utf8').replace(/<!--LIVE-->([\s\S]*?)<!--SOON-->([\s\S]*?)<!--\/LIVE-->/g, (s, live, soon) => (LIVE ? live : soon))
        // URL tokens are filled here, once, so the body, the <faq> answers, their FAQPage JSON-LD and llms-full.txt all get them
        .replace(/\{\{BROWSER_URL\}\}/g, BROWSER).replace(/\{\{BROWSER_SHORT\}\}/g, BROWSER_SHORT).replace(/\{\{PLAY_URL\}\}/g, PLAY);
      const fm = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
      if (!fm) throw new Error(`content/${lang}/${f}: missing <!--{ front matter }--> block`);
      let meta; try { meta = JSON.parse(fm[1]); } catch (e) { throw new Error(`content/${lang}/${f}: bad front matter JSON: ${e.message}`); }
      let body = raw.slice(fm[0].length).trim();
      const faq = [];
      body = body.replace(/<faq>([\s\S]*?)<\/faq>/, (s, inner) => {
        inner.replace(/<faq-q>([\s\S]*?)<\/faq-q>\s*<faq-a>([\s\S]*?)<\/faq-a>/g, (x, q, a) => { faq.push({ q: q.trim(), a: a.trim() }); return ''; });
        return '<!--FAQ-->';
      });
      const slug = f.replace(/\.html$/, '');
      const urlPath = (lang === 'en' ? '/' : `/${lang}/`) + slug + '/';
      const answer = (body.match(/<div class="answer">([\s\S]*?)<\/div>/) || [])[1] || '';
      list.push({ ...meta, lang, slug, path: urlPath, body, faq, answer, type: meta.type || 'Article' });
    }
  }
  return list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
const articles = loadArticles();
const byGroup = {};
for (const a of articles) (byGroup[a.group] ||= {})[a.lang] = a;

/* footer guides nav per language: that language's guides, falling back to EN ones */
function guidesNav(lang) {
  const own = articles.filter((a) => a.lang === lang && a.nav !== false);
  const links = own.map((a) => `<a href="${a.path}">${esc(a.navLabel || a.crumb)}</a>`);
  if (lang === 'en') links.push(`<a href="/guides/">All guides</a>`);
  else links.push(`<a href="/guides/" hreflang="en" lang="en">Guides (EN)</a>`);
  return links.join('\n      ');
}

function footer(lang, extra = '') {
  const u = UI[lang];
  return `<footer class="foot">
  <div class="wrap foot__in">
    <div class="foot__brand">
      <img src="/assets/img/mark.svg" alt="" width="32" height="32" loading="lazy">
      <span>${esc(u.footTag)}</span>
    </div>
    <nav class="foot__links" aria-label="${esc(u.footer)}">
      <a href="${lang === 'en' ? '/about/' : HOME[lang] + '#about'}">${esc(u.about)}</a>
      <a href="/privacy/${lang !== 'en' ? '?lang=' + lang : ''}">${esc(u.privacy)}</a>
      <a href="mailto:{{CONTACT_EMAIL}}">${esc(u.contact)}</a>
      <a href="${BROWSER}" rel="noopener">${esc(u.ctaBrowser)}</a>
    </nav>
    <nav class="foot__guides" aria-label="${esc(u.guides)}">
      ${guidesNav(lang)}
    </nav>
    <p class="foot__legal"><span dir="ltr">© 2026 <bdi>Mish Ana!</bdi></span> <span>${esc(u.tm)}</span>${extra}</p>
  </div>
</footer>`;
}

/* ------------------------------------------------------------------ JSON-LD builders */
const orgNode = () => ({
  '@type': 'Organization', '@id': ORG_ID, name: 'Mish Ana!', url: abs('/'),
  logo: { '@type': 'ImageObject', url: abs('/assets/img/icon-512.png'), width: 512, height: 512 },
  ...(cfg.contactEmail ? { email: cfg.contactEmail } : {}),
  ...(cfg.sameAs.length ? { sameAs: cfg.sameAs } : {})
});
const gameNode = (lang) => ({
  '@type': ['VideoGame', 'SoftwareApplication'], '@id': GAME_ID,
  name: 'Mish Ana!', alternateName: ['مش أنا!', 'Mish Ana'],
  description: DEF[lang],
  url: abs(HOME[lang]),
  image: abs(ogImage(lang)),
  screenshot: abs(HERO.jpg),
  applicationCategory: 'GameApplication',
  applicationSubCategory: 'Party game',
  genre: ['Party game', 'Social deduction', 'Word game'],
  operatingSystem: 'Android TV, Google TV',
  gamePlatform: ['Android TV', 'Google TV', 'Web browser'],
  playMode: 'MultiPlayer',
  numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 12 },
  inLanguage: ['en', 'fr', 'ar'],
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: LIVE ? PLAY : BROWSER },
  ...(LIVE ? { installUrl: PLAY, downloadUrl: PLAY } : {}),
  ...((LIVE || cfg.sameAs.length) ? { sameAs: [...(LIVE ? [PLAY] : []), ...cfg.sameAs] } : {}),
  author: { '@id': ORG_ID }, publisher: { '@id': ORG_ID },
  trailer: { '@id': abs('/#video') }
});
/* Hero video facts are read from the file itself, so a new render (same file name) needs no edit here:
   duration from the MP4 'mvhd' box, upload date from the file's modification date (override with home.json video.uploadDate). */
const fileExists = (rel) => fs.existsSync(path.join(ROOT, rel));
/* Hero loop. The caption-free render (growth/video → assets/video/hero-clean-*) is used for every language when it
   exists, with translated HTML captions on top (.tv__cap, cues in main.js). Otherwise: the English-captioned loop. */
const CLEAN_POSTER = ['assets/img', 'assets/video'].find((d) => fileExists(`${d}/hero-clean-poster-16x9.jpg`) && fileExists(`${d}/hero-clean-poster-16x9.webp`));
const CLEAN = !!CLEAN_POSTER && ['assets/video/hero-clean-16x9-720.mp4', 'assets/video/hero-clean-16x9-540.mp4'].every(fileExists);
/* Caption cues written by the video pipeline next to the loop (hero-clean.json: seconds of the loop, one or two segments
   when a caption wraps across the loop end). main.js shows the page-language text of cap_<id> during each segment. */
const CUES = CLEAN && fileExists('assets/video/hero-clean.json')
  ? JSON.parse(rd('assets/video/hero-clean.json')).captions.map((c) => ({ k: 'cap_' + c.id, s: c.segments, ...(c.accent === '#FF4F9A' ? { hot: 'm' } : {}), ...(c.accent ? {} : { sub: 1 }) }))
  : null;
if (CLEAN && !CUES) throw new Error('assets/video/hero-clean.json is missing: the caption-free loop needs its caption cues');
const HERO = CLEAN ? {
  lg: '/assets/video/hero-clean-16x9-720.mp4', sm: '/assets/video/hero-clean-16x9-540.mp4',
  jpg: `/${CLEAN_POSTER}/hero-clean-poster-16x9.jpg`, webp: `/${CLEAN_POSTER}/hero-clean-poster-16x9.webp`,
  webpSm: fileExists('assets/img/hero-clean-poster-16x9-sm.webp') ? '/assets/img/hero-clean-poster-16x9-sm.webp' : `/${CLEAN_POSTER}/hero-clean-poster-16x9.webp`, caps: true
} : {
  lg: '/assets/video/hero-16x9-720.mp4', sm: '/assets/video/hero-16x9-540.mp4',
  jpg: '/assets/img/hero-poster-16x9.jpg', webp: '/assets/img/hero-poster-16x9.webp', webpSm: '/assets/img/hero-poster-16x9-sm.webp', caps: false
};
function heroMedia(h) {
  return h
    .replace('href="/assets/img/hero-poster-16x9-sm.webp"', `href="${HERO.webpSm}"`).replace('href="/assets/img/hero-poster-16x9.webp"', `href="${HERO.webp}"`)
    .replace('srcset="/assets/img/hero-poster-16x9-sm.webp"', `srcset="${HERO.webpSm}"`).replace('srcset="/assets/img/hero-poster-16x9.webp"', `srcset="${HERO.webp}"`)
    .replace('src="/assets/img/hero-poster-16x9.jpg"', `src="${HERO.jpg}"`)
    .replace('<div class="tv" data-ratio="16x9">', `<div class="tv" data-ratio="16x9" data-src="${HERO.lg}" data-src-sm="${HERO.sm}"${HERO.caps ? ` data-caps="${esc(JSON.stringify(CUES))}"` : ''}>`);
}
const HERO_VIDEO = HERO.lg.slice(1);
function mp4Seconds(rel) {
  try {
    const b = fs.readFileSync(path.join(ROOT, rel));
    const i = b.indexOf('mvhd');
    if (i < 0) return null;
    const v = b[i + 4];
    const scale = v === 1 ? b.readUInt32BE(i + 24) : b.readUInt32BE(i + 16);
    const dur = v === 1 ? Number(b.readBigUInt64BE(i + 28)) : b.readUInt32BE(i + 20);
    return scale ? dur / scale : null;
  } catch { return null; }
}
const videoSecs = Math.round(mp4Seconds(HERO_VIDEO) || 0);
if (!videoSecs) throw new Error(`Could not read the duration of ${HERO_VIDEO}`);
const videoDate = home.video.uploadDate || fs.statSync(path.join(ROOT, HERO_VIDEO)).mtime.toISOString().slice(0, 10);
const videoNode = (lang) => ({
  '@type': 'VideoObject', '@id': abs('/#video'),
  name: home.video.name[lang], description: home.video.description[lang].replace('{seconds}', videoSecs),
  thumbnailUrl: [abs(HERO.jpg)],
  uploadDate: videoDate, duration: `PT${videoSecs}S`,
  contentUrl: abs('/' + HERO_VIDEO),
  ...(HERO.caps ? {} : { inLanguage: 'en' }), publisher: { '@id': ORG_ID }
});
const websiteNode = () => ({ '@type': 'WebSite', '@id': SITE_ID, url: abs('/'), name: 'Mish Ana!', alternateName: 'مش أنا!', inLanguage: ['en', 'fr', 'ar'], publisher: { '@id': ORG_ID } });
const faqNode = (url, items, lang) => ({
  '@type': 'FAQPage', '@id': url + '#faq', inLanguage: lang,
  mainEntity: items.map((x) => ({ '@type': 'Question', name: strip(x.q), acceptedAnswer: { '@type': 'Answer', text: absLinks(x.a) } }))
});
const absLinks = (h) => h.replace(/href="\//g, `href="${ORIGIN}/`);

/* ------------------------------------------------------------------ HOME (EN / FR / AR from one template) */
const tpl = rd('index.html');
const ctx = { window: {} }; vm.runInNewContext(rd('assets/js/i18n.js'), ctx);
const DICTS = ctx.window.MISHANA_I18N;
if (CUES) for (const c of CUES) for (const l of ['fr', 'ar']) if (DICTS[l][c.k] == null) throw new Error(`assets/js/i18n.js: ${l}.${c.k} is missing (caption of the hero loop)`);
const JS_KEYS = ['capCiv', 'capMole', 'capBlank', 'wordA', 'wordB', 'pause', 'play', 'reelPause', 'reelPlay', 'shareTitle', 'shareText', 'copied',
  'sendTitle', 'sendText', 'sheetTitle', 'sheetBody', 'copyLink', 'linkCopied', 'emailLink', 'emailSubject', 'openHere', 'closeSheet',
  'sheetStep1', 'sheetStep2', 'waLink', 'moreShare', 'tapToCopy', 'nameMaya', 'nameSami',
  'cap_opening', 'cap_friends', 'cap_secret', 'cap_different', 'cap_clues', 'cap_fit', 'cap_out', 'cap_mole', 'cap_moleWord'];
// every caption the loop needs must exist in FR and AR (the build fails otherwise, see below)

function hreflangLinks(alts) { // alts: {en:'/x/', fr:'/fr/y/'}
  const ls = Object.keys(alts);
  if (ls.length < 2) return '';
  return ls.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(alts[l])}">`).join('\n') +
    `\n<link rel="alternate" hreflang="x-default" href="${abs(alts.en || alts[ls[0]])}">`;
}
/* Share image per language (assets/img/og-<lang>.png, rendered by tools/og.mjs), falling back to og.png. */
const ogImage = (lang) => (fileExists(`assets/img/og-${lang}.png`) ? `/assets/img/og-${lang}.png` : '/assets/img/og.png');
function socialMeta({ lang, url, title, desc, type = 'website', imageAlt, alts }) {
  const otherLocales = Object.keys(alts || {}).filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`).join('\n');
  return `<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Mish Ana!">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${abs(ogImage(lang))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta property="og:locale" content="${OG_LOCALE[lang]}">${otherLocales ? '\n' + otherLocales : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${abs(ogImage(lang))}">`;
}

// Before the Play launch (playStoreLive: false) the home leads with the browser version and shows the TV app as "coming soon".
const PRE = LIVE ? null : JSON.parse(rd('content/prelaunch.json'));
function prelaunchStructure(h) {
  const cut = (re, what, by = '') => { if (!re.test(h)) throw new Error(`prelaunch: ${what} not found in index.html`); h = h.replace(re, by); };
  cut(/[ \t]*<!-- =+ INSTALL GUIDE =+ -->[\s\S]*?<\/section>\s*/, 'install section');
  cut(/[ \t]*<a class="btn btn--ghost btn--lg hero__browser"[^>]*>[\s\S]*?<\/a>\s*/, 'hero browser button');
  // the hero keeps one action: no "No Android TV?" line and no "in testing" line (the FAQ and the final band say it)
  cut(/[ \t]*<p class="hero__alt">[\s\S]*?<\/p>\s*/, 'hero "No Android TV?" line');
  // the browser section repeated the "What you need" strip: its steps live in the send sheet, the hint and the FAQ
  cut(/[ \t]*<!-- =+ NOT ON ANDROID TV[^>]*-->[\s\S]*?<\/section>\s*/, 'browser (no-tv) section');
  cut(/href="#no-tv" data-i18n="worksNoLink"/, 'works link', 'href="#how" data-i18n="worksNoLink"');
  // FAQ: phone-visitor objections first; "My TV is a Samsung…" is merged into the first answer
  h = h.replace(/(<div class="qa">)([\s\S]*?)(\n    <\/div>\n  <\/div>\n<\/section>)/, (s, a, inner, c) => {
    const items = {}; inner.replace(/\s*<details data-q="([^"]+)">[\s\S]*?<\/details>/g, (x, q) => { items[q] = x; return x; });
    for (const q of PRE.faqOrder) if (!items[q]) throw new Error(`prelaunch: FAQ item ${q} not found`);
    return a + PRE.faqOrder.map((q) => items[q]).join('') + c;
  });
  // About moves under the final call to action, in smaller type
  const about = (h.match(/[ \t]*<!-- =+ ABOUT[\s\S]*?<\/section>\s*/) || [])[0];
  if (!about) throw new Error('prelaunch: about section not found');
  h = h.replace(about, '').replace(/(<section class="final"[\s\S]*?<\/section>\n)/, (s) => s + about.replace('class="sec about"', 'class="sec about about--small"'));
  cut(/[ \t]*<a class="btn btn--ghost btn--lg" href="[^"]*" data-cta="final"[^>]*>[\s\S]*?<\/a>\s*/, 'final browser button');
  // every Google Play button becomes a browser-version button (main.js only rewrites [data-play] links to Play)
  // hero (incl. ad angles), sticky and final buttons also get data-send: on phones main.js turns them into "send the link to my laptop or TV"
  h = h.replace(/<a\b[^>]*\sdata-play\b[^>]*>/g, (tag) => tag.replace(/href="[^"]*"/, `href="${BROWSER}"`).replace(/\sdata-play\b/, /data-cta="(hero|sticky|final)"/.test(tag) ? ' data-send' : ''));
  return h;
}
// main.js / page.js append the visitor's utm_* parameters to links marked data-browser
const markBrowserLinks = (h) => h.replace(new RegExp(`<a\\b(?![^>]*data-browser)([^>]*\\shref="${BROWSER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}")`, 'g'), '<a data-browser$1');

function renderHome(lang) {
  const m = { ...home.meta[lang], ...(PRE && PRE[lang]._metaTitle ? { title: PRE[lang]._metaTitle, description: PRE[lang]._metaDescription } : {}) };
  const dict = { ...(lang === 'en' ? {} : DICTS[lang]), ...(PRE ? PRE[lang] : {}) };
  let h = tpl;
  h = heroMedia(h);
  if (PRE) h = prelaunchStructure(h);
  if (Object.keys(dict).length) {
    h = replaceI18n(h, dict);
    // hero angle copy + device hints live in an inline script: swap in the page language / pre-launch copy
    h = h.replace(/var A=\{[\s\S]*?\},a='',p,d=document;/, () => {
      const keys = ['reveal', 'passphone', 'nohardware', 'tonight', 'family', 'tvgame'];
      const en = {}; tpl.replace(/(\w+):\['((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'\]/g, (s, k, t, sub) => { en[k] = [t, sub]; return s; });
      const A = keys.map((k) => `${k}:${JSON.stringify([dict['heroTitle_' + k] ?? en[k][0], strip(dict['heroSub_' + k] ?? en[k][1])])}`).join(',\n        ');
      return `var A={\n        ${A}\n      },a='',p,d=document;`;
    });
    h = h.replace(/h\.innerHTML='[^']*';h\.setAttribute\('data-i18n','(hintIos|hintDesktop)'\)/g, (s, k) => (dict[k] != null ? `h.innerHTML=${JSON.stringify(dict[k])};h.setAttribute('data-i18n','${k}')` : s));
  }
  if (lang !== 'en') {
    // strings main.js needs at runtime (the rest is already in the HTML): ~1 KB instead of loading i18n.js
    const mini = { metaTitle: m.title, metaDesc: m.description };
    for (const k of JS_KEYS) if (dict[k] != null) mini[k] = dict[k];
    h = h.replace('<!--I18N_INLINE-->', `<script>window.MISHANA_I18N=${JSON.stringify({ [lang]: mini }).replace(/</g, '\\u003c')};</script>`);
  } else {
    h = h.replace('<!--I18N_INLINE-->', '');
  }
  h = h.replace(/<html lang="en" dir="ltr">/, `<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`);
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(m.description)}">`);
  // language switcher: real URLs
  h = h.replace(/(<nav class="lang"[^>]*>)([\s\S]*?)(<\/nav>)/, (s, a, inner, c) => a + '\n      ' + LANGS.map((l) =>
    `<a href="${HOME[l]}" data-lang="${l}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="page"' : ''}>${LANG_LABEL[l]}</a>`).join('\n      ') + '\n    ' + c);
  h = h.replace('<!--GUIDES_NAV-->', guidesNav(lang));
  h = h.replace(/href="\/privacy\/"/g, `href="/privacy/${lang !== 'en' ? '?lang=' + lang : ''}"`);

  const url = abs(HOME[lang]);
  const faqItems = [];
  h.replace(/<details data-q="[^"]*">\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*<div class="qa__a"[^>]*>([\s\S]*?)<\/div>\s*<\/details>/g, (s, q, a) => { faqItems.push({ q, a }); return s; });
  if (faqItems.length < 5) throw new Error(`home ${lang}: FAQ extraction found ${faqItems.length} items`);
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      orgNode(), websiteNode(), gameNode(lang), videoNode(lang),
      { '@type': 'WebPage', '@id': url + '#webpage', url, name: m.title, description: m.description, inLanguage: lang, isPartOf: { '@id': SITE_ID }, about: { '@id': GAME_ID }, primaryImageOfPage: abs(HERO.jpg), dateModified: home.updated },
      faqNode(url, faqItems, lang)
    ]
  };
  const head = `<link rel="canonical" href="${url}">
${hreflangLinks(HOME)}
${socialMeta({ lang, url, title: m.ogTitle, desc: m.ogDescription, imageAlt: m.ogImageAlt, alts: HOME })}
${ld(graph)}`;
  h = h.replace('<!--SEO_HEAD-->', head);
  return fillPlaceholders(markBrowserLinks(h));
}

/* ------------------------------------------------------------------ GUIDE pages */
function langSwitch(current, alts) {
  return `<nav class="lang" aria-label="${esc(UI[current].langNav)}">\n      ` + LANGS.map((l) => {
    const href = alts[l] || HOME[l];
    return `<a href="${href}" data-lang="${l}" hreflang="${l}" lang="${l}"${l === current ? ' aria-current="page"' : ''}>${LANG_LABEL[l]}</a>`;
  }).join('\n      ') + '\n    </nav>';
}
function headerBar(lang, alts) {
  const u = UI[lang];
  return `<a class="skip" href="#main">${esc(u.skip)}</a>
<header class="nav">
  <div class="nav__in wrap">
    <a class="brand" href="${HOME[lang]}" aria-label="Mish Ana! – ${esc(u.home)}">
      <img class="brand__mark" src="/assets/img/mark.svg" alt="" width="36" height="36">
      <img class="brand__word brand__word--latin" src="/assets/img/wordmark-latin.svg" alt="Mish Ana!" width="100" height="30">
    </a>
    ${langSwitch(lang, alts)}
    <a class="btn btn--play btn--sm nav__cta" href="${LIVE ? PLAY : BROWSER}"${LIVE ? ' data-play' : ''} rel="noopener">${esc(u.navCta)}</a>
  </div>
</header>`;
}
function ctaBox(lang) {
  const u = UI[lang];
  const play = `<a class="btn btn--play btn--lg btn--stack" href="${PLAY}${lang !== 'en' ? '&amp;hl=' + lang : ''}" data-play rel="noopener"><span class="btn__txt"><span>${esc(u.ctaInstall)}</span><small>${esc(u.ctaInstallSub)}</small></span></a>`;
  const br = (primary) => `<a class="btn ${primary ? 'btn--play btn--stack' : 'btn--ghost'} btn--lg" href="${BROWSER}" rel="noopener">${primary ? `<span class="btn__txt"><span>${esc(u.ctaBrowser)}</span><small>${esc(u.ctaBrowserSub)}</small></span>` : esc(u.ctaBrowser)}</a>`;
  return `<aside class="cta-box" aria-labelledby="cta-title">
    <h2 id="cta-title">${esc(u.ctaTitle)}<span class="dot">.</span></h2>
    <p>${esc(LIVE ? u.ctaBodyLive : u.ctaBodySoon)}</p>
    <div class="ctas">${LIVE ? play + br(false) : br(true)}</div>
    <p class="cta-box__url" dir="ltr">${esc(BROWSER_SHORT)}</p>
  </aside>`;
}
function aboutBox(lang) {
  return `<aside class="about-box" aria-label="${esc(UI[lang].aboutBox)}"><p><strong>${esc(UI[lang].aboutBox)}</strong> ${esc(DEF[lang])}</p></aside>`;
}
function crumbsFor(a) {
  const u = UI[a.lang];
  const items = [{ name: 'Mish Ana!', path: HOME[a.lang] }];
  if (a.lang === 'en' && a.type === 'Article') items.push({ name: u.guides, path: '/guides/' });
  items.push({ name: a.crumb, path: a.path });
  return items;
}
function renderArticle(a) {
  const u = UI[a.lang];
  const alts = {}; for (const l of LANGS) if (byGroup[a.group]?.[l]) alts[l] = byGroup[a.group][l].path;
  const url = abs(a.path);
  const crumbs = crumbsFor(a);
  const related = (a.related || []).map((p) => articles.find((x) => x.path === p)).filter(Boolean);
  const auto = articles.filter((x) => x.lang === a.lang && x.path !== a.path && !related.includes(x) && x.nav !== false && x.type === 'Article');
  const rel = [...related, ...auto].slice(0, 4);
  const others = Object.keys(alts).filter((l) => l !== a.lang);

  let body = a.body.replace(/\{\{BROWSER_URL\}\}/g, BROWSER).replace(/\{\{BROWSER_SHORT\}\}/g, BROWSER_SHORT).replace(/\{\{PLAY_URL\}\}/g, PLAY);
  const faqHtml = a.faq.length ? `<section class="art-faq" aria-labelledby="faq-title">
    <h2 id="faq-title">${esc(u.faq)}</h2>
    <div class="qa">
${a.faq.map((x) => `      <details>\n        <summary>${x.q}</summary>\n        <div class="qa__a">${/^\s*<(p|ul|ol)\b/.test(x.a) ? x.a : `<p>${x.a}</p>`}</div>\n      </details>`).join('\n')}
    </div>
  </section>` : '';
  body = body.replace('<!--FAQ-->', faqHtml);
  if (!/<!--CTA-->/.test(body)) body += '\n<!--CTA-->';
  body = body.replace('<!--CTA-->', ctaBox(a.lang));
  body = body.replace('<!--ABOUT-->', aboutBox(a.lang));
  body = body.replace('<!--DEFINITION-->', esc(DEF[a.lang])).replace('<!--FACTS-->', () => `<ul class="facts">${home.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`);
  body = body.replace('<!--GUIDES_LIST-->', () => {
    const card = (x) => `<li><a href="${x.path}"${x.lang !== a.lang ? ` hreflang="${x.lang}" lang="${x.lang}"` : ''}>${esc(x.navLabel || x.crumb)}</a><span${x.lang !== a.lang ? ` lang="${x.lang}"` : ''}>${esc(x.description)}</span></li>`;
    const list = (l) => articles.filter((x) => x.lang === l && x.type === 'Article');
    return `<ul class="guide-list">${list('en').map(card).join('')}</ul>
    <h2>En français</h2><ul class="guide-list">${list('fr').map(card).join('')}</ul>
    <h2>بالعربي</h2><ul class="guide-list">${list('ar').map(card).join('')}</ul>`;
  });

  const graph = [
    orgNode(),
    {
      '@type': a.type === 'AboutPage' ? 'AboutPage' : a.type === 'CollectionPage' ? 'CollectionPage' : 'WebPage', '@id': url + '#webpage', url, name: a.title, description: a.description, inLanguage: a.lang,
      isPartOf: { '@id': SITE_ID }, about: { '@id': GAME_ID }, breadcrumb: { '@id': url + '#breadcrumb' }, dateModified: a.updated
    },
    {
      '@type': 'BreadcrumbList', '@id': url + '#breadcrumb',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.path) }))
    }
  ];
  if (a.type === 'Article') graph.push({
    '@type': 'Article', '@id': url + '#article', headline: a.h1, description: a.description, inLanguage: a.lang,
    datePublished: a.published, dateModified: a.updated, mainEntityOfPage: { '@id': url + '#webpage' },
    image: abs(ogImage(a.lang)), author: { '@id': ORG_ID }, publisher: { '@id': ORG_ID }, about: { '@id': GAME_ID },
    ...(a.mentions ? { mentions: a.mentions.map((x) => ({ '@type': x.type || 'VideoGame', name: x.name, ...(x.url ? { url: x.url } : {}) })) } : {})
  });
  if (a.type === 'AboutPage') graph.push(gameNode(a.lang));
  if (a.faq.length) graph.push(faqNode(url, a.faq, a.lang));

  const html = `<!doctype html>
<html lang="${a.lang}" dir="${a.lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(a.title)}</title>
<meta name="description" content="${esc(a.description)}">
<meta name="theme-color" content="#2B1650">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="${url}">
${hreflangLinks(alts)}
${socialMeta({ lang: a.lang, url, title: a.ogTitle || a.title, desc: a.description, type: a.type === 'Article' ? 'article' : 'website', imageAlt: home.meta[a.lang].ogImageAlt, alts })}
${a.type === 'Article' ? `<meta property="article:modified_time" content="${a.updated}">` : ''}
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/cairo-black.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/cairo-semibold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/cairo-bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css">
<script src="/assets/js/page.js" defer></script>
${ld({ '@context': 'https://schema.org', '@graph': graph })}
</head>
<body data-page="${esc(a.slug)}">
${headerBar(a.lang, alts)}
<main id="main" class="legal art">
  <article class="wrap wrap--narrow">
    <nav class="crumbs" aria-label="${esc(u.crumbs)}"><ol>${crumbs.map((c, i) => i === crumbs.length - 1 ? `<li aria-current="page">${esc(c.name)}</li>` : `<li><a href="${c.path}">${esc(c.name)}</a></li>`).join('')}</ol></nav>
    <h1>${a.h1}</h1>
    <p class="meta">${esc(u.updated)} <time datetime="${a.updated}">${dateFmt(a.updated, a.lang)}</time>${others.length ? ` · ${esc(u.readIn)} ${others.map((l) => `<a href="${alts[l]}" hreflang="${l}" lang="${l}">${LANG_NAME[l]}</a>`).join(', ')}` : ''}</p>
${body}
${rel.length ? `    <nav class="related" aria-labelledby="rel-title"><h2 id="rel-title">${esc(u.more)}</h2><ul>${rel.map((x) => `<li><a href="${x.path}">${esc(x.navLabel || x.crumb)}</a><span>${esc(x.description)}</span></li>`).join('')}</ul></nav>` : ''}
  </article>
</main>
${footer(a.lang)}
</body>
</html>
`;
  return fillPlaceholders(markBrowserLinks(html));
}

/* ------------------------------------------------------------------ llms.txt / llms-full.txt */
function htmlToText(h) {
  return h
    .replace(/<aside class="cta-box"[\s\S]*?<\/aside>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (s, t) => `\n\n## ${strip(t)}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, (s, t) => `\n\n### ${strip(t)}\n\n`)
    .replace(/<summary>([\s\S]*?)<\/summary>/g, (s, t) => `\n\n**${strip(t)}**\n`)
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (s, href, t) => `[${strip(t)}](${href.startsWith('/') ? abs(href) : href.replace(/&amp;/g, '&')})`)
    .replace(/<li[^>]*>/g, '\n- ').replace(/<\/(p|div|ul|ol|table|tr|section|details|aside)>/g, '\n')
    .replace(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g, (s, t) => ` ${strip(t)} |`)
    .replace(/<tr[^>]*>/g, '\n|')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function llms(full) {
  const F = home.facts;
  const en = articles.filter((a) => a.lang === 'en');
  const intl = articles.filter((a) => a.lang !== 'en');
  let t = `# Mish Ana! (مش أنا!)

> ${DEF.en}

${F.map((f) => `- ${f}`).join('\n')}
- Status: ${LIVE ? `available on Google Play for Android TV / Google TV (${PLAY}) and free in any web browser (${BROWSER}).` : `the Android TV / Google TV app (package app.mishana.tv) is coming to Google Play; the full game is playable today, free, in any web browser at ${BROWSER}.`}

Short definitions for quoting:
- EN: ${DEF.en}
- FR: ${DEF.fr}
- AR: ${DEF.ar}

## Main pages

- [Mish Ana! home (English)](${abs('/')}): what the game is, which TVs it works on, how to install it from a phone, FAQ
- [Mish Ana! (Français)](${abs('/fr/')}): page d'accueil en français
- [مش أنا! (العربية)](${abs('/ar/')}): الصفحة الرئيسية بالعربي
- [About Mish Ana!](${abs('/about/')}): entity facts, roles, platforms, languages, contact
- [Play in a browser](${BROWSER}): host a game from a laptop or TV browser; phones scan the QR code

## Guides

${en.filter((a) => a.type === 'Article').map((a) => `- [${a.navLabel || a.crumb}](${abs(a.path)}): ${a.description}`).join('\n')}

## Other languages

${intl.map((a) => `- [${a.navLabel || a.crumb}](${abs(a.path)}) (${a.lang}): ${a.description}`).join('\n')}

## Optional

- [Privacy policy](${abs('/privacy/')})
- [Sitemap](${abs('/sitemap.xml')})
- [Full text for LLMs](${abs('/llms-full.txt')})
`;
  if (!full) return t;
  t += `\n\n---\n\n# Full text\n\n## Home page FAQ (English)\n\n`;
  const enHome = renderHome('en');
  enHome.replace(/<details data-q="[^"]*">\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*<div class="qa__a"[^>]*>([\s\S]*?)<\/div>\s*<\/details>/g, (s, q, a) => { t += `**${strip(q)}**\n${htmlToText(a)}\n\n`; return s; });
  for (const a of articles) {
    t += `\n\n---\n\n# ${strip(a.h1)}\n\nURL: ${abs(a.path)}\nLanguage: ${a.lang}\nLast updated: ${a.updated}\n\n`;
    let b = a.body.replace(/\{\{BROWSER_URL\}\}/g, BROWSER).replace(/\{\{BROWSER_SHORT\}\}/g, BROWSER_SHORT).replace(/\{\{PLAY_URL\}\}/g, PLAY).replace('<!--ABOUT-->', '').replace('<!--CTA-->', '');
    t += htmlToText(b).replace('<!--FAQ-->', '');
    if (a.faq.length) t += `\n\n## FAQ\n\n` + a.faq.map((x) => `**${strip(x.q)}**\n${htmlToText(x.a)}`).join('\n\n');
  }
  return t.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n') + '\n';
}

/* ------------------------------------------------------------------ BUILD */
rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });
for (const p of ['assets', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'site.webmanifest', '_headers']) copy(p);
// JS files may carry placeholders (CF beacon token)
for (const f of ['assets/js/main.js', 'assets/js/page.js']) if (fs.existsSync(path.join(OUT, f))) write(f, fillPlaceholders(fs.readFileSync(path.join(OUT, f), 'utf8')));

const pages = []; // { path, lang, group, updated, html }
for (const lang of LANGS) pages.push({ path: HOME[lang], lang, group: 'home', updated: home.updated, html: renderHome(lang) });
for (const a of articles) pages.push({ path: a.path, lang: a.lang, group: a.group, updated: a.updated, html: renderArticle(a) });
// privacy (EN + FR in one document, toggled client-side) and 404
pages.push({ path: '/privacy/', lang: 'en', group: 'privacy', updated: home.privacyUpdated, html: fillPlaceholders(rd('privacy/index.html')) });
for (const p of pages) write(p.path.replace(/^\//, '') + 'index.html', p.html);
write('404.html', fillPlaceholders(rd('404.html')));

// sitemap.xml with hreflang alternates
const groupAlts = {}; for (const p of pages) (groupAlts[p.group] ||= {})[p.lang] = p.path;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages.map((p) => {
  const alts = groupAlts[p.group]; const ls = Object.keys(alts);
  const x = ls.length > 1 ? ls.map((l) => `\n    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(alts[l])}"/>`).join('') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(alts.en || alts[ls[0]])}"/>` : '';
  return `  <url>\n    <loc>${abs(p.path)}</loc>\n    <lastmod>${p.updated}</lastmod>${x}\n  </url>`;
}).join('\n')}
</urlset>
`;
write('sitemap.xml', sitemap);

const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'DuckAssistBot', 'MistralAI-User', 'Meta-ExternalAgent', 'Amazonbot', 'CCBot'];
write('robots.txt', `# Mish Ana! – every crawler is welcome, including AI search and assistant crawlers.
# Short facts for language models: ${abs('/llms.txt')}

User-agent: *
Allow: /

${AI_BOTS.map((b) => `User-agent: ${b}`).join('\n')}
Allow: /

Sitemap: ${abs('/sitemap.xml')}
`);
write('llms.txt', fillPlaceholders(llms(false)));
write('llms-full.txt', fillPlaceholders(llms(true)));

/* ------------------------------------------------------------------ CHECKS */
let errors = 0;
const fail = (m) => { console.error('✗ ' + m); errors++; };
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : files.push(p); } })(OUT);
const exists = (urlPath) => {
  const clean = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
  const f = path.join(OUT, clean);
  return fs.existsSync(clean.endsWith('/') ? path.join(f, 'index.html') : f) || fs.existsSync(f + '.html');
};
const ALLOWED_TOKENS = new Set(['CONTACT_EMAIL', 'OWNER_NAME', 'CF_BEACON_TOKEN'].filter((k) => !cfg[{ CONTACT_EMAIL: 'contactEmail', OWNER_NAME: 'ownerName', CF_BEACON_TOKEN: 'cfBeaconToken' }[k]]));
let ldCount = 0;
for (const f of files.filter((x) => /\.(html|txt|xml|js)$/.test(x))) {
  const s = fs.readFileSync(f, 'utf8'), rel = path.relative(OUT, f);
  if (s.includes('{{SITE_URL}}')) fail(`${rel}: leftover {{SITE_URL}}`);
  // any other {{TOKEN}} is a bug; only the documented, intentionally unfilled ones may remain (site.config.json: null)
  for (const m of s.matchAll(/\{\{([A-Z_]+)\}\}/g)) if (!ALLOWED_TOKENS.has(m[1])) fail(`${rel}: leftover {{${m[1]}}}`);
  if (!f.endsWith('.html')) continue;
  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    ldCount++;
    try {
      const j = JSON.parse(m[1]);
      if (j['@context'] !== 'https://schema.org') fail(`${rel}: JSON-LD without schema.org @context`);
      for (const n of j['@graph'] || [j]) if (!n['@type']) fail(`${rel}: JSON-LD node without @type`);
    } catch (e) { fail(`${rel}: invalid JSON-LD: ${e.message}`); }
  }
  for (const m of s.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) if (!m[1].startsWith('//') && !exists(m[1])) fail(`${rel}: broken internal link ${m[1]}`);
  if (!/noindex/.test(s) && rel !== path.join("privacy", "index.html")) {
    if ((s.match(/<h1[\s>]/g) || []).length !== 1) fail(`${rel}: expected exactly one <h1>`);
    if (!/<link rel="canonical" href="https:\/\//.test(s)) fail(`${rel}: missing absolute canonical`);
    const title = (s.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    const desc = (s.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    if (!title) fail(`${rel}: missing <title>`);
    if (!desc) fail(`${rel}: missing meta description`);
    if ([...title].length > 70) console.warn(`! ${rel}: title is ${[...title].length} chars: ${title}`);
    if ([...strip(desc)].length > 170) console.warn(`! ${rel}: description is ${[...strip(desc)].length} chars`);
  }
}
if (errors) { console.error(`\nBuild finished with ${errors} error(s).`); process.exit(1); }
console.log(`✓ Built ${pages.length} pages + sitemap, robots, llms.txt into ${path.relative(ROOT, OUT)}/ for ${ORIGIN} (${ldCount} JSON-LD blocks valid, internal links OK)${LIVE ? '' : ' · playStoreLive=false'}`);
