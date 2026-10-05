import React from 'react';
import {Img, staticFile} from 'remotion';
import {C, PLAYERS, Player, ROOM_CODE} from '../brand';
import {At, Avatar, Bubble, FONT, PhoneFrame, Rise, WordFace} from '../parts';
import {QR, QR_N} from '../qr';
import {b, clamp, easeIn, easeInOut, easeOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {SAFE, SAFE_CX} from './common';
import {CheckMark} from './m2-icons';

/**
 * Stage objects for MA-E-M2 "How it works" (review-v2/uiux.md change 13, DECISIONS.md #12): one TV and five phones
 * that move between three layouts — HERO (TV alone, hook + step 1), ROOM (TV on top, five phones in a row: scan,
 * clues, vote, verdict) and GRID (camera tilts down to the phones, 3 + 2, big enough to read the secret words).
 * Everything is a pure function of the frame. Timings are in beats (ad beat 0 = the song's drop).
 */

// ---------------------------------------------------------------- timeline (beats)
export const T = {
  hop: [1, 2, 3], // hook: the amber ring hops between friends
  hookOut: 4,
  lobby: 4.5, // TV switches from the title screen to the lobby
  chips: [5.5, 6.5], // "Play in your browser now" / "Google TV app soon"
  code: 7.25, // room code letters
  chipsOut: 9,
  toRoom: 9.25, // TV moves up, friends take their seats
  join: [10.5, 11.5, 12.5, 13.5, 14.5], // phones scan and join, seat by seat
  toGrid: 15.4, // camera tilts down to the phones
  wordsIn: 15.3, // word screens open while the join screens leave (no empty-phone frames)
  flip: [16.5, 17.5, 0, 18.5, 19.5], // PIZZA x4 (seat order 0,1,3,4), Sami's is set below
  pasta: 20.75,
  ring: 21,
  tag: 21.75,
  toRoom2: 26.2, // back up to the TV
  board: 26.2,
  clue: [27.75, 28.75, 31.75, 29.75, 30.75], // per seat; Sami (seat 2) last
  cluesOut: 32.35,
  vote: 32.5, // phones switch to the vote screen
  tap: [33.5, 34, 35.5, 34.5, 35], // per seat
  stamp: 36.25,
  result: 37.25,
};
T.flip[2] = T.pasta;

// ---------------------------------------------------------------- cast + geometry
export const MOLE_SEAT = 2;
/** Seats left -> right. Sami (the Mole) sits in the middle. */
export const CAST: Player[] = [PLAYERS[0], PLAYERS[1], PLAYERS[5], PLAYERS[2], PLAYERS[3]];
export const CLUES = ['Cheese', 'Slice', 'Boiled?', 'Oven', 'Crust'];
export const VOTE_FOR = [2, 2, 1, 2, 2]; // everyone votes Sami, Sami votes Karim

export type Rect = {x: number; y: number; w: number; h: number};
const rl = (a: Rect, c: Rect, t: number): Rect => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});

const TV_HERO: Rect = {x: SAFE_CX, y: 860, w: 900, h: 506};
export const TV_ROOM: Rect = {x: SAFE_CX, y: 765, w: 800, h: 450};
const TV_UP: Rect = {x: SAFE_CX, y: -460, w: 800, h: 450};
const D = 1040; // TV design width (screen content is laid out at 1040 x 585)

export const tvRect = (f: number): Rect => {
  if (f < b(T.toRoom2) - 1 && f >= b(T.toGrid)) return rl(TV_ROOM, TV_UP, prog(f, b(T.toGrid), b(T.toGrid + 0.9), easeInOut));
  if (f >= b(T.toRoom2)) return rl(TV_UP, TV_ROOM, prog(f, b(T.toRoom2), b(T.toRoom2 + 0.9), easeInOut));
  return rl(TV_HERO, TV_ROOM, prog(f, b(T.toRoom), b(T.toRoom + 0.9), easeInOut));
};
/** A point in TV design units -> ad px, for the ROOM layout (steps 4–6, when the TV holds still). */
export const roomPt = (lx: number, ly: number) => {
  const s = TV_ROOM.w / D;
  return {x: TV_ROOM.x - TV_ROOM.w / 2 + lx * s, y: TV_ROOM.y - TV_ROOM.h / 2 + ly * s};
};

