// M4 v2 TV phase: the TV drawn 1:1 (tiles, clue bubbles, OUT stamp and role line at full size, never inside a
// scaled-down TV), the phones' vote screen, and the votes flying from the phones to Sami's tile.
import React from 'react';
import {C} from '../brand';
import {At, Avatar, Bubble, FONT, Rise} from '../parts';
import {b, clamp, easeIn, easeInOut, easeOut, lerp, POP, prog, SOFT, spr, TEXT} from '../time';
import {CAST, CLUE_BY, CLUE_TEXT, MOLE, ROW, RH, SLOT, T, TH, tileLX, tileWorld, TILE_Y, TV, TW, tvWorld, voteLand, VOTERS} from './m4-grid';

const S = () => b(T.stamp);

/** Tiles on the TV screen (local coordinates). */
const TvScreen: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.tvOn);
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text}}>
      {CAST.map((p, i) => {
        const x = tileLX(SLOT[i]);
        const s = spr(f, t0 + 2 + SLOT[i] * 2, POP);
        const out = i === MOLE && f >= S();
        // after "Boiled?" the others' tiles tip towards Sami
        const tip = i !== MOLE ? (SLOT[i] < 2 ? 5 : -5) * (spr(f, b(T.glance), SOFT) - spr(f, b(T.vote), SOFT)) : 0;
        return (
          <div key={p.name} style={{position: 'absolute', left: x - TW / 2, top: TILE_Y - TH / 2, width: TW, height: TH, borderRadius: 28, background: C.elevated,
            boxShadow: out ? `inset 0 0 0 5px ${C.accent}` : 'inset 0 0 0 2px rgba(255,247,236,0.22)', transform: `scale(${s}) rotate(${tip}deg)`}}>
            <At x={TW / 2} y={78}>
              <Avatar shape={p.shape} color={p.color} size={108} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${spr(f, t0 + 4 + SLOT[i] * 2, POP)})`}} />
            </At>
            <div style={{position: 'absolute', left: 0, right: 0, top: 142, textAlign: 'center', fontSize: 34, fontWeight: 800}}>
              <Rise f={f} start={t0 + 5 + SLOT[i] * 2}>{p.name}</Rise>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** The TV: a magenta line opens straight into the lit screen (no dark iris), bezel and stand grow after. */
export const Tv: React.FC<{f: number}> = ({f}) => {
  const L0 = b(T.line), O0 = b(T.open);
  if (f < L0 - 1) return null;
  const lw = TV.w * prog(f, L0, O0, easeOut);
  const oh = prog(f, O0, O0 + b(0.5), easeInOut);
  const h = lerp(12, TV.h, oh);
  const r = lerp(6, 24, oh);
  const bezel = 13 * prog(f, O0 + b(0.3), O0 + b(0.6), easeOut);
  const stand = spr(f, O0 + b(0.45), SOFT);
  const line = 1 - prog(f, O0, O0 + b(0.35), easeOut);
  return (
    <At x={TV.x} y={TV.y} z={20}>
      {stand > 0.01 ? (
        <div style={{position: 'absolute', left: -120, top: TV.h / 2 + bezel - 2, width: 240, height: 30 * stand, background: '#120A20', borderRadius: '0 0 16px 16px'}} />
      ) : null}
      <div style={{position: 'absolute', left: -lw / 2 - bezel, top: -h / 2 - bezel, width: lw + 2 * bezel, height: h + 2 * bezel, borderRadius: r + bezel,
        background: bezel > 0.3 ? '#120A20' : 'transparent', boxShadow: bezel > 0.3 ? '0 30px 80px rgba(0,0,0,0.4), 0 0 120px rgba(140,90,240,0.35)' : undefined}}>
        <div style={{position: 'absolute', left: bezel, top: bezel, width: lw, height: h, borderRadius: r, overflow: 'hidden',
          background: `radial-gradient(120% 100% at 30% 0%, #6A42B0 0%, #4A2C84 45%, ${C.surface} 100%)`, boxShadow: `inset 0 0 0 ${6 * line}px ${C.primary}`}}>
          {line > 0.02 ? <div style={{position: 'absolute', inset: 0, background: C.primary, opacity: line}} /> : null}
          {f >= b(T.tvOn) - 2 ? (
            <div style={{position: 'absolute', left: (lw - TV.w) / 2, top: (h - TV.h) / 2, width: TV.w, height: TV.h}}>
              <TvScreen f={f} />
            </div>
          ) : null}
        </div>
      </div>
    </At>
  );
};

/** Clue bubbles, world layer, 56 px. Edge bubbles are nudged inside the safe zone. */
export const Clues: React.FC<{f: number}> = ({f}) => (
  <>
    {CLUE_BY.map((ci, k) => {
      const tile = tileWorld(ci);
      const start = b(T.clues[k]);
      const gone = spr(f, b(T.vote) - 4 + k * 2, {damping: 26, stiffness: 300});
      const s = spr(f, start, POP) * (1 - gone);
      const nudge = SLOT[ci] === 0 ? 24 : SLOT[ci] === 4 ? -10 : 0;
      return (
        <At key={k} x={tile.x + nudge} y={tile.y - TH / 2 - 22} z={50}>
          <Bubble text={CLUE_TEXT[k]} s={s} size={56} />
        </At>
      );
    })}
  </>
);

/** Votes fly in pairs from the voters' phones to Sami's tile, then stack under it. */
export const Votes: React.FC<{f: number}> = ({f}) => {
  const tile = tileWorld(MOLE);
  const gone = spr(f, S() + 6, {damping: 26, stiffness: 300});
  return (
    <>
      {VOTERS.map((ci, k) => {
        const t1 = voteLand(k), t0 = t1 - b(0.75);
        if (f < t0) return null;
        const from = {x: ROW[ci].x, y: ROW[ci].y - RH / 2 + 40};
        const to = {x: tile.x + (k - 1.5) * 52, y: tile.y + TH / 2 + 46};
        const t = prog(f, t0, t1, easeInOut);
        const x = lerp(from.x, to.x, t), y = lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * 160;
        const k2 = (f >= t1 ? 1 + 0.4 * (1 - spr(f, t1, POP)) : spr(f, t0, POP)) * (1 - gone);
        if (k2 < 0.01) return null;
        return (
          <At key={k} x={x} y={y} z={55}>
            <div style={{position: 'absolute', left: -24, top: -24, width: 48, height: 48, borderRadius: 99, background: CAST[ci].color,
              border: `5px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${k2})`, boxShadow: '0 6px 14px rgba(0,0,0,0.3)'}} />
          </At>
        );
      })}
    </>
  );
};

/** The TV's verdict: amber OUT, -8°, slams onto Sami's tile (world layer: nothing clips it). */
export const Stamp: React.FC<{f: number}> = ({f}) => {
  const s0 = S();
  if (f < s0 - 6) return null;
  const tile = tileWorld(MOLE);
  const slam = f < s0 ? lerp(1.8, 1, easeIn(prog(f, s0 - 6, s0, (x) => x))) : 1 + 0.08 * (1 - spr(f, s0, POP));
  return (
    <At x={tile.x} y={tile.y + 6} z={60}>
      <div style={{position: 'absolute', left: -128, top: -56, width: 256, height: 112, borderRadius: 20, background: C.accent, boxSizing: 'border-box',
        border: `6px solid ${C.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 82,
        color: C.ink, letterSpacing: '0.06em', boxShadow: '0 18px 44px rgba(0,0,0,0.4)', transform: `rotate(-8deg) scale(${slam})`}}>
        OUT
      </div>
    </At>
  );
};

/** "Sami was the Mole", 78 px, on the TV's lower band (the TV is 1:1, so this is real size). */
export const RoleLine: React.FC<{f: number}> = ({f}) => {
  const p = tvWorld(TV.w / 2, 470);
  return (
    <div style={{position: 'absolute', left: TV.x - TV.w / 2, width: TV.w, top: p.y - 50, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, fontWeight: 900, fontSize: 78, lineHeight: 1, color: C.text, zIndex: 58, textShadow: '0 4px 18px rgba(14,6,28,0.6)'}}>
      <Rise f={f} start={b(T.role)}><span style={{color: CAST[MOLE].color}}>Sami</span></Rise>
      <span style={{width: '0.28em'}} />
      <Rise f={f} start={b(T.role) + 4}>was</Rise>
      <span style={{width: '0.28em'}} />
      <Rise f={f} start={b(T.role) + 8}>the</Rise>
      <span style={{width: '0.28em'}} />
      <Rise f={f} start={b(T.role) + 12}><span style={{color: C.accent}}>Mole</span></Rise>
    </div>
  );
};

/** The phone's vote screen (dark, like the app): "Who's the Mole?", the other four players, one gets tapped. */
export const VoteFace: React.FC<{f: number; w: number; h: number; self: number; target: number; inAt: number; tapAt: number; outAt: number}> = ({f, w, h, self, target, inAt, tapAt, outAt}) => {
  const u = Math.min(w / 300, h / 625);
  const k = spr(f, inAt, TEXT) * (1 - spr(f, outAt, {damping: 30, stiffness: 260}));
  if (k < 0.001) return null;
  const others = CAST.map((_, i) => i).filter((i) => i !== self);
  const tap = spr(f, tapAt, POP);
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text, transform: `translateY(${(1 - k) * 40 * u}px)`, opacity: clamp(k * 1.4)}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 - 230 * u, textAlign: 'center', fontSize: 30 * u, fontWeight: 900, lineHeight: 1.1}}>
        Who’s the<br />Mole?
      </div>
      {others.map((i, n) => {
        const cx = w / 2 + (n % 2 ? 62 : -62) * u, cy = h / 2 + (n < 2 ? -40 : 110) * u;
        const hit = i === target;
        return (
          <At key={i} x={cx} y={cy}>
            <div style={{position: 'absolute', left: -56 * u, top: -56 * u, width: 112 * u, height: 112 * u, borderRadius: 26 * u,
              background: hit ? `rgba(255,201,77,${0.25 * tap})` : C.surface, boxShadow: hit && tap > 0.01 ? `inset 0 0 0 ${5 * u}px ${C.accent}` : undefined,
              transform: `scale(${hit ? 1 + 0.12 * Math.sin(Math.PI * clamp(tap)) : 1})`}} />
            <Avatar shape={CAST[i].shape} color={CAST[i].color} size={70 * u} style={{transform: `translateY(${-8 * u}px)`}} />
            <div style={{position: 'absolute', left: -60 * u, width: 120 * u, top: 30 * u, textAlign: 'center', fontSize: 17 * u, fontWeight: 800}}>{CAST[i].name}</div>
          </At>
        );
      })}
    </div>
  );
};

/** Frames when phone `i` taps its vote (= its dot's launch). Sami deflects on Joe. */
export const tapTime = (i: number) => {
  const k = VOTERS.indexOf(i);
  return k >= 0 ? voteLand(k) - b(0.75) : b(T.votes[2]) - b(0.4);
};
export const voteTarget = (i: number) => (i === MOLE ? 3 : MOLE);
