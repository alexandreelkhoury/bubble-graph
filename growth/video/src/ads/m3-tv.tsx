import React from 'react';
import {C, Player, ROOM_CODE} from '../brand';
import {At, Avatar, FONT, Rise} from '../parts';
import {b, clamp, lerp, POP, prog, spr} from '../time';

/**
 * MA_C_M3 v2 helpers: the TV (frame + screens). Screen content is laid out in TV design units (1040 x 585, as
 * Film.tsx / m5-tv.tsx) and scaled to the TV. The TV is always big (≥ 800 px wide): nothing load-bearing lives in
 * it (captions carry the story), but its texts stay readable.
 */

export type Rect = {x: number; y: number; w: number; h: number};
export const DW = 1040;
export const DH = 585;

/** Screen point of a design-unit point (lx, ly) on a TV at rect r. */
export const tvPt = (r: Rect, lx: number, ly: number) => {
  const s = r.w / DW;
  return {x: r.x - r.w / 2 + lx * s, y: r.y - r.h / 2 + ly * s};
};

export const TvFrame: React.FC<{r: Rect; z?: number; children: React.ReactNode}> = ({r, z = 5, children}) => {
  const s = r.w / DW;
  const bezel = 13 * s;
  return (
    <At x={r.x} y={r.y} z={z}>
      {/* stand */}
      <div style={{position: 'absolute', left: -120 * s, top: r.h / 2 + bezel, width: 240 * s, height: 24 * s, background: '#140A26',
        borderRadius: `0 0 ${14 * s}px ${14 * s}px`}} />
      <div style={{position: 'absolute', left: -r.w / 2 - bezel, top: -r.h / 2 - bezel, width: r.w + 2 * bezel, height: r.h + 2 * bezel,
        borderRadius: 22 * s + bezel, background: '#140A26', boxShadow: `0 ${26 * s}px ${70 * s}px rgba(10,4,24,0.5), inset 0 0 0 ${2 * s}px rgba(255,247,236,0.22)`}}>
        <div style={{position: 'absolute', left: bezel, top: bezel, width: r.w, height: r.h, borderRadius: 22 * s, overflow: 'hidden',
          background: `radial-gradient(120% 95% at 30% 0%, #4A2585 0%, #33195E 55%, ${C.bg} 100%)`}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: DW, height: DH, transformOrigin: '0 0', transform: `scale(${s})`, fontFamily: FONT, color: C.text}}>
            {children}
          </div>
        </div>
      </div>
    </At>
  );
};

const chip: React.CSSProperties = {position: 'absolute', top: 34, height: 46, padding: '0 20px', borderRadius: 999, background: 'rgba(20,9,40,0.45)',
  border: '2px solid rgba(255,247,236,0.18)', display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 900, letterSpacing: '0.12em'};

/**
 * The clue screen: round chip + room code, "Who's not one of us?", the five players in a row (the one speaking
 * hops), a timer bar that drains through the clue round, then the 3-2-1 countdown takes over the middle.
 */
export const ClueScreen: React.FC<{f: number; cast: Player[]; speakAt: number[]; timer: [number, number]; promptOut: number; count: number[]; countEnd: number}> = ({
  f, cast, speakAt, timer, promptOut, count, countEnd,
}) => {
  const left = 1 - prog(f, timer[0], timer[1], (t) => t);
  return (
    <>
      <div style={{...chip, left: 40, color: C.text}}>ROUND 1</div>
      <div style={{...chip, right: 40, color: C.accent}}>{ROOM_CODE}</div>
      {/* timer bar */}
      <div style={{position: 'absolute', left: 260, width: 520, top: 50, height: 14, borderRadius: 99, background: 'rgba(255,247,236,0.16)'}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${clamp(left) * 100}%`, borderRadius: 99, background: C.accent}} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 128, height: 100, textAlign: 'center', fontSize: 74, fontWeight: 900, lineHeight: 1}}>
        <Rise f={f} start={-b(1)} end={promptOut}>Who’s not one of us?</Rise>
      </div>
      {count.map((s0, k) => {
        if (f < s0) return null;
        const end = k < count.length - 1 ? count[k + 1] - 2 : countEnd;
        const punch = 1 + 0.35 * (1 - spr(f, s0, POP));
        return (
          <div key={k} style={{position: 'absolute', left: 0, right: 0, top: 70, height: 300, display: 'flex', justifyContent: 'center',
            fontSize: 300, fontWeight: 900, lineHeight: 1, color: C.accent, transform: `scale(${punch})`}}>
            <Rise f={f} start={s0} end={end} cfg={POP}>{3 - k}</Rise>
          </div>
        );
      })}
      {/* the players in a row */}
      {cast.map((p, i) => {
        const x = DW / 2 + (i - 2) * 180;
        const t0 = speakAt[i];
        const hop = f > t0 - 4 && f < t0 + 14 ? 20 * Math.sin(Math.PI * ((f - t0 + 4) / 18)) : 0;
        const said = f >= t0;
        return (
          <React.Fragment key={p.name}>
            <At x={x} y={432 - hop}>
              <Avatar shape={p.shape} color={p.color} size={104} initial={p.name[0]} cream={p.cream} />
            </At>
            <div style={{position: 'absolute', left: x - 80, width: 160, top: 498, textAlign: 'center', fontSize: 26, fontWeight: 800, color: said ? C.text : C.text2}}>{p.name}</div>
          </React.Fragment>
        );
      })}
    </>
  );
};

/** The verdict screen: the voted-out player, "{name} / was the Mole" (the OUT stamp is drawn over it in screen space). */
export const VerdictScreen: React.FC<{f: number; p: Player; at: number}> = ({f, p, at}) => (
  <>
    <div style={{...chip, left: 40, color: C.text}}>VOTE</div>
    <div style={{...chip, right: 40, color: C.accent}}>{ROOM_CODE}</div>
    <At x={VERDICT_AV.x} y={VERDICT_AV.y}>
      <Avatar shape={p.shape} color={p.color} size={250 * (0.6 + 0.4 * spr(f, at, POP))} initial={p.name[0]} cream={p.cream} />
    </At>
    <div style={{position: 'absolute', left: 530, top: 196, fontSize: 104, fontWeight: 900, lineHeight: 1}}>
      <Rise f={f} start={at + 4}>{p.name}</Rise>
    </div>
    <div style={{position: 'absolute', left: 530, top: 318, fontSize: 58, fontWeight: 800, lineHeight: 1, color: C.text2}}>
      <Rise f={f} start={at + 9}>was the Mole</Rise>
    </div>
  </>
);
export const VERDICT_AV = {x: 280, y: 280};

/** The TV's OUT stamp (amber, −8°), 1.8 → 1 in 6 frames, then a small settle. Drawn in screen space at (x, y). */
export const OutStamp: React.FC<{f: number; at: number; x: number; y: number; w: number}> = ({f, at, x, y, w}) => {
  if (f < at - 6) return null;
  const h = w * 0.4;
  const slam = f < at ? lerp(1.8, 1, Math.pow(clamp((f - (at - 6)) / 6), 3)) : 1 + 0.06 * (1 - spr(f, at, POP));
  return (
    <At x={x} y={y} z={60}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: h * 0.2, background: C.accent, boxSizing: 'border-box',
        border: `${h * 0.06}px solid ${C.ink}`, transform: `rotate(-8deg) scale(${slam})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 12px 30px rgba(0,0,0,0.4)'}}>
        <span style={{fontFamily: FONT, fontWeight: 900, fontSize: h * 0.72, lineHeight: 1, color: C.ink, letterSpacing: '0.06em'}}>OUT</span>
      </div>
    </At>
  );
};