const ROW_Y = 1415;
const PW = 160, PH = 333;
export const seatX = (i: number) => SAFE_CX + (i - 2) * 180;
const ROW = (i: number): Rect => ({x: seatX(i), y: ROW_Y, w: PW, h: PH});
const GW = 245, GH = 510;
const GRID_POS = [{x: SAFE_CX - 170, y: 1352}, {x: SAFE_CX - 290, y: 825}, {x: SAFE_CX, y: 825}, {x: SAFE_CX + 290, y: 825}, {x: SAFE_CX + 170, y: 1352}];
const GRID = (i: number): Rect => ({...GRID_POS[i], w: GW, h: GH});
export const COUCH_Y = 1440;

export const phoneRect = (f: number, i: number): Rect => {
  const d = i * 1.5; // a hair of stagger so the five don't move as one block
  if (f >= b(T.toRoom2)) return rl(GRID(i), ROW(i), prog(f, b(T.toRoom2) + d, b(T.toRoom2 + 0.9) + d, easeInOut));
  return rl(ROW(i), GRID(i), prog(f, b(T.toGrid) + d, b(T.toGrid + 0.9) + d, easeInOut));
};

// ---------------------------------------------------------------- TV

const tileX = (i: number) => 520 + (i - 2) * 196;
const TILE_Y = 285;
const QR_C = {x: 165, y: 235};
export const QR_ROOM = roomPt(QR_C.x, QR_C.y);
const SLOT = (i: number) => (i < 3 ? {x: 485 + i * 190, y: 205} : {x: 580 + (i - 3) * 190, y: 375});

const TitleScreen: React.FC<{f: number}> = ({f}) => {
  const bob = Math.sin(f / 22) * 6;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <At x={520} y={215 + bob}><div style={{transform: 'scale(1)'}}><MarkImg size={210} /></div></At>
      <Img src={staticFile('wordmark-latin.svg')} style={{position: 'absolute', left: 520 - 300, top: 345, width: 600}} />
    </div>
  );
};
const MarkImg: React.FC<{size: number}> = ({size}) => (
  <Img src={staticFile('mark.svg')} style={{position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: size * 0.22,
    boxShadow: '0 20px 50px rgba(0,0,0,0.4)'}} />
);

