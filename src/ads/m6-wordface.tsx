import React from 'react';
import {C} from '../brand';
import {FONT} from '../parts';
import {clamp, easeInOut, mix, POP, prog, SNAPPY, spr} from '../time';
import {Fam, FamAvatar} from './m6-cast';

/**
 * Arabic, right-to-left copy of parts.tsx WordFace (phone PH-04 "Your secret word" screen), strings from
 * shared/i18n/ar.json: reveal.yourWord / reveal.holdToSee / reveal.privacy. Dark screen, a card in the
 * player's colour that flips (2D squash) to the word at `flipAt`. The Mole's screen is identical.
 */
export const ArWordFace: React.FC<{f: number; w: number; h: number; p: Fam; word: string; flipAt: number; code?: string; contentIn?: number; out?: number}> = ({
  f, w, h, p, word, flipAt, code = 'JQPU', contentIn = -999, out = 1e9,
}) => {
  const u = Math.min(w / 300, h / 625);
  const t = prog(f, flipAt - 7, flipAt + 7, easeInOut);
  const sx = Math.max(0.02, Math.abs(Math.cos(Math.PI * t)));
  const face = t >= 0.5;
  const pop = face ? 1 + 0.07 * (1 - spr(f, flipAt + 7, POP)) : 1;
  const cw = 240 * u, ch = 262 * u;
  const faceBg = p.cream ? C.elevated : p.color;
  const back = mix(C.surface, p.color, 0.18);
  const gone = f >= out ? spr(f, out, {damping: 30, stiffness: 260}) : 0;
  const k = clamp((1 - gone) * (contentIn > -999 ? spr(f, contentIn, SNAPPY) : 1));
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text, direction: 'rtl'}}>
      {/* top bar: me (right), room code chip (left) */}
      <div style={{position: 'absolute', top: h / 2 - 260 * u, left: w / 2 - 132 * u, width: 264 * u, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transform: `translateY(${(1 - k) * -20 * u}px)`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 6 * u, fontSize: 17 * u, fontWeight: 800, lineHeight: 1}}>
          <div style={{position: 'relative', width: 22 * u, height: 22 * u}}>
            <div style={{position: 'absolute', left: 11 * u, top: 11 * u}}><FamAvatar p={p} size={22 * u} /></div>
          </div>
          {p.name}
        </div>
        <div style={{direction: 'ltr', fontSize: 15 * u, fontWeight: 900, color: C.accent, background: C.surface, borderRadius: 99, padding: `${3 * u}px ${10 * u}px`, letterSpacing: '0.08em'}}>{code}</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 - 190 * u, textAlign: 'center', fontSize: 22 * u, fontWeight: 800, color: C.text2, transform: `scale(${k})`}}>
        كلمتك السرّية
      </div>
      <div style={{position: 'absolute', left: (w - cw) / 2, top: h / 2 - 135 * u, width: cw, height: ch, transform: `scaleX(${sx}) scale(${k * pop})`, borderRadius: 22 * u,
        background: face ? faceBg : back, border: face ? undefined : `${1.5 * u}px solid ${mix(C.outline, p.color, 0.4)}`, boxSizing: 'border-box', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 ${10 * u}px ${24 * u}px rgba(0,0,0,0.35)`}}>
        {face ? (
          <div style={{fontSize: 66 * u, fontWeight: 900, lineHeight: 1.3, color: p.cream ? C.text : C.ink}}>{word}</div>
        ) : (
          <div style={{textAlign: 'center', fontSize: 19 * u, fontWeight: 700, color: C.text2, lineHeight: 1.35, padding: `0 ${18 * u}px`}}>
            <div style={{fontSize: 22 * u, color: p.color, marginBottom: 8 * u, letterSpacing: '0.3em', fontWeight: 900, direction: 'ltr'}}>! · ! · !</div>
            كبسة طويلة…<br />وبتبيّن كلمتك
          </div>
        )}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 + 150 * u, textAlign: 'center', fontSize: 15 * u, fontWeight: 600, color: C.muted, transform: `scale(${k})`}}>
        الأحسن ما حدا يكون عم يتطلّع.
      </div>
    </div>
  );
};
