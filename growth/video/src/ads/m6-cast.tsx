import React from 'react';
import {C} from '../brand';

/**
 * M6 family cast: the app's 12 player swatches (tv-app Constants.kt) in join order.
 * Index 0 sits top-right (RTL reading order). Khalo (index 5) is the Mole: فتوش.
 * v2: lifted colours (brand.ts); Khalo is lilac #C9BFFF like Sami (DECISIONS #8: the Mole's colour
 * must not hint amber/orange, and aqua read too close to Baba's jade card), so Rami takes tangerine and Nour aqua.
 * Pair p001 of word-packs/packs/ar/lb-food-01.json: civilian تبولة / undercover فتوش.
 */
export type Glyph = 'circle' | 'square' | 'star' | 'triangle' | 'diamond' | 'hexagon' | 'plus' | 'drop' | 'bolt' | 'flower' | 'arch';
export type Fam = {name: string; color: string; glyph: Glyph; cream: boolean};

export const CIVIL = 'تبولة';
export const UNDER = 'فتوش';

export const FAM: Fam[] = [
  {name: 'تيتا', color: '#FF3355', glyph: 'circle', cream: false},
  {name: 'جدّو', color: '#5A9BFF', glyph: 'square', cream: false},
  {name: 'ماما', color: '#FFF04D', glyph: 'star', cream: false},
  {name: 'بابا', color: '#2BC49F', glyph: 'triangle', cream: false},
  {name: 'عمّتو', color: '#9A6BFF', glyph: 'diamond', cream: true},
  {name: 'خالو', color: '#C9BFFF', glyph: 'hexagon', cream: false},
  {name: 'رامي', color: '#FF8A33', glyph: 'plus', cream: false},
  {name: 'لين', color: '#FF96C5', glyph: 'drop', cream: false},
  // mint's in-app glyph is a crescent; drawn as a circle here to keep the ad free of anything read as a symbol
  {name: 'كريم', color: '#BDF5C8', glyph: 'circle', cream: false},
  {name: 'سارة', color: '#C02A8F', glyph: 'bolt', cream: true},
  {name: 'هادي', color: '#E6C486', glyph: 'flower', cream: false},
  {name: 'نور', color: '#7BFFF4', glyph: 'arch', cream: false},
];
export const MOLE_I = 5;

const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

// AvatarGlyphs (tv-app Icons.kt), 24 x 24 grid.
const GLYPH: Record<Glyph, string> = {
  circle: circ(12, 12, 9),
  square: 'M7 3.5h10a3.5 3.5 0 0 1 3.5 3.5v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5z',
  star: 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z',
  triangle: 'M12 3.2 21.4 19.8H2.6z',
  diamond: 'M12 2.2 21.8 12 12 21.8 2.2 12z',
  hexagon: 'M12 2.6 20.2 7.3v9.4L12 21.4 3.8 16.7V7.3z',
  plus: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  drop: 'M12 2.5S5 10.4 5 15a7 7 0 0 0 14 0c0-4.6-7-12.5-7-12.5z',
  bolt: 'M13.5 2 5 13.5h6L10 22l9-12h-6.2z',
  flower: [circ(12, 7.4, 4.6), circ(16.6, 12, 4.6), circ(12, 16.6, 4.6), circ(7.4, 12, 4.6), circ(12, 12, 4)].join(''),
  arch: 'M5 21.5V11a7 7 0 0 1 14 0v10.5h-4.5V15a2.5 2.5 0 0 0-5 0v6.5z',
};

/** The app's avatar (DESIGN §5.2): a squircle in the player colour with the shape glyph at 62 %, centred on (0,0). */
export const FamAvatar: React.FC<{p: Fam; size: number; style?: React.CSSProperties}> = ({p, size, style}) => (
  <div style={{position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: '30%', background: p.color, ...style}}>
    <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} style={{position: 'absolute', left: size * 0.19, top: size * 0.19}}>
      <path d={GLYPH[p.glyph]} fill={p.cream ? C.text : C.ink} />
    </svg>
  </div>
);