const LobbyScreen: React.FC<{f: number; t0: number}> = ({f, t0}) => {
  const landed = T.join.filter((t) => f >= b(t)).length;
  const qrIn = spr(f, t0 + 2, SNAPPY);
  const bump = T.join.reduce((a, t) => a + (f > b(t) ? 0.05 * Math.sin(Math.PI * clamp((f - b(t)) / 12)) : 0), 0);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: 40, top: 40, width: 250, textAlign: 'center', fontSize: 26, fontWeight: 800, color: C.text2, letterSpacing: '0.06em'}}>
        <Rise f={f} start={t0 + 3}>Scan to join</Rise>
      </div>
      <div style={{position: 'absolute', left: QR_C.x - 125, top: QR_C.y - 125, width: 250, height: 250, borderRadius: 26, background: C.text,
        transform: `scale(${qrIn * (1 + bump)})`}}>
        <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} width="100%" height="100%">
          {QR.flatMap((row, r) => row.map((on, c) => {
            if (!on) return null;
            const dist = Math.hypot(r - QR_N / 2, c - QR_N / 2) / (QR_N / 2);
            const k = f >= t0 + 30 ? 1 : spr(f, t0 + 4 + dist * 14, {damping: 18, stiffness: 260});
            return k > 0.01 ? <rect key={`${r}-${c}`} x={c + (1 - k) / 2} y={r + (1 - k) / 2} width={k} height={k} fill={C.ink} /> : null;
          }))}
        </svg>
      </div>
      <div style={{position: 'absolute', left: 30, top: 382, width: 270, display: 'flex', justifyContent: 'space-between', fontSize: 104, fontWeight: 900,
        color: C.accent, lineHeight: 1}}>
        {ROOM_CODE.split('').map((ch, i) => <Rise key={i} f={f} start={b(T.code) + i * 3} cfg={POP}>{ch}</Rise>)}
      </div>
      <div style={{position: 'absolute', left: 25, top: 505, width: 280, textAlign: 'center', fontSize: 21, fontWeight: 700, color: C.text2}}>
        <Rise f={f} start={b(T.code) + 10}>room code</Rise>
      </div>
      <div style={{position: 'absolute', left: 400, top: 40, fontSize: 32, fontWeight: 800, color: C.text, display: 'flex', gap: 10}}>
        <Rise f={f} start={t0 + 4}>Players</Rise>
        <Rise key={landed} f={f} start={landed ? b(T.join[landed - 1]) : t0 + 5} cfg={POP}>
          <span style={{color: landed ? C.accent : C.text}}>{landed}</span>/12
        </Rise>
      </div>
      {CAST.map((p, i) => {
        const c = SLOT(i);
        const J = b(T.join[i]);
        const lit = f >= J;
        const s = spr(f, t0 + 4 + i * 2, SNAPPY);
        return (
          <div key={i} style={{position: 'absolute', left: c.x - 85, top: c.y - 75, width: 170, height: 150, transform: `scale(${s})`}}>
            {!lit ? <div style={{position: 'absolute', inset: 0, borderRadius: 24, border: `3px dashed ${C.outline}`}} /> : (
              <div style={{position: 'absolute', inset: 0, borderRadius: 24, background: C.surface, transform: `scale(${spr(f, J, POP)})`,
                boxShadow: `inset 0 0 0 2px ${C.outline}`}}>
                <At x={85} y={62}>
                  <Avatar shape={p.shape} color={p.color} size={76} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${spr(f, J + 2, POP)})`}} />
                </At>
                <div style={{position: 'absolute', left: 0, right: 0, top: 106, textAlign: 'center', fontSize: 26, fontWeight: 800, color: C.text}}>
                  <Rise f={f} start={J + 3}>{p.name}</Rise>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Round board: five tiles; the speaking tile lights up; votes collect under the tiles (drawn in ad space by Votes). */
const BoardScreen: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.board);
  const S = b(T.stamp);
  const after = f >= S;
  const head = f < b(T.vote) ? 'ROUND 1 · CLUES' : f < S ? 'VOTE ON YOUR PHONES' : 'ROUND 1 · RESULT';
  const headStart = f < b(T.vote) ? t0 + 30 : f < S ? b(T.vote) : S + 2;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: 40, top: 34, fontSize: 28, fontWeight: 800, letterSpacing: '0.12em', color: C.text2}}>
        <Rise key={head} f={f} start={headStart}>{head}</Rise>
      </div>
      <div style={{position: 'absolute', right: 40, top: 32, fontSize: 26, fontWeight: 900, letterSpacing: '0.14em', color: C.accent, background: C.surface,
        borderRadius: 99, padding: '2px 16px'}}>{ROOM_CODE}</div>
      {CAST.map((p, i) => {
        const x = tileX(i);
        const mole = i === MOLE_SEAT;
        const c0 = b(T.clue[i]);
        const speaking = f >= c0 - 4 && f < c0 + b(0.9) && f < b(T.cluesOut);
        const lit = speaking ? spr(f, c0 - 4, SNAPPY) : 0;
        const out = mole && after;
        const lose = !mole && after ? prog(f, S + 20, S + 32) : 0; // others desaturate (never dimmed below 70 %)
        return (
          <div key={i} style={{position: 'absolute', left: x - 88, top: TILE_Y - 118, width: 176, height: 236, borderRadius: 28, background: out ? mix(C.surface, C.accent, 0.18) : C.surface,
            boxShadow: out ? `inset 0 0 0 5px ${C.accent}` : `inset 0 0 0 ${2 + 3 * lit}px ${mix(C.outline, C.text, lit)}`,
            transform: `translateY(${-10 * lit}px) scale(${spr(f, t0 + 6 + i * 2, POP)})`, filter: lose > 0 ? `saturate(${1 - 0.5 * lose})` : undefined}}>
            <At x={88} y={98}>
              <Avatar shape={p.shape} color={p.color} size={112} initial={p.name[0]} cream={p.cream} />
            </At>
            <div style={{position: 'absolute', left: 0, right: 0, top: 172, textAlign: 'center', fontSize: 32, fontWeight: 800, color: C.text}}>{p.name}</div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 488, textAlign: 'center', fontSize: 58, fontWeight: 900, color: C.accent, lineHeight: 1}}>
        <Rise f={f} start={b(T.result) - 6} cfg={POP}>Sami was the Mole</Rise>
      </div>
    </div>
  );
};

export const Tv: React.FC<{f: number}> = ({f}) => {
  const r = tvRect(f);
  if (r.y + r.h / 2 < -60) return null;
  const s = r.w / D;
  const bez = 14 * s;
  // screen switches by an iris (circle) from the centre: title -> lobby, and lobby -> board while the TV is off-frame
  const L = b(T.lobby);
  const iris = prog(f, L, L + 14, easeOut);
  const showBoard = f >= b(T.toGrid + 1);
  const screenBg = `radial-gradient(120% 90% at 30% 0%, #5A2E9A 0%, ${C.bg} 65%)`;
  const layer = (child: React.ReactNode, clip?: string) => (
    <div style={{position: 'absolute', left: 0, top: 0, width: D, height: D * 9 / 16, transform: `scale(${s})`, transformOrigin: '0 0', fontFamily: FONT, color: C.text,
      background: screenBg, clipPath: clip}}>{child}</div>
  );
  return (
    <At x={r.x} y={r.y} z={20}>
      <div style={{position: 'absolute', left: -120 * s, top: r.h / 2 + bez - 2, width: 240 * s, height: 30 * s, background: '#0B0716', borderRadius: `0 0 ${16 * s}px ${16 * s}px`}} />
      <div style={{position: 'absolute', left: -r.w / 2 - bez, top: -r.h / 2 - bez, width: r.w + 2 * bez, height: r.h + 2 * bez, borderRadius: 34 * s,
        background: '#0B0716', boxShadow: `0 ${30 * s}px ${80 * s}px rgba(10,4,20,0.5), 0 0 ${150 * s}px rgba(255,79,154,0.28), inset 0 0 0 2px rgba(255,247,236,0.14)`}}>
        <div style={{position: 'absolute', left: bez, top: bez, width: r.w, height: r.h, borderRadius: 22 * s, overflow: 'hidden'}}>
          {showBoard ? layer(<BoardScreen f={f} />) : (
            <>
              {iris < 1 ? layer(<TitleScreen f={f} />) : null}
              {iris > 0 ? layer(<LobbyScreen f={f} t0={L} />, iris < 1 ? `circle(${iris * 620}px at 520px 292px)` : undefined) : null}
            </>
          )}
        </div>
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- step 1: where it runs

const LaptopIcon: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{display: 'block'}}>
    <rect x="4" y="4.5" width="16" height="11" rx="1.8" />
    <path d="M1.8 19.5h20.4" />
  </svg>
);
const TvIcon: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{display: 'block'}}>
    <rect x="2" y="4" width="20" height="13" rx="2.2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export const WhereChips: React.FC<{f: number}> = ({f}) => {
  const out = spr(f, b(T.chipsOut), {damping: 26, stiffness: 300});
  const chip = (k: number, solid: boolean, icon: React.ReactNode, text: React.ReactNode) => (
    <div style={{display: 'flex', alignItems: 'center', gap: 12, height: 76, padding: '0 26px 0 20px', borderRadius: 999, boxSizing: 'border-box',
      background: solid ? C.text : 'rgba(58,34,102,0.92)', color: solid ? C.ink : C.text, boxShadow: solid ? '0 10px 30px rgba(10,4,20,0.35)' : `inset 0 0 0 3px ${C.outline}`,
      fontFamily: FONT, fontWeight: 800, fontSize: 38, whiteSpace: 'nowrap', transform: `scale(${k * (1 - out)})`}}>
      {icon}{text}
    </div>
  );
  if (out > 0.99) return null;
  return (
    <div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: 1188, display: 'flex', justifyContent: 'center', gap: 18, zIndex: 25}}>
      {chip(spr(f, b(T.chips[0]), POP), true, <LaptopIcon size={42} color={C.ink} />, <span>Browser: <b style={{fontWeight: 900}}>now</b></span>)}
      {chip(spr(f, b(T.chips[1]), POP), false, <TvIcon size={42} color={C.accent} />, <span>Google TV app: <span style={{color: C.accent}}>soon</span></span>)}
    </div>
  );
};

// ---------------------------------------------------------------- friends on the couch (hook) -> phones

/** Hook + step 1: the five friends in front of the TV; an amber ring hops between them ("one of you is lying"). */
export const Couch: React.FC<{f: number}> = ({f}) => {
  const seatY = lerp(COUCH_Y, ROW_Y, prog(f, b(T.toRoom), b(T.toRoom + 0.9), easeInOut));
  const ringSeat = [3, 0, 4, 1];
  const hopT = (k: number) => prog(f, b(T.hop[k]) - 9, b(T.hop[k]), easeInOut);
  let rx = seatX(ringSeat[0]);
  T.hop.forEach((_, k) => { rx = lerp(rx, seatX(ringSeat[k + 1]), hopT(k)); });
  const ringK = spr(f, -40, POP) * (1 - spr(f, b(T.hookOut), {damping: 26, stiffness: 300}));
  return (
    <>
      {CAST.map((p, i) => {
        const pre = b(T.join[i]) - 24;
        const gone = spr(f, pre, {damping: 24, stiffness: 300});
        if (gone > 0.99) return null;
        const k = spr(f, -40 + i * 3, POP) * (1 - gone);
        return (
          <At key={i} x={seatX(i)} y={seatY} z={14}>
            <Avatar shape={p.shape} color={p.color} size={128} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${k})`}} />
            <div style={{position: 'absolute', left: -90, width: 180, top: 74, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 34, color: C.text,
              transform: `scale(${k})`, textShadow: '0 2px 10px rgba(14,6,28,0.6)'}}>{p.name}</div>
          </At>
        );
      })}
      {ringK > 0.01 ? (
        <At x={rx} y={COUCH_Y} z={15}>
          <div style={{position: 'absolute', left: -86, top: -86, width: 172, height: 172, borderRadius: 999, boxShadow: `inset 0 0 0 8px ${C.accent}, 0 0 30px rgba(255,201,77,0.45)`,
            transform: `scale(${ringK})`}} />
        </At>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------- phone screens

const Viewfinder: React.FC<{f: number; w: number; h: number; u: number; out: number}> = ({f, w, h, u, out}) => {
  const k = 1 - out;
  if (k <= 0.001) return null;
  const s = 190 * u, arm = 46 * u, t = 8 * u;
  const scan = (f / 26) % 1;
  const corner = (sx: number, sy: number) => (
    <div style={{position: 'absolute', left: sx < 0 ? 0 : s - arm, top: sy < 0 ? 0 : s - arm, width: arm, height: arm, boxSizing: 'border-box',
      borderLeft: sx < 0 ? `${t}px solid ${C.text}` : undefined, borderRight: sx > 0 ? `${t}px solid ${C.text}` : undefined,
      borderTop: sy < 0 ? `${t}px solid ${C.text}` : undefined, borderBottom: sy > 0 ? `${t}px solid ${C.text}` : undefined}} />
  );
  return (
    <div style={{position: 'absolute', left: w / 2 - s / 2, top: h * 0.4 - s / 2, width: s, height: s, transform: `scale(${k})`}}>
      {corner(-1, -1)}{corner(1, -1)}{corner(-1, 1)}{corner(1, 1)}
      <div style={{position: 'absolute', left: 16 * u, right: 16 * u, top: lerp(18 * u, s - 18 * u, 0.5 - 0.5 * Math.cos(scan * Math.PI * 2)), height: 6 * u,
        borderRadius: 9, background: C.primary}} />
    </div>
  );
};

/** Join screen: viewfinder until the scan lands on the join beat, then avatar + name + "You're in". */
const JoinFace: React.FC<{f: number; i: number; w: number; h: number}> = ({f, i, w, h}) => {
  const p = CAST[i];
  const u = w / 300;
  const J = b(T.join[i]);
  const exit = spr(f, b(T.toGrid) - 2, {damping: 26, stiffness: 300});
  if (exit > 0.99) return null;
  const vf = prog(f, J - 2, J + 7, easeIn);
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text, textAlign: 'center', transform: `scale(${1 - exit})`}}>
      <Viewfinder f={f} w={w} h={h} u={u} out={vf} />
      {f < J ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: h * 0.4 + 120 * u, fontSize: 24 * u, fontWeight: 800, color: C.text2}}>Scan the TV</div>
      ) : (
        <>
          <At x={w / 2} y={h * 0.36}>
            <Avatar shape={p.shape} color={p.color} size={140 * u} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${spr(f, J, POP)})`}} />
          </At>
          <div style={{position: 'absolute', left: 0, right: 0, top: h * 0.36 + 84 * u, fontSize: 34 * u, fontWeight: 800}}>
            <Rise f={f} start={J + 3}>{p.name}</Rise>
          </div>
          <div style={{position: 'absolute', left: 24 * u, right: 24 * u, bottom: 60 * u, height: 66 * u, borderRadius: 999, background: C.success, color: C.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 * u, fontSize: 27 * u, fontWeight: 900, transform: `scale(${spr(f, J + 4, POP)})`}}>
            <CheckMark size={28 * u} color={C.ink} draw={prog(f, J + 6, J + 14, easeOut)} width={3.6} />
            You’re in
          </div>
        </>
      )}
    </div>
  );
};

