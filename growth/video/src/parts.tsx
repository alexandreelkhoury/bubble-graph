import React from 'react';
import {C, Shape} from './brand';
import {clamp, lerp, spr, SpringCfg, SNAPPY, TEXT} from './time';

export const FONT = 'Cairo';

// 100 x 100 shape paths (the app's avatar shapes).
const SHAPE_PATH: Record<Shape, string> = {
  circle: 'M50 4a46 46 0 1 1 0 92a46 46 0 1 1 0-92z',
  square: 'M22 6h56a16 16 0 0 1 16 16v56a16 16 0 0 1-16 16H22A16 16 0 0 1 6 78V22A16 16 0 0 1 22 6z',
  star: 'M50 3l13.6 29.2 32 3.8-23.6 21.8 6.3 31.6L50 73.6 21.7 89.4 28 57.8 4.4 36l32-3.8z',
  triangle: 'M50 6c3 0 5.6 1.6 7 4.2l38 68c2.9 5.3-.9 11.8-7 11.8H12c-6.1 0-9.9-6.5-7-11.8l38-68C44.4 7.6 47 6 50 6z',
  diamond: 'M44 6.6a8.5 8.5 0 0 1 12 0l37.4 37.4a8.5 8.5 0 0 1 0 12L56 93.4a8.5 8.5 0 0 1-12 0L6.6 56a8.5 8.5 0 0 1 0-12z',
  hexagon: 'M50 4l40 23v46L50 96 10 73V27z',
};

export const Avatar: React.FC<{shape: Shape; color: string; size: number; initial?: string; cream?: boolean; style?: React.CSSProperties}> = ({shape, color, size, initial, cream, style}) => (
  <div style={{position: 'absolute', width: size, height: size, left: -size / 2, top: -size / 2, ...style}}>
    <svg viewBox="0 0 100 100" width={size} height={size} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <path d={SHAPE_PATH[shape]} fill={color} />
    </svg>
    {initial ? (
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingTop: shape === 'triangle' ? size * 0.16 : 0,
        fontFamily: FONT, fontWeight: 900, fontSize: size * (shape === 'triangle' || shape === 'star' ? 0.32 : 0.42), lineHeight: 1,
        color: cream ? C.text : C.ink}}>{initial}</div>
    ) : null}
  </div>
);

/** Absolutely placed box centred on (x, y). */
export const At: React.FC<{x: number; y: number; z?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({x, y, z, children, style}) => (
  <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: z, ...style}}>{children}</div>
);

/**
 * Text that rises out of a mask line: in at `start` (spring), out (rising up and away) at `end`.
 * Renders nothing before it starts or after it has fully left.
 */
export const Rise: React.FC<{f: number; start: number; end?: number; children: React.ReactNode; cfg?: SpringCfg; style?: React.CSSProperties; pad?: number}> = ({f, start, end, children, cfg = TEXT, style, pad = 0.18}) => {
  if (f < start) return null;
  const pin = spr(f, start, cfg);
  const pout = end === undefined ? 0 : spr(f, end, {damping: 30, stiffness: 260});
  if (pout > 0.97) return null;
  // exit travels further than the mask so outlined (stroked) text never leaves specks at the mask edge
  const y = (1 - pin) * 110 - pout * 145;
  return (
    <span style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', padding: `${pad}em 0.06em`, margin: `-${pad}em -0.06em`, ...style}}>
      <span style={{display: 'inline-block', transform: `translateY(${y}%)`}}>{children}</span>
    </span>
  );
};

/** A line of words rising one by one, `step` frames apart. Words can carry their own colour with `*word*`. */
/**
 * A line of words rising one by one, `step` frames apart. `*word*` marks a hot word: coloured, or — with `boxed`
 * (v2 captions) — set in ink on a slightly tilted colour box, which reads at thumbnail size on any background.
 */
