import React from 'react';
import {C, PLAYERS, ROOM_CODE} from '../brand';
import {At, Avatar, FONT, Mark, Rise} from '../parts';
import {QR, QR_N} from '../qr';
import {b, clamp, easeIn, easeInOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {SAFE_CX} from './common';

/**
 * MA_D_M5 helpers: the beat grid, the one TV (it moves A -> B -> C), and what its screen shows:
 * a generic streaming home (endless rows) -> the Mish Ana! lobby -> "Look at your phone" -> the vote board.
 * Screen content is laid out in TV design units (1040 x 585, as Film.tsx / m2-tv.tsx) and scaled to the TV.
 */

// ---------------------------------------------------------------- beat grid (ad beats; beat 0 = the drop)
export const T = {
  rowSteps: [-2, -1, 0, 1, 2], // the poster row steps one tile left on each beat ("right, right, right…")
  heroSteps: [-1.5, -0.5, 0.5, 1.5],
  chat: [-1.6, -1.1, 0.5, 1, 1.5], // Maya asks (pre), Karim idk (pre), Lea idk, Joe idk, Sami: "I've got a game."
  select: 2, // focus ring presses on the poster under it
  flood: 2.5, // ...which floods the TV screen magenta
  join: [4, 4.5, 5, 5.5, 6], // the chat avatars land in the lobby
  start: 6.4,
  press: 7,
  tvB: 7.15, // camera: TV rises and shrinks, tiles fly out into phones
  fly: 7,
  flip: [8, 8.5, 9, 9.5, 10.25], // PIZZA x4, then Sami's PASTA
  tvC: 11.75, // TV comes back big, phones drop into a row
  board: 11.95,
  clue: [12.6, 13.1, 13.6, 14.1, 14.6],
  vote: [15.25, 15.5, 15.75, 16],
  stamp: 16.5,
  reveal: 17,
  pFlood: 18.25, // the OUT stamp floods the frame amber
  sat: 19.25,
  sorted: 19.75,
  crew: 20.25,
  bump: 21.5,
};
export const FLOOD = 21; // a flood clears the farthest corner in 0.35 s
export const FF1 = Math.round(b(T.flood)) + FLOOD; // TV screen fully magenta

// ---------------------------------------------------------------- the TV
export type Rect = {x: number; y: number; w: number; h: number};
export const rectLerp = (a: Rect, c: Rect, t: number): Rect => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});
export const TV_A: Rect = {x: SAFE_CX, y: 640, w: 880, h: 495};
export const TV_B: Rect = {x: SAFE_CX, y: 338, w: 500, h: 281.25};
export const TV_C: Rect = {x: SAFE_CX, y: 700, w: 940, h: 528.75};
const TV_A2: Rect = {...TV_A, y: 800}; // once the chat has gone, the TV settles to the frame's centre
export const tvAt = (f: number): Rect => {
  const a = rectLerp(TV_A, TV_A2, prog(f, b(T.join[4]) + 3, b(T.join[4] + 0.85), easeInOut));
  const r = rectLerp(a, TV_B, prog(f, b(T.tvB), b(T.tvB + 0.75), easeInOut));
  return rectLerp(r, TV_C, prog(f, b(T.tvC), b(T.tvC + 0.75), easeInOut));
};
export const tvPt = (r: Rect, lx: number, ly: number) => {
  const s = r.w / 1040;
  return {x: r.x - r.w / 2 + lx * s, y: r.y - r.h / 2 + ly * s};
};

