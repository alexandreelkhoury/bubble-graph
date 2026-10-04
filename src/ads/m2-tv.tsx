import React from 'react';
import {C, PLAYERS, ROOM_CODE} from '../brand';
import {At, Avatar, FONT, PhoneFrame, Rise} from '../parts';
import {QR, QR_N} from '../qr';
import {b, clamp, easeIn, easeOut, lerp, mix, POP, prog, SNAPPY, spr} from '../time';
import {SAFE_CX} from './common';
import {CheckMark} from './m2-icons';

// ---------------------------------------------------------------- geometry (ad frame px)

export type Rect = {x: number; y: number; w: number; h: number}; // centre + size
export const rectLerp = (a: Rect, c: Rect, t: number): Rect => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});

/** The TV screen once the amber row has grown into it. Lobby design units are 1040 x 585 (as in Film.tsx). */
export const TV: Rect = {x: SAFE_CX, y: 610, w: 880, h: 495};
export const TV_S = TV.w / 1040;
export const tvPt = (lx: number, ly: number) => ({x: TV.x - TV.w / 2 + lx * TV_S, y: TV.y - TV.h / 2 + ly * TV_S});
export const START_LOCAL = {x: 865, y: 520, w: 250, h: 72};
const SLOT_LOCAL = (i: number) => ({x: 465 + (i % 3) * 190, y: 185 + Math.floor(i / 3) * 170});
export const QR_CENTRE = tvPt(165, 225);

/** The four joining phones: who they are, when they join (beat), where they sit, where they fly in from. */
export const JOINERS = [0, 1, 2, 5]; // Maya, Karim, Lea, Sami (the Mole)
export const JOIN = [7, 7.5, 8, 8.5];
export const JPH = {w: 196, h: 408};
export const JY = 1215;
export const jx = (i: number) => SAFE_CX + (i - 1.5) * 226;
const FROM = [{dx: -560, dy: 40, r: -22}, {dx: -60, dy: 960, r: -10}, {dx: 60, dy: 960, r: 10}, {dx: 560, dy: 40, r: 22}];

export const START_PILL = b(9);
export const PRESS = b(10);

// ---------------------------------------------------------------- the TV lobby (inside the screen, screen-local px)

