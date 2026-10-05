import React from 'react';
import {C} from '../brand';
import {FONT} from '../parts';
import {b, spr, TEXT} from '../time';
import {SAFE} from './common';

/**
 * v2 caption style (common.tsx AdCaption: Cairo 900 cream, soft dark shadow, *hot* words in ink on a tilted colour
 * box, sizes 96 / 84) for Arabic, RTL. Kept separate from AdCaption because Arabic marks (the shadda on «كلّن»,
 * «إلّا», «برّا», the dots under ب/ي, the tails of و/ر) reach past the 0.32 em rise mask AdCaption uses for boxed
 * words: here the mask is 0.5 em and the exit travel is scaled to it, so no mark is clipped or left as a speck.
 * Words rise right-to-left, `step` apart (≤ 150 ms for a whole line). A lone `|` forces a line break.
 */
export const ArCaption: React.FC<{f: number; text: string; y: number; start: number; end?: number; size?: 84 | 96 | number; step?: number; accent?: string}> = ({
  f, text, y, start, end, size = 84, step = b(0.08), accent = C.accent,
}) => {
  const words = text.split(' ');
  let hot = 0;
  return (
    <div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: y - size * 1.2, height: size * 2.4, display: 'flex', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.25, color: C.text, zIndex: 90, direction: 'rtl',
      textShadow: `0 ${size * 0.05}px ${size * 0.22}px rgba(14,6,28,0.75), 0 0 ${size * 0.04}px rgba(14,6,28,0.9)`}}>
      <span style={{display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.26em', rowGap: '0.04em'}}>
        {words.map((w, i) => {
          if (w === '|') return <span key={i} style={{flexBasis: '100%', height: 0}} />; // forced line break
          const isHot = w.startsWith('*');
          const clean = w.replace(/\*/g, '');
          const tilt = isHot ? (hot++ % 2 ? 2 : -2) : 0;
          return (
            <ArRise key={i} f={f} start={start + i * step} end={end === undefined ? undefined : end + i * step * 0.35}>
              {isHot ? (
                <span style={{display: 'inline-block', background: accent, color: C.ink, padding: '0 0.22em 0.02em', borderRadius: '0.16em', transform: `rotate(${tilt}deg)`,
                  textShadow: 'none', boxShadow: '0 0.08em 0.25em rgba(10,4,20,0.35)'}}>{clean}</span>
              ) : (
                clean
              )}
            </ArRise>
          );
        })}
      </span>
    </div>
  );
};

/** parts.tsx Rise with a 0.5 em mask pad (Arabic marks), TEXT spring in, a short exit (−60 % + fade, ~7 f) so it clears before the next line rises. */
export const ArRise: React.FC<{f: number; start: number; end?: number; children: React.ReactNode}> = ({f, start, end, children}) => {
  if (f < start) return null;
  const pin = spr(f, start, TEXT);
  const pout = end === undefined ? 0 : spr(f, end, {damping: 34, stiffness: 480});
  if (pout > 0.9) return null;
  const y = (1 - pin) * 140 - pout * 60;
  return (
    <span style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', padding: '0.5em 0.12em', margin: '-0.5em -0.12em'}}>
      <span style={{display: 'inline-block', transform: `translateY(${y}%)`, opacity: 1 - pout}}>{children}</span>
    </span>
  );
};
