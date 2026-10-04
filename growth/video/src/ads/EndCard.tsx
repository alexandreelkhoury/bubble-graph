import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {C, ROOM_CODE} from '../brand';
import {At, FONT, Mark, PhoneFrame, Rise} from '../parts';
import {QR, QR_N} from '../qr';
import {b, clamp, easeInOut, easeOut, lerp, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AdCaption, Hit, SAFE_CX} from './common';

/** "Install on your TV" end card, 4 s (8.25 beats). Local frames: wrap it in <Sequence from={start}>. */
export type Lang = 'en' | 'ar';
const T = {
  en: {cap1: 'Install it from *your* *phone*', cap2: 'Pick your *TV*', cap3: 'Done. *Game* *on.*', tagline: 'Party game for your TV', meta: 'Free to play · 3–12 players',
    install: 'Install on TV', installing: 'Installing on Living room TV…', installed: '✓ Installed on Living room TV', installOn: 'Install on', tv: 'Living room TV',
    blurb: 'Everyone gets a secret word. One player’s is different. Give clues, vote, and catch the Mole.', scan: 'Scan to join',
    free1: 'Free to play on Android TV', free2: '& Google TV', search: 'Or search “Mish Ana” on your TV', badge: 'badges/google-play-badge-en.png', word: 'PIZZA'},
  ar: {cap1: 'نزّلها من *تلفونك*', cap2: 'نقّي *التلفزيون*', cap3: 'خلصنا. *يلّا* *نلعب!*', tagline: 'لعبة سهرات عالتلفزيون', meta: 'اللعب ببلاش · 3–12 لاعب',
    install: 'نزّل عالتلفزيون', installing: 'عم تنزل عتلفزيون الصالون…', installed: '✓ نزلت عتلفزيون الصالون', installOn: 'نزّل على', tv: 'تلفزيون الصالون',
    blurb: 'كل واحد بتوصلو كلمة سرّية. واحد كلمتو غير شكل. عطوا تلميح، صوّتوا، واكشفوا الجاسوس.', scan: 'امسحوا الكود وفوتوا',
    free1: 'اللعب ببلاش على Android TV', free2: 'و Google TV', search: 'أو فتّش عن «Mish Ana» عالتلفزيون', badge: 'badges/google-play-badge-ar.png', word: 'بيتزا'},
};

/** Wraps Latin runs (e.g. "Mish Ana!", "Android TV") in LTR isolates so they keep their order inside Arabic text. */
const bidi = (s: string): React.ReactNode =>
  s.split(/([A-Za-z][A-Za-z0-9 .!]*[A-Za-z0-9!])/g).map((part, i) => (i % 2 ? <bdi key={i} dir="ltr">{part}</bdi> : part));

export const EC_BEATS = 8.25;
export const EC_FRAMES = Math.round(b(EC_BEATS));


/** SFX for the end card, in the ad's frames (pass the frame the card starts on). */
export const ecHits = (start: number): Hit[] => [
  {at: start + b(0.1), sfx: 'whoosh_fast', vol: 0.4},
  {at: start + b(1.85), sfx: 'click', vol: 0.8},
  {at: start + b(2.9), sfx: 'tick', vol: 0.6, max: 20},
  {at: start + b(3.3), sfx: 'pop_a', vol: 0.6},
  {at: start + b(4.2), sfx: 'swoosh_short', vol: 0.45},
  {at: start + b(5.4), sfx: 'sparkle', vol: 0.65},
  {at: start + b(6), sfx: 'bass_hit', vol: 0.6, max: 40},
  {at: start + b(7), sfx: 'pop_hard', vol: 0.55},
];

const TvIcon: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M8 21h8M12 17v4" />
  </svg>
);
const PhoneIcon: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18.5h2" />
  </svg>
);

/**
 * Our own install screen (brand UI, not a copy of the Play Store): the app card and an "Install on TV" button whose
 * device sheet lists only the TV (the app is TV-only). Replace with a real screen recording once the listing is live.
 */
