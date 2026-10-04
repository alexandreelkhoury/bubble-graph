import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {C, PLAYERS, ROOM_CODE} from '../brand';
import {At, Avatar, FONT, Rise} from '../parts';
import {b, easeInOut, lerp, POP, prog, SNAPPY, spr} from '../time';
import {Hit, SAFE_CX} from './common';

/**
 * v2 end card (review-v2/DECISIONS.md #2), 12.25 beats ≈ 5.9 s. One centred column: wordmark → TV with the lobby
 * filling up → the CTA, which lands at ~1.1 s and then holds still to the end (≈ 4.8 s readable), between y 1110 and
 * 1440 (clear of the TikTok/Reels bottom UI). No QR on screen (viewers would try to scan it).
 * - `prelaunch` (default until the Play listing is public): "Play free in your browser" + a typeable URL.
 * - `live`: the official Google Play badge + "Or search “Mish Ana” on your TV".
 */
export type Lang = 'en' | 'ar';
export type EcMode = 'prelaunch' | 'live';
export const EC_BEATS = 12.25;
export const EC_FRAMES = Math.round(b(EC_BEATS));
export const PLAY_URL = 'play.mishana.workers.dev/tv';

const T = {
  en: {
    players: 'Players', room: 'ROOM', cta: 'Play free in your browser', foot: 'Free to play · 3–12 players · Google TV app coming soon',
    liveLine: 'Free to play · 3–12 players', search: 'Or search “Mish Ana” on your TV', badge: 'badges/google-play-badge-en.png', wordmark: 'wordmark-latin.svg',
  },
  ar: {
    players: 'اللاعبين', room: 'الغرفة', cta: 'العب ببلاش من المتصفّح', foot: 'اللعب ببلاش · 3–12 لاعب · تطبيق Google TV قريبًا',
    liveLine: 'اللعب ببلاش · 3–12 لاعب', search: 'أو فتّش عن «Mish Ana» عالتلفزيون', badge: 'badges/google-play-badge-ar.png', wordmark: 'wordmark-ar.svg',
  },
};

/** Wraps Latin runs (e.g. "Google TV", the URL) in LTR isolates so they keep their order inside Arabic text. */
const bidi = (s: string): React.ReactNode =>
  s.split(/([A-Za-z][A-Za-z0-9 .!/“”]*[A-Za-z0-9!]|[0-9]+–[0-9]+)/g).map((part, i) => (i % 2 ? <bdi key={i} dir="ltr">{part}</bdi> : part));

/** SFX in the ad's frames (pass the frame the card starts on). At most one per beat. */
export const ecHits = (start: number, mode: EcMode = 'prelaunch'): Hit[] => [
  {at: start + b(0.1), sfx: 'whoosh_fast', vol: 0.35},
  {at: start + b(0.7), sfx: 'pop_a'},
  {at: start + b(1.7), sfx: 'pop_b'},
  {at: start + b(2.3), sfx: mode === 'live' ? 'pop_hard' : 'sparkle', vol: 0.6},
  {at: start + b(3.0), sfx: 'tick', vol: 0.45, max: 20},
];

const TV_W = 760;