export const TvFrame: React.FC<{r: Rect; children: React.ReactNode}> = ({r, children}) => {
  const s = r.w / 1040;
  const bezel = 12 * s;
  return (
    <At x={r.x} y={r.y} z={5}>
      <div style={{position: 'absolute', left: -110 * s, top: r.h / 2 + bezel, width: 220 * s, height: 26 * s, background: '#05030A',
        borderRadius: `0 0 ${14 * s}px ${14 * s}px`}} />
      <div style={{position: 'absolute', left: -r.w / 2 - bezel, top: -r.h / 2 - bezel, width: r.w + 2 * bezel, height: r.h + 2 * bezel,
        borderRadius: 22 * s + bezel, background: '#05030A', boxShadow: `0 ${30 * s}px ${80 * s}px rgba(0,0,0,0.55)`}}>
        <div style={{position: 'absolute', left: bezel, top: bezel, width: r.w, height: r.h, borderRadius: 22 * s, overflow: 'hidden',
          background: `radial-gradient(120% 90% at 30% 0%, #2A1240 0%, ${C.bg} 60%)`}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: 1040, height: 585, transformOrigin: '0 0', transform: `scale(${s})`, fontFamily: FONT}}>
            {children}
          </div>
        </div>
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- 1. generic streaming home (no real app, no logos)
const ART = [
  ['#3B2A6B', '#7A5BC4'], ['#163E63', '#3D7FB8'], ['#5B2340', '#B0496E'], ['#1F4C45', '#3F9C87'],
  ['#5E3E16', '#C08A3A'], ['#2B2B66', '#5F63C9'], ['#4A1E24', '#A34A3E'], ['#233A55', '#6E8FB5'],
];
const POSTER = {x0: 64, y: 366, w: 150, h: 200, step: 168};
const HERO = {x: 64, y: 96, w: 912, h: 214};
const steps = (f: number, at: number[]) => at.reduce((a, t) => a + spr(f, b(t), SNAPPY), 0);

const Poster: React.FC<{k: number; x: number}> = ({k, x}) => {
  const [c0, c1] = ART[((k % ART.length) + ART.length) % ART.length];
  const shape = ((k * 7) % 3 + 3) % 3;
  return (
    <div style={{position: 'absolute', left: x, top: POSTER.y, width: POSTER.w, height: POSTER.h, borderRadius: 16, overflow: 'hidden',
      background: `linear-gradient(160deg, ${c1} 0%, ${c0} 75%)`}}>
      {shape === 0 ? <div style={{position: 'absolute', left: 40, top: 34, width: 70, height: 70, borderRadius: 99, background: 'rgba(255,247,236,0.22)'}} /> : null}
      {shape === 1 ? <div style={{position: 'absolute', left: 0, right: 0, top: 70, height: 0, borderLeft: '75px solid transparent', borderRight: '75px solid transparent',
        borderBottom: '70px solid rgba(255,247,236,0.18)'}} /> : null}
      {shape === 2 ? <div style={{position: 'absolute', left: 30, top: 40, width: 90, height: 60, borderRadius: 12, border: '6px solid rgba(255,247,236,0.2)'}} /> : null}
      <div style={{position: 'absolute', left: 16, bottom: 34, width: 100, height: 12, borderRadius: 6, background: 'rgba(255,247,236,0.55)'}} />
      <div style={{position: 'absolute', left: 16, bottom: 16, width: 64, height: 9, borderRadius: 5, background: 'rgba(255,247,236,0.3)'}} />
    </div>
  );
};

const Hero: React.FC<{k: number; x: number}> = ({k, x}) => {
  const [c0, c1] = ART[(((k + 3) % ART.length) + ART.length) % ART.length];
  return (
    <div style={{position: 'absolute', left: x, top: 0, width: HERO.w, height: HERO.h, borderRadius: 20, overflow: 'hidden',
      background: `linear-gradient(110deg, ${c0} 0%, ${c1} 100%)`}}>
      <div style={{position: 'absolute', right: 70, top: -40, width: 300, height: 300, borderRadius: 999, background: 'rgba(255,247,236,0.12)'}} />
      <div style={{position: 'absolute', left: 36, top: 56, width: 330, height: 30, borderRadius: 10, background: 'rgba(255,247,236,0.8)'}} />
      <div style={{position: 'absolute', left: 36, top: 100, width: 220, height: 16, borderRadius: 8, background: 'rgba(255,247,236,0.4)'}} />
      <div style={{position: 'absolute', left: 36, top: 144, width: 132, height: 44, borderRadius: 999, background: C.text, display: 'flex', alignItems: 'center',
        justifyContent: 'center'}}>
        <svg width={18} height={20} viewBox="0 0 22 24"><path d="M2 2l18 10L2 22z" fill={C.ink} /></svg>
      </div>
    </div>
  );
};

export const FOCUS = {x: POSTER.x0 + POSTER.w / 2, y: POSTER.y + POSTER.h / 2};

export const HomeScreen: React.FC<{f: number}> = ({f}) => {
  const rs = steps(f, T.rowSteps);
  const hs = steps(f, T.heroSteps);
  const sel = f >= b(T.select) ? 0.07 * Math.sin(Math.PI * clamp((f - b(T.select)) / 12)) : 0;
  const ringK = 1.06 - sel + 0.03 * Math.sin(Math.PI * clamp((f % b(1)) / 10));
  const flash = prog(f, b(T.flood) - 4, b(T.flood), easeIn);
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div style={{position: 'absolute', left: 64, top: 34, display: 'flex', gap: 34, fontSize: 24, fontWeight: 800, color: C.muted}}>
        <span style={{color: C.text}}>Home</span><span>Movies</span><span>Shows</span><span>Live</span>
      </div>
      <div style={{position: 'absolute', right: 64, top: 34, fontSize: 24, fontWeight: 800, color: C.text2}}>Sat · 9:47 PM</div>
      <div style={{position: 'absolute', left: HERO.x, top: HERO.y, width: HERO.w, height: HERO.h, overflow: 'hidden', borderRadius: 20}}>
        {[-1, 0, 1, 2, 3, 4, 5].map((k) => <Hero key={k} k={k} x={(k - hs) * (HERO.w + 24)} />)}
      </div>
      <div style={{position: 'absolute', left: 64, top: 316, fontSize: 22, fontWeight: 800, color: C.text2}}>Top picks for you</div>
      {Array.from({length: 10}, (_, j) => {
        const k = Math.floor(rs) + j - 1;
        const x = POSTER.x0 + (k - rs) * POSTER.step;
        return x > -POSTER.w && x < 1040 ? <Poster key={k} k={k} x={x} /> : null;
      })}
      {/* TV-remote focus ring, parked on the first column; the rows slide under it */}
      <div style={{position: 'absolute', left: POSTER.x0 - 8, top: POSTER.y - 8, width: POSTER.w + 16, height: POSTER.h + 16, borderRadius: 22,
        boxShadow: `0 0 0 6px ${mix(C.text, C.primary, flash)}, 0 0 30px rgba(255,247,236,0.35)`, transform: `scale(${ringK})`}} />
    </div>
  );
};

