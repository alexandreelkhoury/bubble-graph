import React from 'react';
import {C, PLAYERS} from '../brand';
import {At, Avatar, Bubble, FONT, PhoneFrame, WordFace} from '../parts';
import {b, clamp, easeIn, easeInOut, lerp, POP, prog, spr} from '../time';
import {CAST, joinAt, MOLE_I, out, Rect, rectLerp, SC, T, TV_A, tvPt, VT} from './m5-tv';
import {SAFE_CX} from './common';

/**
 * MA_D_M5 v2 phones. Five real phones, never smaller than 150 px wide, in four big layouts:
 * scan row (5 x 160) -> word row (4 x 210, Sami's sinks) -> Sami's phone big in the middle (290) while the others
 * step aside, desaturated -> a row of five (150) under the TV for clues and votes.
 */
const SCAN = (i: number): Rect => ({x: SAFE_CX + (i - 2) * 180, y: 1400, w: 160, h: 333});
const OFF = (i: number): Rect => ({...SCAN(i), y: 2160});
const WORD = (i: number): Rect => (i === MOLE_I ? {x: SAFE_CX, y: 2240, w: 210, h: 437} : {x: SAFE_CX + (i - 1.5) * 230, y: 1296, w: 210, h: 437});
const ASIDE_X = [132, 272, 748, 888];
const HERO = (i: number): Rect => (i === MOLE_I ? {x: SAFE_CX, y: 1296, w: 290, h: 604} : {x: ASIDE_X[i], y: 1340, w: 160, h: 333});
export const MINI = (i: number): Rect => ({x: SAFE_CX + (i - 2) * 176, y: 1456, w: 150, h: 312});

export const phoneRect = (f: number, i: number): Rect => {
  const r0 = rectLerp(OFF(i), SCAN(i), prog(f, b(T.rise) + i * 3, b(T.rise + 1) + i * 3, easeInOut));
  const sink = i === MOLE_I ? prog(f, b(T.grow), b(T.grow + 0.7), easeIn) : prog(f, b(T.grow) + i * 2, b(T.grow + 0.9) + i * 2, easeInOut);
  const r1 = rectLerp(r0, WORD(i), sink);
  const r2 = rectLerp(r1, HERO(i), prog(f, b(T.hero) + (i === MOLE_I ? 4 : 0), b(T.hero + 0.85) + (i === MOLE_I ? 4 : 0), easeInOut));
  return rectLerp(r2, MINI(i), prog(f, b(T.row) + i * 2, b(T.row + 0.75) + i * 2, easeInOut));
};

const flipAt = (i: number) => (i === MOLE_I ? b(T.moleFlip) : b(T.flip[i])) - 6; // WordFace shows the face from flipAt + 6

/** The phone camera pointed at the TV: a light viewfinder with amber corner brackets around a QR. */
const Viewfinder: React.FC<{f: number; w: number; h: number; i: number}> = ({f, w, h, i}) => {
  const u = w / 160;
  const breathe = 1 + 0.04 * Math.sin((f + i * 9) / 7);
  const bw = 96 * u * breathe;
  return (
    <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #6B4FB0 0%, #4A2E7A 100%)'}}>
      <div style={{position: 'absolute', left: w / 2 - 34 * u, top: h / 2 - 34 * u, width: 68 * u, height: 68 * u, borderRadius: 8 * u, background: C.text,
        backgroundImage: `repeating-linear-gradient(90deg, ${C.ink} 0 ${7 * u}px, transparent ${7 * u}px ${12 * u}px), repeating-linear-gradient(0deg, ${C.ink} 0 ${6 * u}px, transparent ${6 * u}px ${11 * u}px)`,
        backgroundBlendMode: 'multiply', opacity: 0.95}} />
      {[0, 1, 2, 3].map((c) => (
        <div key={c} style={{position: 'absolute', width: 26 * u, height: 26 * u, left: w / 2 + (c % 2 ? bw / 2 - 26 * u : -bw / 2), top: h / 2 + (c < 2 ? -bw / 2 : bw / 2 - 26 * u),
          borderColor: C.accent, borderStyle: 'solid', borderWidth: 0,
          borderTopWidth: c < 2 ? 6 * u : 0, borderBottomWidth: c >= 2 ? 6 * u : 0, borderLeftWidth: c % 2 ? 0 : 6 * u, borderRightWidth: c % 2 ? 6 * u : 0,
          borderRadius: 6 * u}} />
      ))}
    </div>
  );
};

