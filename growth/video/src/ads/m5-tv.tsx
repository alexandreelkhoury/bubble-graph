import React from 'react';
import {C, PLAYERS, ROOM_CODE} from '../brand';
import {At, Avatar, FONT, Mark, Rise} from '../parts';
import {QR, QR_N} from '../qr';
import {b, clamp, easeIn, easeInOut, lerp, mix, POP, prog, SNAPPY, spr, TEXT} from '../time';
import {SAFE_CX} from './common';

/**
 * MA_D_M5 v2 helpers: the beat grid, the one TV, and what its screen shows:
 * a bright streaming home (endless rows) -> the Mish Ana! lobby -> "Check your phones!" -> the vote board.
 * The TV never shrinks below 900 px wide (review-v2: the v1 TV shrank to 500 px and went near-black), so every
 * readable TV string is set in TV design units (1040 x 585) at a size that stays >= 55 px on screen (scale 0.865).
 */

// ---------------------------------------------------------------- beat grid (ad beats; beat 0 = the drop)
export const T = {
  rowSteps: [-3, -2, -1, 0, 1, 2, 3], // the poster row slides one tile on every beat: "right, right, right…"
  heroSteps: [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5],
  chat: [-3, -2, 1, 2.5], // Maya asks, Karim "idk" (both pre-settled), Lea "idk", Sami "I've got a game."
  samiType: 1.6,
  fly: 3.7, // Sami's bubble flies into the TV...
  flood: 4.3, // ...and floods its screen magenta
  tvDown: 4.4, // the chat folds away, the TV glides to the frame's centre
  code: 5.9, // room code lands
  tvUp: 6.25, // TV back up, phones rise
  rise: 6.5,
  join: [9.5, 9.5, 10.5, 10.5, 11.5], // per cast index: Maya+Karim, Lea+Joe, Sami
  look: 12.75, // TV: "Check your phones!"
  grow: 12.9, // four phones grow, Sami's sinks
  flip: [14, 14.2, 14.4, 14.6], // PIZZA x4 (one cascade, one SFX)
  hero: 16.75, // the four step aside, Sami's phone rises big
  moleFlip: 18, // PASTA
  row: 20.75, // all five phones drop into a row
  board: 20.9, // TV: "Who's not one of us?"
  clue: [21.6, 22.2, 22.8, 23.4, 24.0],
  vote: 25, // the phones vote
  land: 26, // votes land on Sami's tile
  stamp: 27,
  reveal: 27.75,
  pFlood: 30.15, // the OUT stamp floods the frame amber (the ad's one full-screen flash)
  sat: 31.0, // "Saturday, sorted." plate
  crew: 31.9,
};
export const FLOOD = 21; // a flood clears the farthest corner in 0.35 s
export const FF1 = Math.round(b(T.flood)) + FLOOD; // TV screen fully magenta
export const MOLE_I = 4;
export const JOINERS = [0, 1, 2, 3, 5]; // Maya, Karim, Lea, Joe, Sami (the Mole)
export const CAST = JOINERS.map((i) => PLAYERS[i]);
export const out = (f: number, at: number) => spr(f, at, {damping: 26, stiffness: 300});

// ---------------------------------------------------------------- the TV
export type Rect = {x: number; y: number; w: number; h: number};
export const rectLerp = (a: Rect, c: Rect, t: number): Rect => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});
export const TV_A: Rect = {x: SAFE_CX, y: 712, w: 900, h: 506.25};
const TV_LOW: Rect = {...TV_A, y: 850};
export const tvAt = (f: number): Rect => {
  const a = rectLerp(TV_A, TV_LOW, prog(f, b(T.tvDown), b(T.tvDown + 1), easeInOut));
  return rectLerp(a, TV_A, prog(f, b(T.tvUp), b(T.tvUp + 1), easeInOut));
};
export const SC = TV_A.w / 1040;
export const tvPt = (r: Rect, lx: number, ly: number) => {
  const s = r.w / 1040;
  return {x: r.x - r.w / 2 + lx * s, y: r.y - r.h / 2 + ly * s};
};

