import React from 'react';
import {C} from '../brand';
import {FONT} from '../parts';
import {b, spr, SNAPPY} from '../time';
import {SAFE} from './common';

/**
 * AdCaption (common.tsx, rtl) with a taller rise mask: Arabic descenders (the dot of ب, the tail of و/ر)
 * and the shadda above sit outside the default 0.18 em pad and were being clipped.
 */
export const ArCaption: React.FC<{f: number; text: string; y: number; start: number; end?: number; size?: number; step?: number; accent?: string}> = ({
  f, text, y, start, end, size = 78, step = b(0.12), accent = C.accent,
}) => {
  const words = text.split(' ');
  return (
    <div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: y - size, height: size * 2, display: 'flex', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.04, color: C.text, zIndex: 90,
      WebkitTextStroke: `${size * 0.075}px ${C.bg}`, paintOrder: 'stroke fill', direction: 'rtl'}}>
      <span style={{display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.28em'}}>
        {words.map((w, i) => {
          const hot = w.startsWith('*');
          return (
            <ArRise key={i} f={f} start={start + i * step} end={end === undefined ? undefined : end + i * step * 0.35}>
              <span style={{color: hot ? accent : undefined}}>{w.replace(/\*/g, '')}</span>
            </ArRise>
          );
        })}
      </span>
    </div>
  );
};

/** parts.tsx Rise with a 0.42 em mask pad and travel scaled to it, so Arabic marks never peek out of the mask. */
export const ArRise: React.FC<{f: number; start: number; end?: number; children: React.ReactNode}> = ({f, start, end, children}) => {
  if (f < start) return null;
  const pin = spr(f, start, SNAPPY);
  const pout = end === undefined ? 0 : spr(f, end, {damping: 30, stiffness: 260});
  if (pout > 0.97) return null;
  const y = (1 - pin) * 150 - pout * 200;
  return (
    <span style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', padding: '0.42em 0.08em', margin: '-0.42em -0.08em'}}>
      <span style={{display: 'inline-block', transform: `translateY(${y}%)`}}>{children}</span>
    </span>
  );
};