/** After the scan: the screen fills with the player's colour from the centre — "You're in!" */
const Joined: React.FC<{f: number; w: number; h: number; i: number}> = ({f, w, h, i}) => {
  const J = joinAt(i);
  if (f < J - 6) return null;
  const p = CAST[i];
  const R = Math.hypot(w, h) / 2;
  const r = R * prog(f, J - 6, J, easeIn);
  const u = w / 160;
  return (
    <div style={{position: 'absolute', inset: 0, clipPath: `circle(${r}px at 50% 50%)`, background: p.cream ? C.elevated : p.color}}>
      <At x={w / 2} y={h / 2 - 22 * u}>
        <Avatar shape={p.shape} color={p.cream ? p.color : C.text} size={78 * u * spr(f, J, POP)} initial={p.name[0]} cream={!p.cream ? false : true} />
      </At>
      <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 + 30 * u, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 24 * u,
        color: p.cream ? C.text : C.ink}}>{p.name}</div>
    </div>
  );
};

/** The vote screen: the player taps a face; the chosen avatar fills the screen with a check. */
const VoteFace: React.FC<{f: number; w: number; h: number; i: number}> = ({f, w, h, i}) => {
  const at = b(T.vote) + i * 3;
  if (f < at - 6) return null;
  const pick = i === MOLE_I ? PLAYERS[3] : PLAYERS[5];
  const R = Math.hypot(w, h) / 2;
  const r = R * prog(f, at - 6, at, easeIn);
  const s = spr(f, at, POP);
  return (
    <div style={{position: 'absolute', inset: 0, clipPath: `circle(${r}px at 50% 50%)`, background: C.elevated}}>
      <At x={w / 2} y={h / 2}>
        <div style={{position: 'absolute', left: -w * 0.36, top: -w * 0.36, width: w * 0.72, height: w * 0.72, borderRadius: 999, border: `${w * 0.035}px solid ${C.accent}`,
          transform: `scale(${s})`}} />
        <Avatar shape={pick.shape} color={pick.color} size={w * 0.5 * s} initial={pick.name[0]} cream={pick.cream} />
      </At>
    </div>
  );
};