export const Words: React.FC<{f: number; text: string; start: number; step: number; end?: number; accent?: string; style?: React.CSSProperties; pad?: number; boxed?: boolean}> = ({f, text, start, step, end, accent = C.accent, style, pad, boxed}) => {
  const words = text.split(' ');
  let hotIndex = 0;
  return (
    <span style={{display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.28em', rowGap: boxed ? '0.12em' : undefined, ...style}}>
      {words.map((w, i) => {
        const hot = w.startsWith('*');
        const clean = w.replace(/\*/g, '');
        const tilt = hot ? (hotIndex++ % 2 ? 2 : -2) : 0;
        return (
          <Rise key={i} f={f} start={start + i * step} end={end === undefined ? undefined : end + i * step * 0.35} pad={boxed ? 0.32 : pad}>
            {hot && boxed ? (
              <span style={{display: 'inline-block', background: accent, color: C.ink, padding: '0.02em 0.22em 0.06em', borderRadius: '0.16em',
                transform: `rotate(${tilt}deg)`, textShadow: 'none', WebkitTextStroke: '0px transparent', boxShadow: '0 0.08em 0.25em rgba(10,4,20,0.35)'}}>{clean}</span>
            ) : (
              <span style={{color: hot ? accent : undefined}}>{clean}</span>
            )}
          </Rise>
        );
      })}
    </span>
  );
};

/** Phone body around a screen rect (centre x,y). `bezel` 0..1 grows the frame out of the screen edge. */
export const PhoneFrame: React.FC<{w: number; h: number; bezel?: number; screen: string; children?: React.ReactNode; island?: boolean}> = ({w, h, bezel = 1, screen, children, island = true}) => {
  const t = Math.max(3, w * 0.035) * bezel;
  const r = w * 0.14;
  return (
    <div style={{position: 'absolute', left: -w / 2 - t, top: -h / 2 - t, width: w + 2 * t, height: h + 2 * t, borderRadius: r + t,
      background: '#05030A', boxShadow: bezel > 0 ? `0 ${w * 0.08}px ${w * 0.2}px rgba(0,0,0,${0.45 * bezel})` : undefined}}>
      <div style={{position: 'absolute', left: t, top: t, width: w, height: h, borderRadius: r, background: screen, overflow: 'hidden'}}>
        {children}
        {island && bezel > 0.05 ? (
          <div style={{position: 'absolute', left: '50%', top: h * 0.022, width: w * 0.3, height: w * 0.085, marginLeft: -w * 0.15,
            borderRadius: 999, background: '#05030A', transform: `scale(${clamp(bezel)})`}} />
        ) : null}
      </div>
    </div>
  );
};

/** The Mish Ana! mark (assets/brand/mark.svg) built in three parts so they can animate separately. */
export const Mark: React.FC<{size: number; bubble: number; stroke: number; dot?: number; tile?: number}> = ({size, bubble, stroke, dot = 1, tile = 0}) => (
  <svg viewBox="0 0 160 160" width={size} height={size} style={{position: 'absolute', left: -size / 2, top: -size / 2, overflow: 'visible'}}>
    {tile > 0 ? <rect x="0" y="0" width="160" height="160" rx="36" fill={C.bgDeep} opacity={tile} /> : null}
    <g transform={`translate(80 68) scale(${bubble}) translate(-80 -68)`}>
      <path d="M54 20L106 20C122.57 20 136 33.43 136 50L136 86C136 102.57 122.57 116 106 116L54 116C37.43 116 24 102.57 24 86L24 50C24 33.43 37.43 20 54 20ZM36 100L70 112L26 142Z" fill={C.primary} />
    </g>
    <clipPath id="strokeclip"><rect x="60" y={lerp(84, 28, stroke)} width="40" height="60" /></clipPath>
    <path clipPath="url(#strokeclip)" d="M83.37 31.84L83.37 31.84C87.61 31.84 90.57 35.28 89.97 39.52L85.39 72.16C84.79 76.4 80.87 79.84 76.63 79.84L76.63 79.84C72.39 79.84 69.43 76.4 70.03 72.16L74.61 39.52C75.21 35.28 79.13 31.84 83.37 31.84Z" fill={C.text} />
    <g transform={`translate(78.08 95.84) scale(${dot}) translate(-78.08 -95.84)`}>
      <circle cx="78.08" cy="95.84" r="8.32" fill={C.accent} />
    </g>
  </svg>
);

/** Speech bubble (cream) centred above (0,0), popping on a spring. */
export const Bubble: React.FC<{text: string; s: number; size: number; tone?: 'cream' | 'amber'}> = ({text, s, size, tone = 'cream'}) => {
  if (s <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: 0, bottom: 0, transform: `translateX(-50%) scale(${s})`, transformOrigin: '50% 100%'}}>
      <div style={{position: 'relative', background: tone === 'amber' ? C.accent : C.text, color: C.ink, fontFamily: FONT, fontWeight: 800,
        fontSize: size, lineHeight: 1.1, padding: `${size * 0.28}px ${size * 0.6}px`, borderRadius: size * 0.7, whiteSpace: 'nowrap'}}>
        {text}
        <div style={{position: 'absolute', left: '50%', bottom: -size * 0.32, marginLeft: -size * 0.3, width: 0, height: 0,
          borderLeft: `${size * 0.3}px solid transparent`, borderRight: `${size * 0.3}px solid transparent`,
          borderTop: `${size * 0.36}px solid ${tone === 'amber' ? C.accent : C.text}`}} />
      </div>
    </div>
  );
};