const Listing: React.FC<{f: number; w: number; h: number; lang: Lang}> = ({f, w, h, lang}) => {
  const t = T[lang];
  const u = w / 400;
  const sheet = spr(f, b(2.05), SNAPPY) - spr(f, b(4.1), {damping: 26, stiffness: 240});
  const check = prog(f, b(3.1), b(3.5), easeOut);
  const installing = f >= b(4.15);
  const bar = prog(f, b(4.3), b(5.3), easeInOut);
  const tapX = w * 0.86, tapY = 362 * u;
  const tap1 = f > b(1.6) && f < b(2.2) ? Math.sin(Math.PI * clamp((f - b(1.6)) / b(0.6))) : 0;
  const tap2 = f > b(2.8) && f < b(3.4) ? Math.sin(Math.PI * clamp((f - b(2.8)) / b(0.6))) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, background: C.bg, fontFamily: FONT, color: C.text, direction: lang === 'ar' ? 'rtl' : 'ltr'}}>
      {/* header */}
      <div style={{position: 'absolute', top: 92 * u, left: 26 * u, right: 26 * u, display: 'flex', gap: 18 * u, alignItems: 'center'}}>
        <div style={{position: 'relative', width: 110 * u, height: 110 * u, borderRadius: 24 * u, background: C.bgDeep, flexShrink: 0, overflow: 'hidden'}}>
          <At x={55 * u} y={55 * u}><Mark size={110 * u} bubble={1} stroke={1} /></At>
        </div>
        <div>
          <div style={{fontSize: 34 * u, fontWeight: 900, lineHeight: 1.1}}><bdi dir="ltr">Mish Ana!</bdi></div>
          <div style={{fontSize: 18 * u, fontWeight: 700, color: C.primary, marginTop: 4 * u}}>{t.tagline}</div>
          <div style={{fontSize: 16 * u, fontWeight: 600, color: C.text2, marginTop: 2 * u}}>{t.meta}</div>
        </div>
      </div>
      {/* install button with device chevron */}
      <div style={{position: 'absolute', top: 330 * u, left: 26 * u, right: 26 * u, height: 64 * u, borderRadius: 999, background: C.primary,
        color: C.ink, display: 'flex', alignItems: 'center', overflow: 'hidden', fontSize: 22 * u, fontWeight: 900}}>
        {installing ? (
          <div style={{flex: 1, textAlign: 'center', position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${bar * 100}%`, background: 'rgba(255,247,236,0.35)'}} />
            <span style={{position: 'relative'}}>{bar < 1 ? t.installing : t.installed}</span>
          </div>
        ) : (
          <>
            <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 * u}}><TvIcon size={26 * u} color={C.ink} />{t.install}</div>
            <div style={{width: 1.5 * u, height: '56%', background: 'rgba(18,10,31,0.35)'}} />
            <div style={{width: 70 * u, display: 'flex', justifyContent: 'center'}}>
              <svg width={22 * u} height={22 * u} viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke={C.ink} strokeWidth={3} fill="none" strokeLinecap="round" /></svg>
            </div>
          </>
        )}
      </div>
      {/* screenshots strip (brand colour tiles) */}
      <div style={{position: 'absolute', top: 430 * u, left: 26 * u, right: 0, display: 'flex', gap: 12 * u}}>
        {[C.primary, C.elevated, C.accent].map((c, i) => (
          <div key={i} style={{width: 220 * u, height: 124 * u, borderRadius: 14 * u, background: c, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: i === 1 ? C.text : C.ink, fontWeight: 900, fontSize: 26 * u}}>
            {[t.word, ROOM_CODE, 'OUT'][i]}
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', top: 580 * u, left: 26 * u, right: 26 * u, fontSize: 17 * u, lineHeight: 1.4, color: C.text2, fontWeight: 600}}>
        {t.blurb}
      </div>
      {/* tap dot */}
      {tap1 + tap2 > 0 ? (
        <div style={{position: 'absolute', left: tapX - 34 * u, top: tapY - 34 * u, width: 68 * u, height: 68 * u, borderRadius: 99,
          background: 'rgba(255,247,236,0.28)', border: `${3 * u}px solid rgba(255,247,236,0.7)`, transform: `scale(${0.6 + 0.4 * (tap1 + tap2)})`}} />
      ) : null}
      {/* device sheet */}
      {sheet > 0.001 ? (
        <>
          <div style={{position: 'absolute', inset: 0, background: `rgba(0,0,0,${0.35 * clamp(sheet)})`}} />
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 360 * u, transform: `translateY(${(1 - sheet) * 100}%)`,
            background: C.surface, borderRadius: `${28 * u}px ${28 * u}px 0 0`, padding: `${26 * u}px ${30 * u}px`, boxSizing: 'border-box'}}>
            <div style={{width: 50 * u, height: 6 * u, borderRadius: 9, background: C.outline, margin: `0 auto ${22 * u}px`}} />
            <div style={{fontSize: 26 * u, fontWeight: 900, marginBottom: 20 * u}}>{t.installOn}</div>
            {[{label: t.tv, icon: <TvIcon size={30 * u} color={C.text} />, on: true}].map((row, i) => (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18 * u, height: 70 * u, fontSize: 22 * u, fontWeight: 800,
                color: C.text, borderRadius: 16 * u, padding: `0 ${14 * u}px`, background: `rgba(255,61,139,${0.16 * check})`}}>
                {row.icon}
                <div style={{flex: 1}}>{row.label}</div>
                <svg width={34 * u} height={34 * u} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="11" fill={C.primary} transform={`scale(${check})`} style={{transformOrigin: '12px 12px'}} />
                  <path d="M7 12.5l3.2 3.2L17 9" stroke={C.ink} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray={16} strokeDashoffset={16 * (1 - check)} />
                </svg>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

const MiniTv: React.FC<{f: number; w: number; lang: Lang}> = ({f, w, lang}) => {
  const h = (w * 9) / 16;
  const s = w / 1040;
  const on = prog(f, b(5.15), b(5.6), easeOut);
  return (
    <div style={{position: 'absolute', left: -w / 2 - 12 * s, top: -h / 2 - 12 * s, width: w + 24 * s, height: h + 24 * s, borderRadius: 34 * s,
      background: '#05030A', boxShadow: `0 ${40 * s}px ${100 * s}px rgba(0,0,0,0.6), 0 0 ${120 * s * on}px rgba(255,61,139,${0.25 * on})`}}>
      <div style={{position: 'absolute', left: 12 * s, top: 12 * s, width: w, height: h, borderRadius: 22 * s, overflow: 'hidden',
        background: on > 0 ? `radial-gradient(120% 90% at 30% 0%, #2A1240 0%, ${C.bg} 60%)` : '#0A0710'}}>
        {on > 0 ? (
          <div style={{position: 'absolute', inset: 0, transform: `scale(${lerp(1.08, 1, on)})`}}>
            <div style={{position: 'absolute', left: 70 * s, top: 90 * s, width: 300 * s, height: 300 * s, borderRadius: 30 * s, background: C.text,
              transform: `scale(${spr(f, b(5.3), SNAPPY)})`}}>
              <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} width="100%" height="100%">
                {QR.flatMap((row, r) => row.map((v, c) => (v ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={C.ink} /> : null)))}
              </svg>
            </div>
            <div style={{position: 'absolute', left: 70 * s, top: 420 * s, width: 300 * s, fontFamily: FONT, fontWeight: 900, fontSize: 92 * s,
              letterSpacing: '0.1em', color: C.accent, textAlign: 'center', lineHeight: 1}}>
              <Rise f={f} start={b(5.4)} cfg={POP}>{ROOM_CODE}</Rise>
            </div>
            <At x={720 * s} y={250 * s}>
              <Mark size={300 * s} bubble={spr(f, b(5.35), POP)} stroke={prog(f, b(5.5), b(5.9), easeOut)} />
            </At>
            <div style={{position: 'absolute', left: 470 * s, width: 500 * s, top: 440 * s, textAlign: 'center', fontFamily: FONT, fontWeight: 800,
              fontSize: 40 * s, color: C.text2}}>
              <Rise f={f} start={b(5.6)}>{T[lang].scan}</Rise>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const EndCard: React.FC<{lang?: Lang}> = ({lang = 'en'}) => {
  const f = useCurrentFrame();
  const t = T[lang];
  // phone: springs up, then (b4.9) shrinks to the bottom-left while the TV lights up
  const enter = spr(f, 0, SOFT);
  const away = prog(f, b(4.9), b(5.7), easeInOut);
  const pw = 560, ph = pw / 0.48;
  const px = lerp(SAFE_CX, 215, away), py = lerp(945, 1360, away) + (1 - enter) * 1300;
  const ps = lerp(1, 0.3, away);
  const tvIn = spr(f, b(5), SNAPPY);
  const lock = spr(f, b(6), SNAPPY);
  const badge = spr(f, b(7), POP);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <AdCaption f={f} text={t.cap1} y={250} rtl={lang === 'ar'} start={b(0.15)} end={b(1.9)} size={70} />
      <AdCaption f={f} text={t.cap2} y={250} rtl={lang === 'ar'} start={b(2.1)} end={b(4.1)} size={78} />
      <AdCaption f={f} text={t.cap3} y={250} rtl={lang === 'ar'} start={b(4.3)} end={b(5)} size={78} />
      {tvIn > 0.001 ? (
        <At x={SAFE_CX} y={560} z={5}>
          <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${0.6 + 0.4 * tvIn})`, opacity: clamp(tvIn * 3)}}>
            <MiniTv f={f} w={820} lang={lang} />
          </div>
        </At>
      ) : null}
      <At x={px} y={py} z={10}>
        <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${ps}) rotate(${-6 * away}deg)`}}>
          <PhoneFrame w={pw} h={ph} screen={C.bg}>
            <Listing f={f} w={pw} h={ph} lang={lang} />
          </PhoneFrame>
        </div>
      </At>
      {lock > 0.001 ? (
        <>
          <div style={{position: 'absolute', left: 0, width: 1080, top: 940, display: 'flex', justifyContent: 'center', paddingRight: 1080 - 2 * SAFE_CX,
            boxSizing: 'border-box', zIndex: 6}}>
            <div style={{width: 640, height: 640 * (301.6 / 1001.8), clipPath: `inset(0 ${50 * (1 - lock)}% 0 ${50 * (1 - lock)}%)`}}>
              <Img src={staticFile('wordmark-latin.svg')} style={{width: '100%', height: '100%'}} />
            </div>
          </div>
          <div style={{position: 'absolute', left: 300, width: 660, top: 1200, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 40,
            color: C.text, zIndex: 6, lineHeight: 1.2, direction: lang === 'ar' ? 'rtl' : 'ltr'}}>
            <Rise f={f} start={b(6.3)}>{bidi(t.free1)}</Rise>
            <br />
            <Rise f={f} start={b(6.5)}><span style={{color: C.text2}}>{bidi(t.free2)}</span></Rise>
          </div>
          <div style={{position: 'absolute', left: 300, width: 660, top: 1530, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 30,
            color: C.text2, zIndex: 6, direction: lang === 'ar' ? 'rtl' : 'ltr'}}>
            <Rise f={f} start={b(7.4)}>{bidi(t.search)}</Rise>
          </div>
          <At x={630} y={1420} z={7}>
            <Img src={staticFile(t.badge)}
              style={{position: 'absolute', left: -225, top: -87, width: 450, transform: `scale(${badge})`}} />
          </At>
        </>
      ) : null}
    </div>
  );
};
