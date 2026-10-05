import React from 'react';
import {C} from '../brand';
import {FONT} from '../parts';
import {clamp, easeInOut, mix, POP, prog, SNAPPY, spr} from '../time';
import {Fam, FamAvatar} from './m6-cast';

/**
 * Arabic, right-to-left copy of parts.tsx WordFace (phone PH-04 "Your secret word" screen), strings from
 * shared/i18n/ar.json: reveal.yourWord / reveal.holdToSee / reveal.privacy. Dark screen, a card in the
 * player's colour that flips (2D squash) to the word at `flipAt` and back face-down at `hideAt` (the word hides
 * when the finger lifts). The Mole's screen is identical.
 */
export const ArWordFace: React.FC<{f: number; w: number; h: number; p: Fam; word: string; flipAt: number; hideAt?: number; code?: string; contentIn?: number; out?: number}> = ({
  f, w, h, p, word, flipAt, hideAt = 1e9, code = 'JQPU', contentIn = -999, out = 1e9,
}) => {
  const u = Math.min(w / 300, h / 625);
  const t = prog(f, flipAt - 7, flipAt + 7, easeInOut) - prog(f, hideAt - 7, hideAt + 7, easeInOut);
  const sx = Math.max(0.02, Math.abs(Math.cos(Math.PI * t)));
  const face = t >= 0.5;
  const pop = face ? 1 + 0.07 * (1 - spr(f, flipAt + 7, POP)) : 1;
  const cw = 250 * u, ch = 280 * u;
  const faceBg = p.cream ? C.elevated : p.color;
  const back = mix(C.surface, p.color, 0.22);
  const gone = f >= out ? spr(f, out, {damping: 30, stiffness: 260}) : 0;
  const k = clamp((1 - gone) * (contentIn > -999 ? spr(f, contentIn, SNAPPY) : 1));
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text, direction: 'rtl'}}>
      {/* top bar: me (right), room code chip (left) */}
      <div style={{position: 'absolute', top: h / 2 - 262 * u, left: w / 2 - 132 * u, width: 264 * u, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transform: `scale(${k})`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 6 * u, fontSize: 19 * u, fontWeight: 800, lineHeight: 1.3}}>
          <div style={{position: 'relative', width: 26 * u, height: 26 * u}}>
            <div style={{position: 'absolute', left: 13 * u, top: 13 * u}}><FamAvatar p={p} size={26 * u} /></div>
          </div>
          {p.name}
        </div>
        <div style={{direction: 'ltr', fontSize: 16 * u, fontWeight: 900, color: C.accent, background: C.elevated, borderRadius: 99, padding: `${3 * u}px ${10 * u}px`, letterSpacing: '0.08em'}}>{code}</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 - 200 * u, textAlign: 'center', fontSize: 25 * u, fontWeight: 800, lineHeight: 1.4, color: C.text2, transform: `scale(${k})`}}>
        كلمتك السرّية
      </div>
      <div style={{position: 'absolute', left: (w - cw) / 2, top: h / 2 - 140 * u, width: cw, height: ch, transform: `scaleX(${sx}) scale(${k * pop})`, borderRadius: 24 * u,
        background: face ? faceBg : back, border: face ? undefined : `${2 * u}px solid ${mix(C.outline, p.color, 0.5)}`, boxSizing: 'border-box', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 ${10 * u}px ${24 * u}px rgba(0,0,0,0.3)`}}>
        {face ? (
          <div style={{fontSize: 76 * u, fontWeight: 900, lineHeight: 1.4, color: p.cream ? C.text : C.ink}}>{word}</div>
        ) : (
          <div style={{textAlign: 'center', fontSize: 21 * u, fontWeight: 700, color: C.text, lineHeight: 1.45, padding: `0 ${16 * u}px`}}>
            <div style={{fontSize: 24 * u, color: p.color, marginBottom: 8 * u, letterSpacing: '0.3em', fontWeight: 900, direction: 'ltr'}}>! · ! · !</div>
            كبسة طويلة…<br />وبتبيّن كلمتك
          </div>
        )}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 + 160 * u, textAlign: 'center', fontSize: 17 * u, fontWeight: 600, lineHeight: 1.4, color: C.text2, transform: `scale(${k})`}}>
        الأحسن ما حدا يكون عم يتطلّع.
      </div>
    </div>
  );
};

/**
 * The phone's vote screen once the vote is locked (strings: vote.title «مين مش منّا؟», vote.locked «صوتك انحسب.»):
 * the picked player's avatar and name in a selected card. Pops in at `at`.
 */
export const ArVoteFace: React.FC<{f: number; w: number; h: number; pick: Fam; at: number; out?: number}> = ({f, w, h, pick, at, out = 1e9}) => {
  if (f < at) return null;
  const u = Math.min(w / 300, h / 625);
  const k = spr(f, at, POP) * (1 - (f >= out ? spr(f, out, {damping: 30, stiffness: 260}) : 0));
  if (k <= 0.001) return null;
  const card = 230 * u;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text, direction: 'rtl'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 - 222 * u, textAlign: 'center', fontSize: 30 * u, fontWeight: 900, lineHeight: 1.4, transform: `scale(${k})`}}>
        مين مش منّا؟
      </div>
      <div style={{position: 'absolute', left: (w - card) / 2, top: h / 2 - 130 * u, width: card, height: card * 1.12, borderRadius: 28 * u, background: C.elevated,
        border: `${5 * u}px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${k})`, boxShadow: `0 ${10 * u}px ${24 * u}px rgba(0,0,0,0.3)`}}>
        <div style={{position: 'absolute', left: card / 2, top: card * 0.44}}><FamAvatar p={pick} size={card * 0.56} /></div>
        <div style={{position: 'absolute', left: 0, right: 0, top: card * 0.76, textAlign: 'center', fontSize: 40 * u, fontWeight: 900, lineHeight: 1.3}}>{pick.name}</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 + 150 * u, textAlign: 'center', fontSize: 22 * u, fontWeight: 800, lineHeight: 1.4, color: C.success,
        transform: `scale(${k})`}}>
        صوتك انحسب.
      </div>
    </div>
  );
};