export const Lobby: React.FC<{f: number; t0: number}> = ({f, t0}) => {
  const P = (n: number) => n * TV_S;
  const landed = JOIN.filter((t) => f >= b(t)).length;
  const qrIn = spr(f, t0, SNAPPY);
  const qrBump = JOIN.reduce((a, t) => a + 0.05 * Math.sin(Math.PI * clamp((f - b(t)) / 12)) * (f > b(t) ? 1 : 0), 0);
  const startIn = spr(f, START_PILL, POP);
  const press = f >= PRESS - 6 ? 0.1 * Math.sin(Math.PI * clamp((f - PRESS + 6) / 12)) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div style={{position: 'absolute', left: P(40), top: P(48), width: P(250), textAlign: 'center', fontSize: P(24), fontWeight: 700,
        color: C.text2, letterSpacing: '0.08em'}}>
        <Rise f={f} start={t0 + 2}>Scan to join</Rise>
      </div>
      <div style={{position: 'absolute', left: P(40), top: P(100), width: P(250), height: P(250), borderRadius: P(26), background: C.text,
        transform: `scale(${qrIn * (1 + qrBump)})`}}>
        <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} width="100%" height="100%">
          {QR.flatMap((row, r) => row.map((on, c) => {
            if (!on) return null;
            const dist = Math.hypot(r - QR_N / 2, c - QR_N / 2) / (QR_N / 2);
            const k = spr(f, t0 + 4 + dist * b(0.55), {damping: 18, stiffness: 260});
            return k > 0.01 ? <rect key={`${r}-${c}`} x={c + (1 - k) / 2} y={r + (1 - k) / 2} width={k} height={k} fill={C.ink} /> : null;
          }))}
        </svg>
      </div>
      <div style={{position: 'absolute', left: P(30), top: P(372), width: P(270), display: 'flex', justifyContent: 'space-between',
        fontSize: P(96), fontWeight: 900, color: C.accent, lineHeight: 1}}>
        {ROOM_CODE.split('').map((ch, i) => <Rise key={i} f={f} start={b(6) + i * 4} cfg={POP}>{ch}</Rise>)}
      </div>
      <div style={{position: 'absolute', left: P(40), top: P(492), width: P(250), textAlign: 'center', fontSize: P(18), fontWeight: 600, color: C.muted}}>
        <Rise f={f} start={b(6.4)}>play.mishana.workers.dev</Rise>
      </div>
      <div style={{position: 'absolute', left: P(380), top: P(48), fontSize: P(28), fontWeight: 800, color: C.text, display: 'flex', gap: P(8)}}>
        <Rise f={f} start={t0 + 3}>Players</Rise>
        <Rise key={landed} f={f} start={landed ? b(JOIN[landed - 1]) : t0 + 4} cfg={POP}>
          <span style={{color: landed ? C.accent : C.text}}>{landed}</span>/12
        </Rise>
      </div>
      {Array.from({length: 6}, (_, i) => {
        const c = SLOT_LOCAL(i);
        const slot = spr(f, t0 + 3 + i * 2, SNAPPY);
        const lit = i < 4 && f >= b(JOIN[i]);
        const p = PLAYERS[JOINERS[i] ?? 0];
        return (
          <div key={i} style={{position: 'absolute', left: P(c.x - 85), top: P(c.y - 75), width: P(170), height: P(150), transform: `scale(${slot})`}}>
            {!lit ? <div style={{position: 'absolute', inset: 0, borderRadius: P(24), border: `${P(2.5)}px dashed ${C.outline}`}} /> : (
              <div style={{position: 'absolute', inset: 0, borderRadius: P(24), background: C.surface, transform: `scale(${spr(f, b(JOIN[i]), POP)})`}}>
                <At x={P(85)} y={P(62)}>
                  <Avatar shape={p.shape} color={p.color} size={P(72)} initial={p.name[0]} cream={p.cream}
                    style={{transform: `scale(${spr(f, b(JOIN[i]) + 2, POP)})`}} />
                </At>
                <div style={{position: 'absolute', left: 0, right: 0, top: P(108), textAlign: 'center', fontSize: P(22), fontWeight: 700, color: C.text}}>
                  <Rise f={f} start={b(JOIN[i]) + 3}>{p.name}</Rise>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {startIn > 0.001 ? (
        <div style={{position: 'absolute', left: P(START_LOCAL.x - START_LOCAL.w / 2), top: P(START_LOCAL.y - START_LOCAL.h / 2), width: P(START_LOCAL.w),
          height: P(START_LOCAL.h), borderRadius: 999, background: C.primary, transform: `scale(${startIn * (1 - press)})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: P(12), color: C.ink, fontSize: P(30), fontWeight: 900}}>
          <svg width={P(22)} height={P(24)} viewBox="0 0 22 24"><path d="M2 2l18 10L2 22z" fill={C.ink} /></svg>
          Start
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- joining phones

const Viewfinder: React.FC<{f: number; w: number; h: number; u: number; out: number}> = ({f, w, h, u, out}) => {
  const k = 1 - out;
  if (k <= 0.001) return null;
  const s = 190 * u, arm = 44 * u, t = 7 * u;
  const cy = h * 0.4;
  const scan = (f / 26) % 1;
  const corner = (sx: number, sy: number) => (
    <div style={{position: 'absolute', left: sx < 0 ? 0 : s - arm, top: sy < 0 ? 0 : s - arm, width: arm, height: arm,
      borderLeft: sx < 0 ? `${t}px solid ${C.text}` : undefined, borderRight: sx > 0 ? `${t}px solid ${C.text}` : undefined,
      borderTop: sy < 0 ? `${t}px solid ${C.text}` : undefined, borderBottom: sy > 0 ? `${t}px solid ${C.text}` : undefined,
      borderRadius: `${sx < 0 && sy < 0 ? 14 * u : 0}px ${sx > 0 && sy < 0 ? 14 * u : 0}px ${sx > 0 && sy > 0 ? 14 * u : 0}px ${sx < 0 && sy > 0 ? 14 * u : 0}px`,
      boxSizing: 'border-box'}} />
  );
  return (
    <div style={{position: 'absolute', left: w / 2 - s / 2, top: cy - s / 2, width: s, height: s, transform: `scale(${k})`}}>
      {corner(-1, -1)}{corner(1, -1)}{corner(-1, 1)}{corner(1, 1)}
      <div style={{position: 'absolute', left: 16 * u, right: 16 * u, top: lerp(18 * u, s - 18 * u, 0.5 - 0.5 * Math.cos(scan * Math.PI * 2)), height: 5 * u,
        borderRadius: 9, background: C.primary}} />
    </div>
  );
};

export const JoinPhones: React.FC<{f: number}> = ({f}) => (
  <>
    {JOINERS.map((pi, i) => {
      const J = b(JOIN[i]);
      const s0 = J - b(0.95);
      if (f < s0) return null;
      const fly = spr(f, s0, {damping: 17, stiffness: 150, mass: 1});
      const fr = FROM[i];
      const x = jx(i) + fr.dx * (1 - fly), y = JY + fr.dy * (1 - fly);
      const rot = fr.r * (1 - fly);
      const u = JPH.w / 300;
      const joined = f >= J;
      const out = prog(f, J - 2, J + 7, easeIn);
      const p = PLAYERS[pi];
      const screen = mix(C.bgDeep, C.surface, prog(f, J, J + 8));
      return (
        <At key={i} x={x} y={y} z={8}>
          <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${rot}deg)`}}>
            <PhoneFrame w={JPH.w} h={JPH.h} screen={screen}>
              <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text, textAlign: 'center'}}>
                <Viewfinder f={f} w={JPH.w} h={JPH.h} u={u} out={out} />
                {joined ? (
                  <>
                    <At x={JPH.w / 2} y={JPH.h * 0.37}>
                      <Avatar shape={p.shape} color={p.color} size={130 * u} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${spr(f, J, POP)})`}} />
                    </At>
                    <div style={{position: 'absolute', left: 0, right: 0, top: JPH.h * 0.37 + 78 * u, fontSize: 30 * u, fontWeight: 800}}>
                      <Rise f={f} start={J + 3}>{p.name}</Rise>
                    </div>
                    <div style={{position: 'absolute', left: 22 * u, right: 22 * u, bottom: 56 * u, height: 62 * u, borderRadius: 999, background: C.success,
                      color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 * u, fontSize: 24 * u, fontWeight: 900,
                      transform: `scale(${spr(f, J + 4, POP)})`}}>
                      <CheckMark size={26 * u} color={C.ink} draw={prog(f, J + 6, J + 14, easeOut)} width={3.6} />
                      You’re in
                    </div>
                  </>
                ) : null}
              </div>
            </PhoneFrame>
          </div>
        </At>
      );
    })}
  </>
);

/** Magenta scan beam: shoots from the phone's top to the QR, landing on the join beat. */
export const Beams: React.FC<{f: number}> = ({f}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, zIndex: 9, overflow: 'visible'}}>
    {JOIN.map((jb, i) => {
      const J = b(jb);
      if (f < J - 12 || f > J + 4) return null;
      const head = prog(f, J - 12, J - 2, easeIn);
      const tail = prog(f, J - 6, J + 3, easeIn);
      if (tail >= 1) return null;
      const P0 = {x: jx(i), y: JY - JPH.h / 2 - 4}, Q = QR_CENTRE;
      return (
        <g key={i}>
          <line x1={lerp(P0.x, Q.x, tail)} y1={lerp(P0.y, Q.y, tail)} x2={lerp(P0.x, Q.x, head)} y2={lerp(P0.y, Q.y, head)}
            stroke={C.primary} strokeWidth={8} strokeLinecap="round" />
        </g>
      );
    })}
  </svg>
);