/** Vote screen: "Who's the Mole?" and the other four players as big buttons; the tap lands on the beat. */
const VoteFace: React.FC<{f: number; i: number; w: number; h: number}> = ({f, i, w, h}) => {
  const u = w / 300;
  const in0 = b(T.vote) + i * 2;
  const k = spr(f, in0, SNAPPY);
  if (k <= 0.001) return null;
  const tap = b(T.tap[i]);
  const others = CAST.map((_, j) => j).filter((j) => j !== i);
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text, textAlign: 'center'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 88 * u, fontSize: 36 * u, fontWeight: 900, lineHeight: 1.05, transform: `scale(${k})`}}>
        Who’s the<br />Mole?
      </div>
      {others.map((j, n) => {
        const p = CAST[j];
        const x = w / 2 + (n % 2 ? 68 : -68) * u, y = (300 + Math.floor(n / 2) * 150) * u;
        const chosen = VOTE_FOR[i] === j && f >= tap;
        const press = chosen ? 1 - 0.12 * Math.sin(Math.PI * clamp((f - tap) / 10)) : 1;
        return (
          <At key={j} x={x} y={y}>
            <div style={{position: 'absolute', left: -62 * u, top: -62 * u, width: 124 * u, height: 124 * u, borderRadius: 30 * u,
              background: chosen ? mix(C.surface, C.accent, 0.25) : C.surface, boxShadow: chosen ? `inset 0 0 0 ${6 * u}px ${C.accent}` : `inset 0 0 0 ${2 * u}px ${C.outline}`,
              transform: `scale(${spr(f, in0 + 2 + n * 2, POP) * press})`}}>
              <At x={62 * u} y={62 * u}><Avatar shape={p.shape} color={p.color} size={84 * u} initial={p.name[0]} cream={p.cream} /></At>
            </div>
          </At>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 56 * u, fontSize: 24 * u, fontWeight: 800, color: f >= tap ? C.success : C.muted, transform: `scale(${k})`}}>
        {f >= tap ? 'Vote sent' : 'Tap to vote'}
      </div>
    </div>
  );
};