/**
 * The real phone role-reveal screen (DESIGN PH-04 / §6.2 A), drawn into a phone screen of w x h:
 * dark screen, room-code chip + avatar/name, "Your secret word", and a card in the player's colour that
 * flips (2D squash) from face-down to the word at `flipAt`. The Mole's screen is identical (only the word differs).
 */
export const WordFace: React.FC<{f: number; w: number; h: number; name: string; shape: Shape; color: string; cream: boolean;
  word: string; flipAt: number; code?: string; contentIn?: number; out?: number}> = ({f, w, h, name, shape, color, cream, word, flipAt, code = 'JQPU', contentIn = -999, out = 1e9}) => {
  // size from the phone proportions, so a wide rect (mid-morph) never makes the content collide
  const u = Math.min(w / 300, h / 625);
  const FLIP = 12;
  const t = clamp((f - flipAt) / FLIP);
  const sx = Math.abs(Math.cos(Math.PI * t));
  const face = t >= 0.5;
  const cw = 240 * u, ch = 262 * u;
  const darkFace = cream; // grape / plum: the face is `elevated` with cream text
  const faceBg = darkFace ? C.elevated : color;
  const back = mixHex(C.surface, color, 0.18);
  const gone = f >= out ? spr(f, out, {damping: 30, stiffness: 260}) : 0;
  const k = (1 - gone) * (contentIn > -999 ? spr(f, contentIn, SNAPPY) : 1);
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text}}>
      <div style={{position: 'absolute', top: h / 2 - 248 * u, left: w / 2 - 132 * u, width: 264 * u, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transform: `translateY(${(1 - k) * -24 * u}px) scale(${k})`}}>
        <div style={{fontSize: 15 * u, fontWeight: 900, color: C.accent, background: C.surface, borderRadius: 99, padding: `${3 * u}px ${10 * u}px`, letterSpacing: '0.08em'}}>{code}</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 6 * u, fontSize: 15 * u, fontWeight: 800}}>
          <div style={{position: 'relative', width: 22 * u, height: 22 * u}}>
            <div style={{position: 'absolute', left: 11 * u, top: 11 * u}}><Avatar shape={shape} color={color} size={22 * u} /></div>
          </div>
          {name}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 - 175 * u, textAlign: 'center', fontSize: 20 * u, fontWeight: 800, color: C.text2, transform: `scale(${k})`}}>
        Your secret word
      </div>
      <div style={{position: 'absolute', left: (w - cw) / 2, top: h / 2 - 125 * u, width: cw, height: ch, transform: `scaleX(${sx}) scale(${k})`, borderRadius: 22 * u,
        background: face ? faceBg : back, border: face ? undefined : `${1.5 * u}px solid ${mixHex(C.outline, color, 0.4)}`, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 ${10 * u}px ${24 * u}px rgba(0,0,0,0.35)`}}>
        {face ? (
          <div style={{fontSize: (word.length > 6 ? 46 : 56) * u, fontWeight: 900, color: darkFace ? C.text : C.ink, letterSpacing: '0.01em'}}>{word}</div>
        ) : (
          <div style={{textAlign: 'center', fontSize: 14 * u, fontWeight: 700, color: C.text2, lineHeight: 1.35, padding: `0 ${18 * u}px`}}>
            <div style={{fontSize: 22 * u, color: color, marginBottom: 8 * u, letterSpacing: '0.3em', fontWeight: 900}}>! · ! · !</div>
            Press and hold<br />to see your word
          </div>
        )}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 + 160 * u, textAlign: 'center', fontSize: 13 * u, fontWeight: 600, color: C.muted, transform: `scale(${k})`}}>
        Make sure nobody’s looking.
      </div>
    </div>
  );
};

const mixHex = (a: string, c: string, t: number) => {
  const p = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const A = p(a), B = p(c);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