export const TvFrame: React.FC<{r: Rect; children: React.ReactNode}> = ({r, children}) => {
  const s = r.w / 1040;
  const bezel = 13 * s;
  return (
    <At x={r.x} y={r.y} z={5}>
      <div style={{position: 'absolute', left: -120 * s, top: r.h / 2 + bezel, width: 240 * s, height: 28 * s, background: '#0B0614',
        borderRadius: `0 0 ${14 * s}px ${14 * s}px`}} />
      <div style={{position: 'absolute', left: -r.w / 2 - bezel, top: -r.h / 2 - bezel, width: r.w + 2 * bezel, height: r.h + 2 * bezel,
        borderRadius: 24 * s + bezel, background: '#0B0614', boxShadow: `0 ${30 * s}px ${80 * s}px rgba(10,4,20,0.5), 0 0 ${120 * s}px rgba(160,100,255,0.28)`}}>
        <div style={{position: 'absolute', left: bezel, top: bezel, width: r.w, height: r.h, borderRadius: 24 * s, overflow: 'hidden',
          background: `radial-gradient(120% 95% at 30% 0%, #6A3CB0 0%, ${C.surface} 62%, #2E1A58 100%)`}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: 1040, height: 585, transformOrigin: '0 0', transform: `scale(${s})`, fontFamily: FONT}}>
            {children}
          </div>
        </div>
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- 1. bright generic streaming home (no real app, no logos)
const ART = [
  ['#6A4BD0', '#B48CFF'], ['#2C6FC0', '#7FC3FF'], ['#C23A72', '#FF8DB8'], ['#1F9C80', '#6FE3C2'],
  ['#C98A20', '#FFD27A'], ['#4B4FD8', '#9AA0FF'], ['#C2483A', '#FF9A7A'], ['#3D7DB5', '#A6D4FF'],
];
const POSTER = {x0: 60, y: 364, w: 156, h: 208, step: 174};
const HERO = {x: 60, y: 100, w: 920, h: 220};
const steps = (f: number, at: number[]) => at.reduce((a, t) => a + spr(f, b(t), SNAPPY), 0);

const Poster: React.FC<{k: number; x: number}> = ({k, x}) => {
  const [c0, c1] = ART[((k % ART.length) + ART.length) % ART.length];
  const shape = ((k * 7) % 3 + 3) % 3;
  return (
    <div style={{position: 'absolute', left: x, top: POSTER.y, width: POSTER.w, height: POSTER.h, borderRadius: 16, overflow: 'hidden',
      background: `linear-gradient(160deg, ${c1} 0%, ${c0} 80%)`}}>
      {shape === 0 ? <div style={{position: 'absolute', left: 40, top: 34, width: 76, height: 76, borderRadius: 99, background: 'rgba(255,247,236,0.35)'}} /> : null}
      {shape === 1 ? <div style={{position: 'absolute', left: 0, right: 0, top: 64, height: 0, borderLeft: '78px solid transparent', borderRight: '78px solid transparent',
        borderBottom: '74px solid rgba(255,247,236,0.3)'}} /> : null}
      {shape === 2 ? <div style={{position: 'absolute', left: 30, top: 40, width: 96, height: 64, borderRadius: 12, border: '7px solid rgba(255,247,236,0.35)'}} /> : null}
      <div style={{position: 'absolute', left: 16, bottom: 36, width: 104, height: 13, borderRadius: 6, background: 'rgba(255,247,236,0.85)'}} />
      <div style={{position: 'absolute', left: 16, bottom: 17, width: 66, height: 10, borderRadius: 5, background: 'rgba(255,247,236,0.5)'}} />
    </div>
  );
};

const Hero: React.FC<{k: number; x: number}> = ({k, x}) => {
  const [c0, c1] = ART[(((k + 3) % ART.length) + ART.length) % ART.length];
  return (
    <div style={{position: 'absolute', left: x, top: 0, width: HERO.w, height: HERO.h, borderRadius: 20, overflow: 'hidden',
      background: `linear-gradient(110deg, ${c0} 0%, ${c1} 100%)`}}>
      <div style={{position: 'absolute', right: 70, top: -40, width: 300, height: 300, borderRadius: 999, background: 'rgba(255,247,236,0.2)'}} />
      <div style={{position: 'absolute', left: 36, top: 54, width: 340, height: 32, borderRadius: 10, background: 'rgba(255,247,236,0.92)'}} />
      <div style={{position: 'absolute', left: 36, top: 100, width: 220, height: 17, borderRadius: 8, background: 'rgba(255,247,236,0.6)'}} />
      <div style={{position: 'absolute', left: 36, top: 146, width: 136, height: 46, borderRadius: 999, background: C.text, display: 'flex', alignItems: 'center',
        justifyContent: 'center'}}>
        <svg width={18} height={20} viewBox="0 0 22 24"><path d="M2 2l18 10L2 22z" fill={C.ink} /></svg>
      </div>
    </div>
  );
};

export const HomeScreen: React.FC<{f: number}> = ({f}) => {
  if (f >= FF1) return null;
  const rs = steps(f, T.rowSteps);
  const hs = steps(f, T.heroSteps);
  const ringK = 1.05 + 0.025 * Math.sin(Math.PI * clamp((((f % b(1)) + b(1)) % b(1)) / 10));
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div style={{position: 'absolute', left: 60, top: 32, display: 'flex', gap: 34, fontSize: 28, fontWeight: 800, color: C.text2}}>
        <span style={{color: C.text}}>Home</span><span>Movies</span><span>Shows</span>
      </div>
      <div style={{position: 'absolute', right: 60, top: 32, fontSize: 28, fontWeight: 800, color: C.text}}>Sat · 9:47 PM</div>
      <div style={{position: 'absolute', left: HERO.x, top: HERO.y, width: HERO.w, height: HERO.h, overflow: 'hidden', borderRadius: 20}}>
        {[-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7].map((k) => <Hero key={k} k={k} x={(k + 3 - hs) * (HERO.w + 24)} />)}
      </div>
      <div style={{position: 'absolute', left: 60, top: 318, fontSize: 24, fontWeight: 800, color: C.text}}>Top picks for you</div>
      {Array.from({length: 10}, (_, j) => {
        const k = Math.floor(rs) + j - 1;
        const x = POSTER.x0 + (k - rs) * POSTER.step;
        return x > -POSTER.w && x < 1040 ? <Poster key={k} k={k} x={x} /> : null;
      })}
      {/* TV-remote focus ring parked on the first column; the rows keep sliding under it */}
      <div style={{position: 'absolute', left: POSTER.x0 - 8, top: POSTER.y - 8, width: POSTER.w + 16, height: POSTER.h + 16, borderRadius: 22,
        boxShadow: `0 0 0 7px ${C.text}, 0 0 34px rgba(255,247,236,0.5)`, transform: `scale(${ringK})`}} />
    </div>
  );
};