/** The focused poster floods the screen magenta (circle, 0.35 s). */
export const ScreenFlood: React.FC<{f: number}> = ({f}) => {
  if (f < b(T.flood) || f >= FF1) return null;
  const R = Math.hypot(1040 - FOCUS.x, FOCUS.y) * 1.04;
  const r = lerp(40, R, prog(f, b(T.flood), FF1, easeIn));
  return <div style={{position: 'absolute', left: FOCUS.x - r, top: FOCUS.y - r, width: 2 * r, height: 2 * r, borderRadius: 999, background: C.primary}} />;
};

// ---------------------------------------------------------------- 2. the Mish Ana! lobby
export const SLOT = (i: number) => ({x: 465 + (i % 3) * 190, y: 185 + Math.floor(i / 3) * 170});
const QR_R = {x: 165, y: 225, w: 250, h: 250};
const START = {x: 865, y: 520, w: 250, h: 72};
export const JOINERS = [0, 1, 2, 3, 5]; // Maya, Karim, Lea, Joe, Sami (the Mole)
const out = (f: number, at: number) => spr(f, at, {damping: 26, stiffness: 300});

export const Lobby: React.FC<{f: number}> = ({f}) => {
  if (f < FF1) return null;
  const P0 = b(T.press);
  // the magenta screen contracts into the QR card and turns cream on the way
  const c = spr(f, FF1, {damping: 17, stiffness: 170});
  const qw = lerp(1040, QR_R.w, c), qh = lerp(585, QR_R.h, c);
  const qx = lerp(520, QR_R.x, c), qy = lerp(292.5, QR_R.y, c);
  const qOut = out(f, P0 + 2);
  const t0 = FF1 + 8;
  const landed = T.join.filter((t) => f >= b(t)).length;
  const startIn = spr(f, b(T.start), POP) - out(f, P0 + 8);
  const press = f >= P0 - 5 ? 0.12 * Math.sin(Math.PI * clamp((f - P0 + 5) / 12)) : 0;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: 40, top: 48, width: 250, textAlign: 'center', fontSize: 24, fontWeight: 700, color: C.text2, letterSpacing: '0.08em'}}>
        <Rise f={f} start={t0} end={P0}>Scan to join</Rise>
      </div>
      {qOut < 0.99 ? (
        <div style={{position: 'absolute', left: qx - qw / 2, top: qy - qh / 2, width: qw, height: qh, borderRadius: lerp(0, 26, clamp(c)),
          background: mix(C.primary, C.text, prog(f, FF1 + 3, FF1 + 16)), transform: `scale(${1 - qOut})`}}>
          <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} width="100%" height="100%">
            {QR.flatMap((row, r) => row.map((on, cc) => {
              if (!on) return null;
              const dist = Math.hypot(r - QR_N / 2, cc - QR_N / 2) / (QR_N / 2);
              const k = spr(f, FF1 + 12 + dist * b(0.5), {damping: 18, stiffness: 260});
              return k > 0.01 ? <rect key={`${r}-${cc}`} x={cc + (1 - k) / 2} y={r + (1 - k) / 2} width={k} height={k} fill={C.ink} /> : null;
            }))}
          </svg>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 30, top: 372, width: 270, display: 'flex', justifyContent: 'space-between', fontSize: 96, fontWeight: 900,
        color: C.accent, lineHeight: 1}}>
        {ROOM_CODE.split('').map((ch, i) => <Rise key={i} f={f} start={b(3.75) + i * 4} end={P0 + i * 2} cfg={POP}>{ch}</Rise>)}
      </div>
      <div style={{position: 'absolute', left: 40, top: 492, width: 250, textAlign: 'center', fontSize: 18, fontWeight: 600, color: C.muted}}>
        <Rise f={f} start={b(4.1)} end={P0 + 4}>play.mishana.workers.dev</Rise>
      </div>
      <div style={{position: 'absolute', left: 380, top: 48, fontSize: 28, fontWeight: 800, color: C.text, display: 'flex', gap: 8}}>
        <Rise f={f} start={t0 + 2} end={P0}>Players</Rise>
        <Rise key={landed} f={f} start={landed ? b(T.join[landed - 1]) : t0 + 3} end={P0 + 2} cfg={POP}>
          <span style={{color: landed ? C.accent : C.text}}>{landed}</span>/12
        </Rise>
      </div>
      {Array.from({length: 6}, (_, i) => {
        const sl = SLOT(i);
        const slot = spr(f, t0 + 3 + i * 2, SNAPPY) - (i === 5 ? out(f, P0 + 4) : 0);
        const J = i < 5 ? b(T.join[i]) : 1e9;
        const lit = f >= J;
        // filled tiles leave the TV as phones (drawn by M5 in frame space) from their fly start
        if (lit && f >= flyStart(i)) return null;
        const p = PLAYERS[JOINERS[i] ?? 0];
        return (
          <div key={i} style={{position: 'absolute', left: sl.x - 85, top: sl.y - 75, width: 170, height: 150, transform: `scale(${Math.max(0, slot)})`}}>
            {!lit ? <div style={{position: 'absolute', inset: 0, borderRadius: 24, border: `2.5px dashed ${C.outline}`}} /> : (
              <div style={{position: 'absolute', inset: 0, borderRadius: 24, background: C.surface, transform: `scale(${spr(f, J, POP)})`}}>
                <At x={85} y={62}>
                  <Avatar shape={p.shape} color={p.color} size={72} initial={p.name[0]} cream={p.cream} />
                </At>
                <div style={{position: 'absolute', left: 0, right: 0, top: 104, textAlign: 'center', fontSize: 24, fontWeight: 800, color: C.text}}>
                  <Rise f={f} start={J + 2}>{p.name}</Rise>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {startIn > 0.001 ? (
        <div style={{position: 'absolute', left: START.x - START.w / 2, top: START.y - START.h / 2, width: START.w, height: START.h, borderRadius: 999,
          background: C.primary, transform: `scale(${startIn * (1 - press)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          color: C.ink, fontSize: 30, fontWeight: 900, boxShadow: '0 0 40px rgba(255,61,139,0.45)'}}>
          <svg width={22} height={24} viewBox="0 0 22 24"><path d="M2 2l18 10L2 22z" fill={C.ink} /></svg>
          Start
        </div>
      ) : null}
    </div>
  );
};

/** Bottom-row phones (Joe, Sami) leave first and pass under the top row, which follows on 2-frame steps. */
export const flyStart = (i: number) => b(T.fly) + [6, 8, 10, 0, 3][i];

// ---------------------------------------------------------------- 3. while the words are out
export const LookScreen: React.FC<{f: number}> = ({f}) => {
  const a = b(T.press) + 10, z = b(T.tvC) - 2;
  if (f < a || f > z + 20) return null;
  const k = spr(f, a, POP) - out(f, z);
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: 170, height: 170}}>
        <At x={85} y={85}><Mark size={170 * Math.max(0, k)} bubble={1} stroke={1} /></At>
      </div>
      <div style={{fontSize: 58, fontWeight: 900, color: C.text, marginTop: 16}}>
        <Rise f={f} start={a + 4} end={z}>Check your phones!</Rise>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 4. the vote board (the TV stamps OUT)
export const VT = (i: number) => ({x: 520 + (i - 2) * 190, y: 290});
export const STAMP_L = {x: 900, y: 318, w: 220, h: 86};
export const MOLE_I = 4;

export const VoteBoard: React.FC<{f: number}> = ({f}) => {
  const a = b(T.board);
  if (f < a) return null;
  const landed = T.vote.filter((t) => f >= b(t)).length;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 52, textAlign: 'center', fontSize: 46, fontWeight: 900, color: C.text}}>
        <Rise f={f} start={a + 2}>Who’s not <span style={{color: C.accent}}>one of us?</span></Rise>
      </div>
      {JOINERS.map((pi, i) => {
        const p = PLAYERS[pi];
        const c = VT(i);
        const pop = spr(f, a + 4 + i * 2, POP);
        const mole = i === MOLE_I;
        const dim = !mole ? 1 - 0.5 * prog(f, b(T.stamp), b(T.stamp) + 10) : 1;
        const hit = mole && landed > 0 ? 1 + 0.06 * (1 - spr(f, b(T.vote[landed - 1]), POP)) : 1;
        return (
          <div key={i} style={{position: 'absolute', left: c.x - 85, top: c.y - 100, width: 170, height: 200, borderRadius: 26, background: C.surface,
            transform: `scale(${pop * hit})`, opacity: dim, boxShadow: mole && landed > 0 ? `inset 0 0 0 4px ${C.accent}` : `inset 0 0 0 2px ${C.outline}`}}>
            <At x={85} y={82}>
              <Avatar shape={p.shape} color={p.color} size={92} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${spr(f, a + 6 + i * 2, POP)})`}} />
            </At>
            <div style={{position: 'absolute', left: 0, right: 0, top: 140, textAlign: 'center', fontSize: 28, fontWeight: 800, color: C.text}}>
              <Rise f={f} start={a + 7 + i * 2}>{p.name}</Rise>
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 440, textAlign: 'center', fontSize: 52, fontWeight: 900, color: C.accent}}>
        <Rise f={f} start={b(T.reveal)} cfg={POP}>Sami was the Mole</Rise>
      </div>
    </div>
  );
};