export const Phones: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map((p, i) => {
      const J = b(T.join[i]);
      const appear = J - 24;
      if (f < appear) return null;
      const r = phoneRect(f, i);
      const pop = spr(f, appear, POP);
      const u = r.w / 300;
      const mole = i === MOLE_SEAT;
      // the Mole is pointed out OUTSIDE his phone: amber ring + 6° wobble, and an amber tag
      const ringIn = mole ? spr(f, b(T.ring), POP) * (1 - spr(f, b(T.toRoom2) - 6, {damping: 26, stiffness: 300})) : 0;
      const wob = mole ? 6 * (spr(f, b(T.ring), POP) - spr(f, b(T.ring) + 8, POP)) : 0;
      const gap = lerp(40, 18, ringIn);
      const bez = Math.max(3, r.w * 0.035);
      return (
        <At key={i} x={r.x} y={r.y} z={mole ? 31 : 30}>
          <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${wob}deg) scale(${pop})`}}>
            {ringIn > 0.01 ? (
              <div style={{position: 'absolute', left: -r.w / 2 - bez - gap, top: -r.h / 2 - bez - gap, width: r.w + 2 * (bez + gap), height: r.h + 2 * (bez + gap),
                borderRadius: r.w * 0.14 + bez + gap, boxShadow: `inset 0 0 0 8px ${C.accent}, 0 0 40px rgba(255,201,77,0.4)`, opacity: 1}} />
            ) : null}
            <div style={{position: 'absolute', left: 0, top: 0}}>
              <PhoneFrame w={r.w} h={r.h} screen={C.bg}>
                <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 2px rgba(255,247,236,0.10)', borderRadius: r.w * 0.14}} />
                {f < b(T.toGrid) + 10 ? <JoinFace f={f} i={i} w={r.w} h={r.h} /> : null}
                {f >= b(T.wordsIn) && f < b(T.vote) + 30 ? (
                  <WordFace f={f} w={r.w} h={r.h} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={p.word}
                    flipAt={b(T.flip[i]) - 6} contentIn={b(T.wordsIn) + i * 2} out={b(T.vote) - 6} code={ROOM_CODE} />
                ) : null}
                {f >= b(T.vote) ? <VoteFace f={f} i={i} w={r.w} h={r.h} /> : null}
              </PhoneFrame>
            </div>
          </div>
          {mole ? <MoleTag f={f} y={r.h / 2 + bez + gap} u={u} /> : null}
        </At>
      );
    })}
  </>
);

const MoleTag: React.FC<{f: number; y: number; u: number}> = ({f, y}) => {
  const k = spr(f, b(T.tag), POP) * (1 - spr(f, b(T.toRoom2) - 6, {damping: 26, stiffness: 300}));
  if (k <= 0.01) return null;
  return (
    <div style={{position: 'absolute', left: -150, top: y - 36, width: 300, height: 72, display: 'flex', justifyContent: 'center', zIndex: 5}}>
      <div style={{height: 72, padding: '0 30px', borderRadius: 999, background: C.accent, color: C.ink, fontFamily: FONT, fontWeight: 900, fontSize: 44,
        display: 'flex', alignItems: 'center', letterSpacing: '0.04em', boxShadow: '0 10px 28px rgba(10,4,20,0.45)', transform: `rotate(-3deg) scale(${k})`}}>
        THE MOLE
      </div>
    </div>
  );
};

/** Magenta scan beams: phone top -> QR on the TV, landing on the join beat. */
export const Beams: React.FC<{f: number}> = ({f}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, zIndex: 22, overflow: 'visible'}}>
    {T.join.map((jb, i) => {
      const J = b(jb);
      if (f < J - 12 || f > J + 4) return null;
      const head = prog(f, J - 12, J - 2, easeIn);
      const tail = prog(f, J - 6, J + 3, easeIn);
      if (tail >= 1) return null;
      const P0 = {x: seatX(i), y: ROW_Y - PH / 2 - 8}, Q = QR_ROOM;
      return <line key={i} x1={lerp(P0.x, Q.x, tail)} y1={lerp(P0.y, Q.y, tail)} x2={lerp(P0.x, Q.x, head)} y2={lerp(P0.y, Q.y, head)}
        stroke={C.primary} strokeWidth={10} strokeLinecap="round" />;
    })}
  </svg>
);

// ---------------------------------------------------------------- clues, votes, verdict

const CLUE_SIZE = 54;
export const Clues: React.FC<{f: number}> = ({f}) => {
  const out = spr(f, b(T.cluesOut), {damping: 26, stiffness: 300});
  if (out > 0.99) return null;
  return (
    <>
      {CAST.map((_, i) => {
        const s = spr(f, b(T.clue[i]), POP) * (1 - out);
        if (s <= 0.001) return null;
        const text = CLUES[i];
        const estW = text.length * CLUE_SIZE * 0.55 + CLUE_SIZE * 1.2;
        const x = seatX(i);
        const cx = clamp(x, SAFE.left + estW / 2, SAFE.right - estW / 2);
        const y = i % 2 ? 1108 : 1226;
        return (
          <At key={i} x={x} y={y} z={40}>
            {/* tail stays over the phone, the bubble body is nudged inside the safe zone */}
            <div style={{position: 'absolute', left: cx - x, top: 0}}><Bubble text={text} s={s} size={CLUE_SIZE} /></div>
          </At>
        );
      })}
    </>
  );
};

/** Each vote is the voter's avatar flying from the phone to a slot under the chosen tile on the TV. */
export const Votes: React.FC<{f: number}> = ({f}) => {
  const counts: number[] = [0, 0, 0, 0, 0];
  const order = CAST.map((_, i) => i).sort((a, c) => T.tap[a] - T.tap[c]);
  return (
    <>
      {order.map((i) => {
        const tgt = VOTE_FOR[i];
        const n = counts[tgt]++;
        const tap = b(T.tap[i]);
        if (f < tap) return null;
        const t = prog(f, tap, tap + 16, easeInOut);
        const total = VOTE_FOR.filter((v) => v === tgt).length;
        const end = roomPt(tileX(tgt) + (n - (total - 1) / 2) * 46, 440);
        const start = {x: seatX(i), y: ROW_Y - PH / 2 + 40};
        const x = lerp(start.x, end.x, t), y = lerp(start.y, end.y, t) - Math.sin(Math.PI * t) * 90;
        const size = lerp(60, 36, t);
        const land = f > tap + 16 ? 1 + 0.25 * Math.sin(Math.PI * clamp((f - tap - 16) / 8)) : 1;
        const p = CAST[i];
        return (
          <At key={i} x={x} y={y} z={45}>
            <div style={{transform: `scale(${land})`}}><Avatar shape={p.shape} color={p.color} size={size} /></div>
          </At>
        );
      })}
    </>
  );
};

const STAMP_AT = roomPt(tileX(MOLE_SEAT), TILE_Y + 92); // over the name, so Sami's hexagon stays visible
export const STAMP_PT = STAMP_AT;

/** The TV's verdict stamp: amber "OUT", −8°, slams onto Sami's tile (in ad space, so it reads at full size). */
export const Stamp: React.FC<{f: number}> = ({f}) => {
  const S = b(T.stamp);
  if (f < S - 7) return null;
  const slam = f < S ? lerp(1.8, 1, easeIn(clamp((f - S + 7) / 7))) : 1 + 0.08 * (1 - spr(f, S, POP));
  return (
    <At x={STAMP_AT.x} y={STAMP_AT.y} z={160}>
      <div style={{position: 'absolute', left: -108, top: -46, width: 216, height: 92, borderRadius: 18, background: C.accent, boxSizing: 'border-box',
        border: `6px solid ${C.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 66,
        color: C.ink, letterSpacing: '0.06em', boxShadow: '0 18px 44px rgba(0,0,0,0.45)', transform: `rotate(-8deg) scale(${slam})`}}>
        OUT
      </div>
    </At>
  );
};

/** The one full-screen colour flash (DECISIONS.md #7): amber from the stamp, full colour ≤ 10 frames, then a hole opens from the stamp. */
export const Flash: React.FC<{f: number}> = ({f}) => {
  const S = b(T.stamp);
  if (f < S || f > S + 30) return null;
  const {x, y} = STAMP_AT;
  const R = Math.hypot(Math.max(x, 1080 - x), Math.max(y, 1920 - y)) * 1.04;
  const grow = R * prog(f, S, S + 9, easeOut);
  const hole = R * prog(f, S + 12, S + 30, easeOut); // full colour ≈ S+8..S+14
  const mask = hole > 0 ? `radial-gradient(circle at ${x}px ${y}px, transparent ${hole}px, #000 ${hole + 1}px)` : undefined;
  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 150, clipPath: `circle(${grow}px at ${x}px ${y}px)`, background: C.accent,
      WebkitMaskImage: mask, maskImage: mask}} />
  );
};