/** Sami's message lands in the middle of the screen and floods it magenta (circle, 0.35 s). */
export const ScreenFlood: React.FC<{f: number}> = ({f}) => {
  if (f < b(T.flood) || f >= FF1 + 2) return null;
  const R = Math.hypot(520, 292.5) * 1.04;
  const r = lerp(30, R, prog(f, b(T.flood), FF1, easeIn));
  return <div style={{position: 'absolute', left: 520 - r, top: 292.5 - r, width: 2 * r, height: 2 * r, borderRadius: 999, background: C.primary}} />;
};

// ---------------------------------------------------------------- 2. the Mish Ana! lobby
export const SLOT = (i: number) => ({x: 486 + (i % 3) * 188, y: 230 + Math.floor(i / 3) * 196});
const QR_R = {x: 190, y: 250, w: 270, h: 270};
export const joinAt = (i: number) => b(T.join[i]);

export const Lobby: React.FC<{f: number}> = ({f}) => {
  if (f < FF1) return null;
  const L = b(T.look);
  if (f > L + 20) return null;
  // the magenta screen contracts into the QR card and turns cream on the way
  const c = spr(f, FF1, {damping: 17, stiffness: 170});
  const qw = lerp(1040, QR_R.w, c), qh = lerp(585, QR_R.h, c);
  const qx = lerp(520, QR_R.x, c), qy = lerp(292.5, QR_R.y, c);
  const qOut = out(f, L);
  const t0 = FF1 + 8;
  const landed = T.join.filter((t) => f >= b(t)).length;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: 40, top: 40, width: 300, textAlign: 'center', fontSize: 38, fontWeight: 900, color: C.text}}>
        <Rise f={f} start={t0} end={L}>Scan to join</Rise>
      </div>
      {qOut < 0.99 ? (
        <div style={{position: 'absolute', left: qx - qw / 2, top: qy - qh / 2, width: qw, height: qh, borderRadius: lerp(0, 26, clamp(c)),
          background: mix(C.primary, C.text, prog(f, FF1 + 3, FF1 + 16)), transform: `scale(${1 - qOut})`}}>
          <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} width="100%" height="100%">
            {QR.flatMap((row, r) => row.map((on, cc) => {
              if (!on) return null;
              const dist = Math.hypot(r - QR_N / 2, cc - QR_N / 2) / (QR_N / 2);
              const k = spr(f, FF1 + 10 + dist * b(0.5), {damping: 18, stiffness: 260});
              return k > 0.01 ? <rect key={`${r}-${cc}`} x={cc + (1 - k) / 2} y={r + (1 - k) / 2} width={k} height={k} fill={C.ink} /> : null;
            }))}
          </svg>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 40, top: 410, width: 300, display: 'flex', justifyContent: 'space-between', fontSize: 112, fontWeight: 900,
        color: C.accent, lineHeight: 1}}>
        {ROOM_CODE.split('').map((ch, i) => <Rise key={i} f={f} start={b(T.code) + i * 3} end={L + i * 2} cfg={TEXT}>{ch}</Rise>)}
      </div>
      <div style={{position: 'absolute', left: 400, top: 44, fontSize: 38, fontWeight: 900, color: C.text, display: 'flex', gap: 10}}>
        <Rise f={f} start={t0 + 2} end={L}>Players</Rise>
        <Rise key={landed} f={f} start={landed ? b(T.join[landed - 1]) : t0 + 3} end={L + 2} cfg={TEXT}>
          <span style={{color: landed ? C.accent : C.text}}>{landed}</span>/12
        </Rise>
      </div>
      {CAST.map((p, i) => {
        const sl = SLOT(i);
        const slot = spr(f, t0 + 3 + i * 2, SNAPPY) - out(f, L + i * 2);
        if (slot <= 0.001) return null;
        const J = joinAt(i);
        const lit = f >= J;
        return (
          <div key={i} style={{position: 'absolute', left: sl.x - 85, top: sl.y - 88, width: 170, height: 176, transform: `scale(${Math.max(0, slot)})`}}>
            {!lit ? <div style={{position: 'absolute', inset: 0, borderRadius: 26, border: `3px dashed ${C.outline}`}} /> : (
              <div style={{position: 'absolute', inset: 0, borderRadius: 26, background: C.elevated, transform: `scale(${spr(f, J, POP)})`,
                boxShadow: `inset 0 0 0 3px ${p.color}`}}>
                <At x={85} y={70}>
                  <Avatar shape={p.shape} color={p.color} size={84} initial={p.name[0]} cream={p.cream} />
                </At>
                <div style={{position: 'absolute', left: 0, right: 0, top: 124, textAlign: 'center', fontSize: 30, fontWeight: 800, color: C.text}}>{p.name}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- 3. while the words are out
export const LookScreen: React.FC<{f: number}> = ({f}) => {
  const a = b(T.look) + 6, z = b(T.board) - 2;
  if (f < a || f > z + 20) return null;
  const k = spr(f, a, POP) - out(f, z);
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: 200, height: 200}}>
        <At x={100} y={100}><Mark size={200 * Math.max(0, k)} bubble={1} stroke={1} /></At>
      </div>
      <div style={{fontSize: 96, fontWeight: 900, color: C.text, marginTop: 18, lineHeight: 1.1, letterSpacing: '-0.01em'}}>
        <Rise f={f} start={a + 3} end={z}>Check your phones!</Rise>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 4. the vote board (the TV stamps OUT)
export const VT = (i: number) => ({x: 520 + (i - 2) * 196, y: 292});
export const STAMP_L = {x: VT(MOLE_I).x - 6, y: VT(MOLE_I).y + 6, w: 236, h: 96};

export const VoteBoard: React.FC<{f: number}> = ({f}) => {
  const a = b(T.board);
  if (f < a) return null;
  const votesIn = f >= b(T.land);
  const dim = prog(f, b(T.stamp), b(T.stamp) + 10);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 34, textAlign: 'center', fontSize: 72, fontWeight: 900, color: C.text, lineHeight: 1.1}}>
        <Rise f={f} start={a + 4}>Who’s not <span style={{color: C.accent}}>one of us?</span></Rise>
      </div>
      {CAST.map((p, i) => {
        const c = VT(i);
        const pop = spr(f, a + 6 + i * 2, POP);
        const mole = i === MOLE_I;
        const hit = mole && votesIn ? 1 + 0.08 * (1 - spr(f, b(T.land), POP)) : 1;
        // losers are desaturated, never darkened below 80 %
        const filt = !mole && dim > 0 ? `saturate(${1 - 0.75 * dim}) brightness(${1 - 0.2 * dim})` : undefined;
        return (
          <div key={i} style={{position: 'absolute', left: c.x - 88, top: c.y - 104, width: 176, height: 208, borderRadius: 28, background: C.elevated,
            transform: `scale(${pop * hit})`, filter: filt, boxShadow: mole && votesIn ? `inset 0 0 0 6px ${C.accent}, 0 0 40px rgba(255,201,77,0.5)` : `inset 0 0 0 3px ${p.color}`}}>
            <At x={88} y={86}>
              <Avatar shape={p.shape} color={p.color} size={100} initial={p.name[0]} cream={p.cream} />
            </At>
            <div style={{position: 'absolute', left: 0, right: 0, top: 148, textAlign: 'center', fontSize: 32, fontWeight: 800, color: C.text}}>{p.name}</div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 432, textAlign: 'center', fontSize: 96, fontWeight: 900, color: C.accent, lineHeight: 1.1,
        letterSpacing: '-0.01em'}}>
        <Rise f={f} start={b(T.reveal)}>Sami was the Mole</Rise>
      </div>
    </div>
  );
};
