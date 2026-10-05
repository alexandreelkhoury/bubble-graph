import React from 'react';
import {C, Player} from '../brand';
import {At, Avatar, FONT, Rise} from '../parts';
import {spr, POP} from '../time';

/**
 * M1 helpers (v2). Everything is drawn in screen space; the TV is only a bezel + lit screen around a centre/zoom,
 * so the tiles, bubbles and lines that sit "on" the TV are never rendered inside a scaled-down group.
 */

/** Virtual TV screen half-size at zoom 1 (the stage zoom, where the screen overflows the frame left/right). */
export const TV_HW = 960;
export const TV_HH = 520;

/** TV: dark bezel with a cream rim light, a lit violet screen and a magenta room glow. Centre (cx, cy), zoom z. */
export const Tv: React.FC<{cx: number; cy: number; z: number}> = ({cx, cy, z}) => {
  const w = TV_HW * 2 * z, h = TV_HH * 2 * z, t = 34 * z;
  return (
    <div style={{position: 'absolute', left: cx - w / 2 - t, top: cy - h / 2 - t, width: w + 2 * t, height: h + 2 * t, borderRadius: 40 * z + t,
      background: '#120A20', boxShadow: `0 0 0 ${Math.max(2, 3 * z)}px rgba(255,247,236,0.32), 0 ${60 * z}px ${140 * z}px rgba(10,4,20,0.5), 0 0 ${260 * z}px rgba(255,79,154,0.35)`}}>
      <div style={{position: 'absolute', left: t, top: t, width: w, height: h, borderRadius: 40 * z, overflow: 'hidden',
        background: 'radial-gradient(90% 80% at 50% 0%, #A866E6 0%, #7440C2 42%, #4E2690 100%)'}}>
        {/* soft glare */}
        <div style={{position: 'absolute', left: '-10%', top: '-30%', width: '70%', height: '90%', borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(255,247,236,0.16), rgba(255,247,236,0))'}} />
      </div>
      {/* feet */}
      {[-1, 1].map((s) => (
        <div key={s} style={{position: 'absolute', left: (w + 2 * t) / 2 + s * w * 0.36 - 40 * z, top: h + 2 * t - 4 * z, width: 80 * z, height: 46 * z,
          background: '#120A20', borderRadius: `0 0 ${14 * z}px ${14 * z}px`, transform: `skewX(${s * -14}deg)`}} />
      ))}
    </div>
  );
};

/** A player tile on the TV (avatar + name), w x h, centred on (0,0). */
export const Tile: React.FC<{f: number; p: Player; w: number; h: number; inAt: number; ring?: number; sat?: number}> = ({f, p, w, h, inAt, ring = 0, sat = 1}) => {
  const a = spr(f, inAt, POP);
  return (
    <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: w * 0.12, background: '#4A2E7A', fontFamily: FONT,
      boxShadow: `0 0 0 ${2 + 6 * ring}px ${ring > 0.01 ? C.accent : 'rgba(255,247,236,0.18)'}, 0 ${w * 0.06}px ${w * 0.14}px rgba(14,6,28,0.4)`,
      filter: sat < 1 ? `saturate(${sat})` : undefined}}>
      <At x={w / 2} y={h * 0.42}>
        <Avatar shape={p.shape} color={p.color} size={w * 0.52} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${a})`}} />
      </At>
      <div style={{position: 'absolute', left: 0, right: 0, top: h * 0.74, textAlign: 'center', fontSize: w * 0.15, fontWeight: 800, color: C.text, lineHeight: 1.1}}>
        <Rise f={f} start={inAt + 4}>{p.name}</Rise>
      </div>
    </div>
  );
};

/** Clue bubble (screen space, ≥ 52 px): anchored at (0,0) on its tail tip; `down` puts the bubble below the anchor. */
export const Clue: React.FC<{text: string; s: number; size: number; amber?: boolean; down?: boolean}> = ({text, s, size, amber, down}) => {
  if (s <= 0.001) return null;
  const bg = amber ? C.accent : C.text;
  const tail = size * 0.34;
  return (
    <div style={{position: 'absolute', left: 0, top: down ? tail : undefined, bottom: down ? undefined : tail, transform: `translateX(-50%) scale(${s})`,
      transformOrigin: down ? '50% 0%' : '50% 100%'}}>
      <div style={{position: 'relative', background: bg, color: C.ink, fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.1,
        padding: `${size * 0.26}px ${size * 0.55}px`, borderRadius: size * 0.7, whiteSpace: 'nowrap', boxShadow: '0 10px 26px rgba(14,6,28,0.4)'}}>
        {text}
        <div style={{position: 'absolute', left: '50%', marginLeft: -size * 0.3, width: 0, height: 0,
          borderLeft: `${size * 0.3}px solid transparent`, borderRight: `${size * 0.3}px solid transparent`,
          ...(down ? {top: -tail + 1, borderBottom: `${tail}px solid ${bg}`} : {bottom: -tail + 1, borderTop: `${tail}px solid ${bg}`})}} />
      </div>
    </div>
  );
};

/** The phone vote screen ("Who's lying?"), w x h; `tap` 0..1 fills Sami's button. Players listed in `cast`. */
export const VoteFace: React.FC<{w: number; h: number; cast: Player[]; pick: number; tap: number}> = ({w, h, cast, pick, tap}) => {
  const u = w / 300;
  const bw = 120 * u, bh = 132 * u;
  return (
    <div style={{position: 'absolute', inset: 0, background: C.bg, fontFamily: FONT, color: C.text}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 52 * u, textAlign: 'center', fontSize: 40 * u, fontWeight: 900}}>Who’s lying?</div>
      <div style={{position: 'absolute', left: (w - 2 * bw - 16 * u) / 2, top: 122 * u, width: 2 * bw + 16 * u, display: 'flex', flexWrap: 'wrap', gap: 16 * u}}>
        {cast.map((p, i) => {
          const on = i === pick ? tap : 0;
          return (
            <div key={i} style={{position: 'relative', width: bw, height: bh, borderRadius: 22 * u, background: on > 0.5 ? C.accent : C.surface,
              boxShadow: on > 0 ? `0 0 0 ${5 * u * on}px ${C.accent}` : `0 0 0 ${2 * u}px rgba(255,247,236,0.14)`, transform: `scale(${1 - 0.06 * Math.sin(Math.PI * Math.min(1, on * 2))})`}}>
              <At x={bw / 2} y={52 * u}><Avatar shape={p.shape} color={p.color} size={62 * u} initial={p.name[0]} cream={p.cream} /></At>
              <div style={{position: 'absolute', left: 0, right: 0, top: 92 * u, textAlign: 'center', fontSize: 25 * u, fontWeight: 800, color: on > 0.5 ? C.ink : C.text}}>{p.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