const LobbyTv: React.FC<{f: number; lang: Lang}> = ({f, lang}) => {
  const h = (TV_W * 9) / 16;
  const s = TV_W / 1040;
  const P = (n: number) => n * s;
  const joined = [0.6, 1.0, 1.4, 1.7].filter((t) => f >= b(t)).length;
  const cast = [PLAYERS[0], PLAYERS[1], PLAYERS[2], PLAYERS[5]];
  return (
    <div style={{position: 'absolute', left: -TV_W / 2 - P(14), top: -h / 2 - P(14), width: TV_W + P(28), height: h + P(28), borderRadius: P(36),
      background: '#05030A', boxShadow: `0 ${P(40)}px ${P(100)}px rgba(10,4,20,0.55), 0 0 ${P(140)}px rgba(255,79,154,0.25)`}}>
      <div style={{position: 'absolute', left: P(14), top: P(14), width: TV_W, height: h, borderRadius: P(24), overflow: 'hidden', fontFamily: FONT,
        background: `radial-gradient(120% 90% at 30% 0%, #5A2E9A 0%, ${C.bg} 65%)`, direction: lang === 'ar' ? 'rtl' : 'ltr'}}>
        <div style={{position: 'absolute', insetInlineStart: P(60), top: P(70), width: P(340), textAlign: 'center'}}>
          <div style={{fontSize: P(30), fontWeight: 800, color: C.text2, letterSpacing: lang === 'ar' ? 0 : '0.08em'}}>{T[lang].room}</div>
          <div style={{fontSize: P(130), fontWeight: 900, color: C.accent, letterSpacing: '0.08em', lineHeight: 1.1, direction: 'ltr'}}>
            <Rise f={f} start={-b(1)}>{ROOM_CODE}</Rise>
          </div>
          <div style={{fontSize: P(30), fontWeight: 700, color: C.text2, marginTop: P(14), direction: 'ltr'}}>{PLAY_URL.replace('/tv', '')}</div>
        </div>
        <div style={{position: 'absolute', insetInlineEnd: P(60), top: P(60), width: P(520)}}>
          <div style={{fontSize: P(34), fontWeight: 800, color: C.text, marginBottom: P(18)}}>{T[lang].players} {joined}/12</div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: P(22)}}>
            {cast.map((p, i) => {
              const k = spr(f, b([0.6, 1.0, 1.4, 1.7][i]), POP);
              return (
                <div key={i} style={{height: P(170), borderRadius: P(26), background: k > 0.01 ? C.surface : 'transparent',
                  border: k > 0.01 ? 'none' : `${P(3)}px dashed ${C.outline}`, position: 'relative', transform: `scale(${0.85 + 0.15 * Math.min(1, k)})`}}>
                  {k > 0.01 ? (
                    <>
                      <At x={P(260) / 2 + P(0)} y={P(70)}>
                        <Avatar shape={p.shape} color={p.color} size={P(90)} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${k})`}} />
                      </At>
                      <div style={{position: 'absolute', left: 0, right: 0, top: P(122), textAlign: 'center', fontSize: P(30), fontWeight: 800, color: C.text}}>{p.name}</div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const EndCard: React.FC<{lang?: Lang; mode?: EcMode}> = ({lang = 'en', mode = 'prelaunch'}) => {
  const f = useCurrentFrame();
  const t = T[lang];
  const tvIn = spr(f, 0, SNAPPY);
  const wipe = prog(f, b(0.15), b(1.0), easeInOut);
  const cta = spr(f, b(2.2), POP);
  const glow = 0.45 + 0.15 * Math.sin((f / 60) * Math.PI * 1.2) * prog(f, b(3), b(4));
  const wmW = lang === 'ar' ? 520 : 600;
  const wmH = lang === 'ar' ? wmW * 0.42 : wmW * (301.6 / 1001.8);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* wordmark */}
      <At x={SAFE_CX} y={440} z={6}>
        <div style={{position: 'absolute', left: -wmW / 2, top: -wmH / 2, width: wmW, height: wmH,
          clipPath: `inset(0 ${50 * (1 - wipe)}% 0 ${50 * (1 - wipe)}%)`, transform: `translateY(${(1 - wipe) * 24}px)`}}>
          <Img src={staticFile(t.wordmark)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
        </div>
      </At>
      {/* TV */}
      <At x={SAFE_CX} y={810} z={5}>
        <div style={{position: 'absolute', left: 0, top: 0, transform: `translateY(${(1 - tvIn) * 120}px) scale(${lerp(0.88, 1, tvIn)})`}}>
          <LobbyTv f={f} lang={lang} />
        </div>
      </At>
      {/* CTA */}
      {mode === 'prelaunch' ? (
        <>
          <At x={SAFE_CX} y={1200} z={8}>
            <div style={{position: 'absolute', left: 0, top: -64, height: 128, transform: `translateX(-50%) scale(${cta})`, borderRadius: 999,
              background: C.primary, color: C.ink, fontFamily: FONT, fontWeight: 900, fontSize: 48, display: 'flex', alignItems: 'center', gap: 22,
              padding: '0 56px', whiteSpace: 'nowrap', boxShadow: `0 0 70px rgba(255,79,154,${glow}), 0 14px 30px rgba(10,4,20,0.4)`,
              direction: lang === 'ar' ? 'rtl' : 'ltr'}}>
              <svg width={34} height={38} viewBox="0 0 22 24" style={{transform: lang === 'ar' ? 'scaleX(-1)' : undefined}}><path d="M2 2l18 10L2 22z" fill={C.ink} /></svg>
              {t.cta}
            </div>
          </At>
          <div style={{position: 'absolute', left: 60, width: 900, top: 1292, textAlign: 'center', zIndex: 8}}>
            <span style={{display: 'inline-block', fontFamily: FONT, fontWeight: 800, fontSize: 50, color: C.text, background: 'rgba(14,6,28,0.45)',
              border: `2px solid ${C.outline}`, borderRadius: 22, padding: '8px 28px', direction: 'ltr'}}>
              <Rise f={f} start={b(2.8)}>{PLAY_URL}</Rise>
            </span>
          </div>
          <div style={{position: 'absolute', left: 60, width: 900, top: 1402, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: C.text2,
            zIndex: 8, direction: lang === 'ar' ? 'rtl' : 'ltr'}}>
            <Rise f={f} start={b(3.4)}>{bidi(t.foot)}</Rise>
          </div>
        </>
      ) : (
        <>
          <At x={SAFE_CX} y={1210} z={8}>
            <Img src={staticFile(t.badge)} style={{position: 'absolute', left: -280, top: -108, width: 560, transform: `scale(${cta})`}} />
          </At>
          <div style={{position: 'absolute', left: 60, width: 900, top: 1336, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 40, color: C.text,
            zIndex: 8, direction: lang === 'ar' ? 'rtl' : 'ltr'}}>
            <Rise f={f} start={b(2.8)}>{bidi(t.liveLine)}</Rise>
          </div>
          <div style={{position: 'absolute', left: 60, width: 900, top: 1406, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: C.text2,
            zIndex: 8, direction: lang === 'ar' ? 'rtl' : 'ltr'}}>
            <Rise f={f} start={b(3.4)}>{bidi(t.search)}</Rise>
          </div>
        </>
      )}
    </div>
  );
};
