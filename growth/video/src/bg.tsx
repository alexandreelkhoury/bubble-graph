import React from 'react';
import {C} from './brand';

/**
 * v2 stage background ("Evolved Current", review-v2/DECISIONS.md #1): night violet lit like a party — a purple glow
 * from the top, a warm amber rim from the bottom-right, a magenta bounce on the left and fine static grain.
 * Shared by the film, the ads and the background flood, so every hand-off matches.
 */
export const StageBg: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: `linear-gradient(180deg, ${C.bg} 0%, #24124A 55%, ${C.bgDeep} 100%)`}}>
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(90% 55% at 50% -5%, rgba(140,80,230,0.62) 0%, rgba(140,80,230,0) 70%)'}} />
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(70% 45% at 105% 100%, rgba(255,201,77,0.20) 0%, rgba(255,201,77,0) 70%)'}} />
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(60% 50% at -10% 60%, rgba(255,79,154,0.16) 0%, rgba(255,79,154,0) 70%)'}} />
    <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity: 0.07, mixBlendMode: 'overlay'}}>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" /></filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </div>
);