export const Phones: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map((p, i) => {
      if (f < b(T.rise) + i * 3) return null;
      const r = phoneRect(f, i);
      if (r.y - r.h / 2 > 1940) return null;
      const mole = i === MOLE_I;
      // the four step aside, desaturated (never darker than 85 %) while Sami's phone is the hero
      const aside = !mole ? prog(f, b(T.hero), b(T.hero + 0.6)) - prog(f, b(T.row), b(T.row + 0.6)) : 0;
      // the Mole: identical screen; pointed out from outside only (amber ring, a glitch on the frame, a wobble)
      const P = b(T.moleFlip);
      const ring = mole ? spr(f, P, POP) - out(f, b(T.row)) : 0;
      const glitch = mole && f >= P - 1 && f < P + 5;
      const wob = mole ? 6 * (spr(f, P, POP) - spr(f, P + 8, POP)) : 0;
      const gx = glitch ? (f % 2 ? 12 : -12) : 0;
      const word = f >= b(T.grow) - 2;
      const wipe = word ? prog(f, b(T.grow) - 2, b(T.grow) + 8, easeIn) : 0;
      const pad = 16, rw = 8;
      return (
        <At key={i} x={r.x + gx} y={r.y} z={mole ? 22 : 20}>
          <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${wob}deg)`,
            filter: aside > 0.001 ? `saturate(${1 - 0.6 * aside}) brightness(${1 - 0.15 * aside})` : undefined}}>
            {ring > 0.01 ? (
              <div style={{position: 'absolute', left: -r.w / 2 - pad - rw, top: -r.h / 2 - pad - rw, width: r.w + 2 * (pad + rw), height: r.h + 2 * (pad + rw),
                borderRadius: r.w * 0.14 + pad + rw, border: `${rw}px solid ${C.accent}`, boxSizing: 'border-box', transform: `scale(${0.88 + 0.12 * ring})`,
                boxShadow: glitch ? '-14px 0 0 rgba(0,255,255,0.55), 14px 0 0 rgba(255,0,90,0.55)' : `0 0 50px rgba(255,201,77,0.55)`}} />
            ) : null}
            <PhoneFrame w={r.w} h={r.h} screen={C.bg}>
              {wipe < 1 ? (
                <div style={{position: 'absolute', inset: 0}}>
                  <Viewfinder f={f} w={r.w} h={r.h} i={i} />
                  <Joined f={f} w={r.w} h={r.h} i={i} />
                </div>
              ) : null}
              {word ? (
                <div style={{position: 'absolute', inset: 0, background: C.bg, clipPath: `circle(${wipe * Math.hypot(r.w, r.h) / 2}px at 50% 50%)`}}>
                  <WordFace f={f} w={r.w} h={r.h} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={p.word} flipAt={flipAt(i)} />
                </div>
              ) : null}
              <VoteFace f={f} w={r.w} h={r.h} i={i} />
            </PhoneFrame>
          </div>
        </At>
      );
    })}
  </>
);

// ---------------------------------------------------------------- clues (said out loud) + votes (cast on the phones)
const CLUES = ['Cheese', 'Slice', 'Oven', 'Crust', 'Boiled?'];
const CLUE_X = [196, MINI(1).x, MINI(2).x, MINI(3).x, 826];
const CLUE_Y = [1262, 1150, 1262, 1150, 1262];

export const Clues: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map((p, i) => {
      const at = b(T.clue[i]);
      const s = spr(f, at, POP) - out(f, b(T.vote) - 6 + i * 2);
      if (s <= 0.001) return null;
      const hop = f > at - 4 && f < at + 12 ? 16 * Math.sin(Math.PI * ((f - at + 4) / 16)) : 0;
      return (
        <At key={i} x={CLUE_X[i]} y={CLUE_Y[i] - hop} z={26}>
          <Bubble text={CLUES[i]} s={s} size={56} tone={i === MOLE_I ? 'amber' : 'cream'} />
        </At>
      );
    })}
  </>
);

export const Votes: React.FC<{f: number}> = ({f}) => (
  <>
    {[0, 1, 2, 3].map((i) => {
      const t1 = b(T.land) + i * 3, t0 = b(T.vote) + 8 + i * 3;
      if (f < t0 || f > b(T.stamp) + 4) return null;
      const from = MINI(i);
      const vt = VT(MOLE_I);
      const to = tvPt(TV_A, vt.x + (i - 1.5) * 34, vt.y - 104);
      const t = prog(f, t0, t1, easeInOut);
      const x = lerp(from.x, to.x, t), y = lerp(from.y - from.h / 2, to.y, t) - Math.sin(Math.PI * t) * 180;
      const k = f >= t1 ? 1 + 0.4 * (1 - spr(f, t1, POP)) : 0.6 + 0.4 * clamp(t * 3);
      const d = 52 * SC + 10;
      return (
        <At key={i} x={x} y={y} z={35}>
          <div style={{position: 'absolute', left: -d / 2, top: -d / 2, width: d, height: d, borderRadius: 99, background: CAST[i].color,
            border: `5px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${k})`, boxShadow: '0 6px 16px rgba(10,4,20,0.4)'}} />
        </At>
      );
    })}
  </>
);
