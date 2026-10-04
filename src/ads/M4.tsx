import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, Player, PLAYERS, ROOM_CODE} from '../brand';
import {At, Avatar, Bubble, FONT, PhoneFrame, Rise, WordFace} from '../parts';
import {b, clamp, easeIn, easeInOut, easeOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AD_H, AD_W, AdCaption, BgFlood, Hit, SAFE_CX} from './common';

/**
 * MA_B_M4 "Stop passing the phone" (angle B, motion only). One continuous take, ad beat 0 = the song's drop.
 * Hook (pre-settled on frame 0): five players round a table stare at ONE grey phone that whips from hand to hand
 * (b0.5-b1.5) -> Joe reads his word, Sami leans in and peeks (b2.25) -> Joe slams it face-down (b3) -> the toss is
 * fumbled and the phone lands on the table (b4.25) -> a magenta flood bursts out of it (b4.75) and contracts into
 * five phones of their own (b5.5) whose word cards flip on the beat: PIZZA x4, then Sami's PASTA (b9; pointed out
 * only from outside: amber ring + glitch) -> cards hide, the phones drop into a row of controllers while a magenta
 * line opens into the TV (b11) -> clues on the TV, votes fly up from the phones, the TV stamps OUT (b17) -> the
 * phones flip their words one last time -> the backdrop floods out of the stamp into the end card.
 */
export const M4_BODY_FRAMES = Math.round(b(22.75));

// ---------------------------------------------------------------- beat grid
const T = {
  pass: [0.5, 1, 1.5], // Maya -> Karim -> Lea -> Joe
  read: 2, // Joe's screen shows his word
  peek: 2.25, // Sami leans in
  slam: 3, // Joe flips the phone face-down
  toss: 3.5,
  land: 4.25,
  flood: 4.75,
  split: 5.5,
  flips: [6.75, 7.25, 7.75, 8.25, 9], // PIZZA x4, then PASTA
  hide: 10.55,
  shrink: 10.75,
  line: 11,
  open: 11.35,
  tvOn: 12,
  clues: [12.75, 13.25, 13.75],
  lean: 13.95,
  votes: [14.5, 15, 15.5, 16],
  stamp: 17,
  moleLine: 17.6,
  push: 18,
  reveal: [19, 19.5, 20, 20.5, 21],
};
const FL = b(T.flood);
const FLOOD = 21; // frames for a flood to clear the farthest corner (0.35 s)
const END = M4_BODY_FRAMES - 22;

// ---------------------------------------------------------------- cast
const CAST: Player[] = [0, 1, 2, 3, 5].map((i) => PLAYERS[i]); // Maya, Karim, Lea, Joe, Sami
const MOLE = 4;
const CLUE_BY = [0, 2, 4]; // Maya "Cheese", Lea "Oven", Sami "Boiled?"

type Rect = {x: number; y: number; w: number; h: number};
const rl = (a: Rect, c: Rect, t: number): Rect => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});
const farthest = (x: number, y: number) => Math.hypot(Math.max(x, AD_W - x), Math.max(y, AD_H - y)) * 1.05;

// ---------------------------------------------------------------- hook geometry: the table
const RING = {x: SAFE_CX, y: 965, r: 352};
const AV = 150;
const seat = (i: number) => {
  const a = (i * 72 * Math.PI) / 180;
  return {x: RING.x + RING.r * Math.sin(a), y: RING.y - RING.r * Math.cos(a)};
};
const OW = 176, OH = 360; // the old shared phone
/** The phone rides just inside whoever holds it: the orbit tightens where the phone's long side faces the seat. */
const orbit = (th: number) => RING.r - (AV / 2 + 14 + (OH / 2) * Math.abs(Math.cos(th)) + (OW / 2) * Math.abs(Math.sin(th)));
const LAND = {x: RING.x + 6, y: RING.y + 18};

/** Camera move 1: a slow push on the table during the hook (about the table centre). */
const hookZ = (f: number) => 1 + 0.05 * prog(f, 0, FL, easeInOut);
const toScreen = (p: {x: number; y: number}, z: number) => ({x: RING.x + (p.x - RING.x) * z, y: RING.y + (p.y - RING.y) * z});

const holder = (f: number) => T.pass.reduce((a, t) => a + spr(f, b(t) - 6, {damping: 17, stiffness: 240, mass: 0.9}), 0);

/** Where the shared phone is, how it is turned, and which side shows. */
const oldPhone = (f: number) => {
  const h = holder(f);
  const th = (h * 72 * Math.PI) / 180;
  let x = RING.x + orbit(th) * Math.sin(th);
  let y = RING.y - orbit(th) * Math.cos(th);
  const frac = h - Math.floor(h);
  let rot = 9 * Math.sin(th) + 7 * Math.sin(Math.PI * clamp(frac));
  let s = 1 + 0.07 * Math.sin(Math.PI * clamp(frac));
  // toss: Joe throws it to Sami, nobody catches it, it tumbles onto the table
  const t = prog(f, b(T.toss), b(T.land), (v) => v);
  if (t > 0) {
    const p0 = {x, y};
    const ctl = {x: seat(MOLE).x + 70, y: seat(MOLE).y - 110};
    const e = easeIn(t) * 0.55 + t * 0.45;
    x = (1 - e) ** 2 * p0.x + 2 * (1 - e) * e * ctl.x + e * e * LAND.x;
    y = (1 - e) ** 2 * p0.y + 2 * (1 - e) * e * ctl.y + e * e * LAND.y;
    rot = lerp(rot, -374, easeOut(t));
    s = 1 + 0.14 * Math.sin(Math.PI * t);
  }
  if (f >= b(T.land)) {
    const k = f - b(T.land);
    s = 1 - 0.07 * Math.sin(Math.min(k, 14) * 0.45) * Math.exp(-k / 6);
  }
  const tf = prog(f, b(T.slam) - 5, b(T.slam) + 5, easeInOut);
  return {x, y, rot, s, sx: Math.max(0.02, Math.abs(Math.cos(Math.PI * tf))), back: tf >= 0.5};
};

/** Avatar with eyes that track a point (the shared phone). */
const Peeker: React.FC<{p: Player; size: number; look: {x: number; y: number}; from: {x: number; y: number}; wide?: number}> = ({p, size, look, from, wide = 0}) => {
  const dx = look.x - from.x, dy = look.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const reach = size * (0.045 + 0.025 * wide);
  const px = (dx / d) * reach, py = (dy / d) * reach;
  const ey = p.shape === 'triangle' ? size * 0.14 : p.shape === 'star' ? size * 0.02 : -size * 0.03;
  const ew = size * (0.16 + 0.03 * wide), eh = size * (0.2 + 0.04 * wide);
  const eye = (sx: number) => (
    <div key={sx} style={{position: 'absolute', left: sx * size * 0.15 - ew / 2, top: ey - eh / 2, width: ew, height: eh, borderRadius: '50%',
      background: C.text, boxShadow: `0 0 0 ${size * 0.022}px ${C.ink}`}}>
      <div style={{position: 'absolute', left: ew / 2 - size * 0.045 + px, top: eh / 2 - size * 0.045 + py, width: size * 0.09, height: size * 0.09,
        borderRadius: 99, background: C.ink}} />
    </div>
  );
  return (
    <>
      <Avatar shape={p.shape} color={p.color} size={size} style={{filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.28))'}} />
      {eye(-1)}
      {eye(1)}
    </>
  );
};

/** The generic grey screen of "pass one phone around" games (deliberately not our UI). */
const OldScreen: React.FC<{f: number}> = ({f}) => {
  const k = T.pass.filter((t) => f >= b(t) - 2).length; // who holds it now
  const reading = f >= b(T.read);
  const next = CAST[Math.min(k + 1, 4)].name.toUpperCase();
  const box: React.CSSProperties = {position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: FONT, color: '#2B2733'};
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {!reading ? (
        <>
          <div style={{...box, top: 104, fontSize: 19, fontWeight: 800, letterSpacing: '0.16em', color: '#6E6878'}}>PASS TO</div>
          <div style={{...box, top: 132, fontSize: 44, fontWeight: 900, lineHeight: 1.1}}>
            <Rise key={k} f={f} start={k === 0 ? -40 : b(T.pass[k - 1]) - 2} cfg={POP}>{next}</Rise>
          </div>
          <div style={{...box, top: 226, fontSize: 15, fontWeight: 700, color: '#6E6878', lineHeight: 1.3}}>Don’t let anyone<br />see the screen!</div>
        </>
      ) : (
        <>
          <div style={{...box, top: 100, fontSize: 17, fontWeight: 800, color: '#6E6878'}}>Joe, your word:</div>
          <div style={{position: 'absolute', left: 22, right: 22, top: 136, height: 96, borderRadius: 14, background: '#F4F2F7', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transform: `scale(${spr(f, b(T.read), POP)})`}}>
            <span style={{fontFamily: FONT, fontSize: 40, fontWeight: 900, color: '#2B2733'}}>PIZZA</span>
          </div>
          <div style={{...box, top: 252, fontSize: 15, fontWeight: 700, color: '#6E6878'}}>Then pass it on</div>
        </>
      )}
      <div style={{position: 'absolute', left: 40, right: 40, bottom: 22, height: 6, borderRadius: 9, background: '#9E98A8'}} />
    </div>
  );
};

const PhoneBack: React.FC = () => (
  <div style={{position: 'absolute', left: -OW / 2 - 6, top: -OH / 2 - 6, width: OW + 12, height: OH + 12, borderRadius: OW * 0.14 + 6,
    background: 'linear-gradient(160deg, #3A3444 0%, #24202C 100%)', boxShadow: '0 14px 34px rgba(0,0,0,0.45)'}}>
    <div style={{position: 'absolute', left: 18, top: 18, width: 64, height: 64, borderRadius: 18, background: '#16131B'}}>
      <div style={{position: 'absolute', left: 9, top: 9, width: 20, height: 20, borderRadius: 99, background: '#05030A', boxShadow: '0 0 0 3px #4A4456'}} />
      <div style={{position: 'absolute', left: 35, top: 35, width: 20, height: 20, borderRadius: 99, background: '#05030A', boxShadow: '0 0 0 3px #4A4456'}} />
    </div>
  </div>
);

/** Magenta arcs between the seats, pointing clockwise: the way the phone goes round. Each one ticks on its pass. */
const ARC_R = 262;
const PassArrows: React.FC<{f: number}> = ({f}) => {
  const gone = spr(f, b(T.toss), {damping: 26, stiffness: 300});
  return (
    <svg width={AD_W} height={AD_H} style={{position: 'absolute', left: 0, top: 0, zIndex: 9, overflow: 'visible'}}>
      {CAST.map((_, i) => {
        const a0 = ((i * 72 + 22) * Math.PI) / 180, a1 = ((i * 72 + 50) * Math.PI) / 180;
        const draw = spr(f, -50 + i * 4, SNAPPY) * (1 - gone);
        if (draw < 0.01) return null;
        const pt = (a: number, r = ARC_R) => ({x: RING.x + r * Math.sin(a), y: RING.y - r * Math.cos(a)});
        const p0 = pt(a0), p1 = pt(lerp(a0, a1, draw));
        const tick = i < T.pass.length && f > b(T.pass[i]) - 8 && f < b(T.pass[i]) + 8 ? Math.sin(Math.PI * ((f - b(T.pass[i]) + 8) / 16)) : 0;
        const tip = lerp(a0, a1, draw);
        const head = 20;
        const tp = pt(tip), dirA = tip + Math.PI / 2; // tangent (clockwise)
        const tx = Math.sin(dirA), ty = -Math.cos(dirA);
        const nx = -ty, ny = tx;
        return (
          <g key={i} style={{transform: `scale(${1 + 0.08 * tick})`, transformOrigin: `${RING.x}px ${RING.y}px`}}>
            <path d={`M${p0.x} ${p0.y} A${ARC_R} ${ARC_R} 0 0 1 ${p1.x} ${p1.y}`} fill="none" stroke={mix(C.outline, C.primary, 0.55 + 0.45 * tick)} strokeWidth={8} strokeLinecap="round" />
            <path d={`M${tp.x + tx * head * 0.6} ${tp.y + ty * head * 0.6} L${tp.x - tx * head * 0.5 + nx * head * 0.6} ${tp.y - ty * head * 0.5 + ny * head * 0.6} L${tp.x - tx * head * 0.5 - nx * head * 0.6} ${tp.y - ty * head * 0.5 - ny * head * 0.6}Z`}
              fill={mix(C.outline, C.primary, 0.55 + 0.45 * tick)} />
          </g>
        );
      })}
    </svg>
  );
};

const Hook: React.FC<{f: number}> = ({f}) => {
  if (f >= FL + FLOOD) return null;
  const z = hookZ(f);
  const ph = oldPhone(f);
  const lean = spr(f, b(T.peek), POP) - spr(f, b(T.slam) + 2, SNAPPY);
  const flinch = f > b(T.slam) && f < b(T.slam) + 14 ? Math.sin(((f - b(T.slam)) / 14) * Math.PI) : 0;
  const k = Math.round(holder(f));
  const sight = prog(f, b(T.peek) + 2, b(T.peek) + 10, easeOut) * (f < b(T.slam) ? 1 : 0);
  return (
    <div style={{position: 'absolute', inset: 0, transformOrigin: `${RING.x}px ${RING.y}px`, transform: `scale(${z})`}}>
      {/* the table */}
      <At x={RING.x} y={RING.y}>
        <div style={{position: 'absolute', left: -228, top: -228, width: 456, height: 456, borderRadius: 999, background: C.surface,
          boxShadow: `inset 0 0 0 3px ${C.outline}, 0 30px 80px rgba(0,0,0,0.35)`, transform: `scale(${spr(f, -60, SOFT)})`}} />
      </At>
      <PassArrows f={f} />
      {CAST.map((p, i) => {
        const s0 = seat(i);
        const peeker = i === MOLE;
        const dir = {x: ph.x - s0.x, y: ph.y - s0.y};
        const dl = Math.hypot(dir.x, dir.y) || 1;
        const reach = peeker ? 92 * lean - 20 * flinch : 0;
        // everyone hops when the phone reaches them; all of them twitch when it lands
        const t0 = i >= 1 && i <= T.pass.length ? b(T.pass[i - 1]) : -999;
        const hop = f > t0 - 4 && f < t0 + 12 ? 16 * Math.sin(Math.PI * ((f - t0 + 4) / 16)) : 0;
        const land = f > b(T.land) && f < b(T.land) + 14 ? 14 * Math.sin(Math.PI * ((f - b(T.land)) / 14)) : 0;
        const x = s0.x + (dir.x / dl) * reach, y = s0.y + (dir.y / dl) * reach - hop - land;
        const holds = k === i && f < b(T.toss);
        return (
          <React.Fragment key={p.name}>
            <At x={x} y={y} z={peeker ? 14 : 10}>
              <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${spr(f, -50 - i * 3, POP) * (1 + 0.1 * lean * (peeker ? 1 : 0))}) rotate(${peeker ? 10 * lean : 0}deg)`}}>
                <Peeker p={p} size={AV} look={ph} from={{x, y}} wide={peeker ? lean : land / 14} />
              </div>
            </At>
            <div style={{position: 'absolute', left: s0.x - 120, width: 240, top: i === 0 ? s0.y - AV / 2 - 46 : s0.y + AV / 2 + 10, textAlign: 'center', fontFamily: FONT, fontWeight: 800,
              fontSize: 34, lineHeight: 1, color: holds ? C.text : C.text2, zIndex: 15}}>
              <Rise f={f} start={-40}>{p.name}</Rise>
            </div>
          </React.Fragment>
        );
      })}
      {/* Sami's sight line onto Joe's screen */}
      {sight > 0 ? (() => {
        const s0 = seat(MOLE);
        const dir = {x: ph.x - s0.x, y: ph.y - s0.y};
        const dl = Math.hypot(dir.x, dir.y);
        const e = {x: s0.x + (dir.x / dl) * 92 * lean, y: s0.y + (dir.y / dl) * 92 * lean - 4};
        const q = {x: lerp(e.x, ph.x, sight), y: lerp(e.y, ph.y - 10, sight)};
        return (
          <svg width={AD_W} height={AD_H} style={{position: 'absolute', left: 0, top: 0, zIndex: 13, overflow: 'visible'}}>
            <line x1={e.x} y1={e.y} x2={q.x} y2={q.y} stroke={C.primary} strokeWidth={9} strokeLinecap="round" strokeDasharray="2 22" />
          </svg>
        );
      })() : null}
      {/* the one shared phone */}
      <At x={ph.x} y={ph.y} z={12}>
        <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${ph.rot}deg) scale(${ph.s}) scaleX(${ph.sx})`}}>
          {ph.back ? <PhoneBack /> : (
            <PhoneFrame w={OW} h={OH} screen="#CFCAD8">
              <OldScreen f={f} />
            </PhoneFrame>
          )}
        </div>
      </At>
    </div>
  );
};

/** Flood 1: magenta bursts out of the dropped phone and clears the farthest corner in 0.35 s. */
const Burst: React.FC<{f: number}> = ({f}) => {
  if (f < FL || f >= FL + FLOOD) return null;
  const c = toScreen(LAND, hookZ(FL));
  const r = farthest(c.x, c.y) * prog(f, FL, FL + FLOOD, easeIn);
  return <div style={{position: 'absolute', left: c.x - r, top: c.y - r, width: 2 * r, height: 2 * r, borderRadius: '50%', background: C.primary, zIndex: 40}} />;
};

// ---------------------------------------------------------------- five phones of their own

const PH = 470, PW = PH * 0.48;
const FAN: Rect[] = [
  {x: SAFE_CX - 268, y: 760, w: PW, h: PH}, {x: SAFE_CX, y: 735, w: PW, h: PH}, {x: SAFE_CX + 268, y: 760, w: PW, h: PH},
  {x: SAFE_CX - 140, y: 1270, w: PW, h: PH}, {x: SAFE_CX + 140, y: 1270, w: PW, h: PH},
];
// full-frame regions (overlapping by 2 px) the flood splits into
const REGION: Rect[] = [
  {x: 180, y: 480, w: 362, h: 962}, {x: 540, y: 480, w: 362, h: 962}, {x: 900, y: 480, w: 362, h: 962},
  {x: 270, y: 1440, w: 542, h: 962}, {x: 810, y: 1440, w: 542, h: 962},
];
const RW = 160, RH = 333;
const ROW: Rect[] = CAST.map((_, i) => ({x: SAFE_CX + (i - 2) * 176, y: 1330, w: RW, h: RH}));

/** Time fed to WordFace so its card flips face-up on `flips[i]`, back down on `hide`, and up again on `reveal[i]`. */
const cardTime = (f: number, i: number) => {
  const F0 = b(T.flips[i]) - 6;
  const H = b(T.hide) + i * 2;
  const R = b(T.reveal[i]) - 6;
  if (f < H) return f;
  if (f < R) return Math.max(F0 - 1, F0 + 12 - (f - H));
  return F0 + (f - R);
};

const phoneRect = (f: number, i: number): Rect => {
  const split = prog(f, b(T.split), b(T.split + 0.75), easeInOut);
  const m = prog(f, b(T.shrink) + i * 2, b(T.shrink + 0.75) + i * 2, easeInOut);
  return rl(rl(REGION[i], FAN[i], split), ROW[i], m);
};

const Phones: React.FC<{f: number}> = ({f}) => {
  if (f < FL + FLOOD - 1) return null;
  const split = prog(f, b(T.split), b(T.split + 0.75), easeInOut);
  const iris = prog(f, b(T.split + 0.1), b(T.split + 0.7), easeIn);
  const P = b(T.flips[MOLE]);
  return (
    <>
      {CAST.map((p, i) => {
        const mole = i === MOLE;
        const r = phoneRect(f, i);
        const m = prog(f, b(T.shrink) + i * 2, b(T.shrink + 0.75) + i * 2, easeInOut);
        const radius = r.w * 0.14 * split;
        const bezel = r.w * 0.035 * prog(f, b(T.split + 0.45), b(T.split + 0.85), easeOut);
        const irisR = (Math.hypot(r.w, r.h) / 2) * 1.03;
        const content = spr(f, b(T.split + 0.75) + i * 2, POP);
        // clue hop, lean towards Sami after "Boiled?", vote kick
        const ci = CLUE_BY.indexOf(i);
        const c0 = ci >= 0 ? b(T.clues[ci]) : -999;
        const hop = f > c0 - 6 && f < c0 + 10 ? 26 * Math.sin(Math.PI * ((f - c0 + 6) / 16)) : 0;
        const v0 = !mole ? b(T.votes[i]) - b(0.6) : -999;
        const kick = f > v0 && f < v0 + 12 ? 18 * Math.sin(Math.PI * ((f - v0) / 12)) : 0;
        const rv = b(T.reveal[i]);
        const rhop = f > rv - 6 && f < rv + 10 ? 22 * Math.sin(Math.PI * ((f - rv + 6) / 16)) : 0;
        const lean = !mole ? 6 * (spr(f, b(T.lean), SOFT) - spr(f, b(T.votes[0]) - b(0.7), SNAPPY)) : 0;
        const wob = mole ? 7 * (spr(f, P, POP) - spr(f, P + 8, POP)) : 0;
        const glitch = mole && f >= P && f < P + 6;
        const gx = glitch ? (f % 2 ? 10 : -10) : 0;
        const ringA = mole ? spr(f, P, POP) - spr(f, b(T.shrink) - 4, {damping: 26, stiffness: 300}) : 0;
        const ringB = mole ? spr(f, b(T.stamp), POP) : 0;
        const ring = clamp(ringA + ringB);
        const gap = lerp(40, 14, ring) * lerp(1, 0.6, m);
        const ow = r.w + 2 * bezel, oh = r.h + 2 * bezel;
        return (
          <At key={p.name} x={r.x + gx} y={r.y - hop - kick - rhop} z={mole ? 31 : 30}>
            <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${wob + lean}deg)`}}>
              {ring > 0.01 || glitch ? (
                <div style={{position: 'absolute', left: -ow / 2 - gap, top: -oh / 2 - gap, width: ow + 2 * gap, height: oh + 2 * gap,
                  borderRadius: radius + bezel + gap, boxShadow: `inset 0 0 0 ${lerp(7, 5, m)}px ${C.accent}${glitch ? ', -12px 0 0 rgba(0,255,255,0.45), 12px 0 0 rgba(255,0,90,0.45)' : ''}`,
                  opacity: glitch ? 1 : 1}} />
              ) : null}
              <div style={{position: 'absolute', left: -ow / 2, top: -oh / 2, width: ow, height: oh, borderRadius: radius + bezel,
                background: bezel > 0.3 ? '#05030A' : 'transparent', boxShadow: bezel > 0.3 ? `0 ${r.w * 0.06}px ${r.w * 0.16}px rgba(0,0,0,0.4)` : undefined}}>
                <div style={{position: 'absolute', left: bezel, top: bezel, width: r.w, height: r.h, borderRadius: radius, overflow: 'hidden', background: iris >= 1 ? C.bg : C.primary}}>
                  {iris > 0 && iris < 1 ? (
                    <div style={{position: 'absolute', left: r.w / 2 - irisR * iris, top: r.h / 2 - irisR * iris, width: 2 * irisR * iris, height: 2 * irisR * iris,
                      borderRadius: '50%', background: C.bg}} />
                  ) : null}
                  {content > 0.001 ? (
                    <div style={{position: 'absolute', inset: 0, transform: `scale(${content})`}}>
                      <WordFace f={cardTime(f, i)} w={r.w} h={r.h} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={mole ? 'PASTA' : 'PIZZA'}
                        flipAt={b(T.flips[i]) - 6} />
                    </div>
                  ) : null}
                  {bezel > 0.3 ? (
                    <div style={{position: 'absolute', left: '50%', top: r.h * 0.022, width: r.w * 0.3, height: r.w * 0.085, marginLeft: -r.w * 0.15,
                      borderRadius: 999, background: '#05030A', transform: `scale(${clamp(bezel / (r.w * 0.035))})`}} />
                  ) : null}
                </div>
              </div>
            </div>
          </At>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- the TV: the shared stage

const TVR: Rect = {x: SAFE_CX, y: 715, w: 880, h: 495};
const TILE_Y = 268;
const TW = 150, TH = 184;
const tileX = (i: number) => 440 + (i - 2) * 162;
const tvWorld = (lx: number, ly: number) => ({x: TVR.x - TVR.w / 2 + lx, y: TVR.y - TVR.h / 2 + ly});
const STAMP_L = {x: tileX(MOLE) - 4, y: TILE_Y + 4};
const STAMP_W = tvWorld(STAMP_L.x, STAMP_L.y);
const CLUE_TEXT = ['Cheese', 'Oven', 'Boiled?'];

const TvScreen: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.tvOn);
  const S = b(T.stamp);
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text}}>
      <div style={{position: 'absolute', left: 36, top: 30, fontSize: 24, fontWeight: 800, letterSpacing: '0.12em', color: C.text2}}>
        <Rise f={f} start={t0}>ROUND 1 · CLUES</Rise>
      </div>
      <div style={{position: 'absolute', right: 36, top: 30, fontSize: 22, fontWeight: 900, letterSpacing: '0.14em', color: C.accent, background: C.surface,
        borderRadius: 99, padding: '2px 14px', transform: `scale(${spr(f, t0 + 3, POP)})`}}>{ROOM_CODE}</div>
      {CAST.map((p, i) => {
        const x = tileX(i);
        const s = spr(f, t0 + 2 + i * 2, POP);
        const mole = i === MOLE;
        const out = mole && f >= S;
        return (
          <React.Fragment key={p.name}>
            <div style={{position: 'absolute', left: x - TW / 2, top: TILE_Y - TH / 2, width: TW, height: TH, borderRadius: 26, background: C.surface,
              boxShadow: out ? `inset 0 0 0 4px ${C.accent}` : `inset 0 0 0 2px ${C.outline}`, transform: `scale(${s})`}}>
              <At x={TW / 2} y={74}>
                <Avatar shape={p.shape} color={p.color} size={88} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${spr(f, t0 + 4 + i * 2, POP)})`}} />
              </At>
              <div style={{position: 'absolute', left: 0, right: 0, top: 130, textAlign: 'center', fontSize: 28, fontWeight: 800}}>
                <Rise f={f} start={t0 + 5 + i * 2}>{p.name}</Rise>
              </div>
            </div>
          </React.Fragment>
        );
      })}
      {CLUE_BY.map((pi, k) => (
        <At key={k} x={tileX(pi)} y={TILE_Y - TH / 2 - 20}>
          <Bubble text={CLUE_TEXT[k]} s={spr(f, b(T.clues[k]), POP)} size={32} />
        </At>
      ))}
      <div style={{position: 'absolute', left: 0, right: 0, top: 420, textAlign: 'center', fontSize: 44, fontWeight: 900, color: C.accent}}>
        <Rise f={f} start={b(T.moleLine)} cfg={POP}>Sami was the Mole</Rise>
      </div>
      <Stamp f={f} />
    </div>
  );
};

/** The TV's verdict stamp: amber "OUT", -8°, slams onto Sami's tile. */
const Stamp: React.FC<{f: number}> = ({f}) => {
  const S = b(T.stamp);
  if (f < S - 7) return null;
  const slam = f < S ? lerp(1.7, 1, easeIn(prog(f, S - 7, S, (x) => x))) : 1 + 0.1 * (1 - spr(f, S, POP));
  return (
    <At x={STAMP_L.x} y={STAMP_L.y} z={60}>
      <div style={{position: 'absolute', left: -102, top: -45, width: 204, height: 90, borderRadius: 18, background: C.accent, boxSizing: 'border-box',
        border: `5px solid ${C.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 62,
        color: C.ink, letterSpacing: '0.06em', boxShadow: '0 16px 40px rgba(0,0,0,0.45)', transform: `rotate(-8deg) scale(${slam})`}}>
        OUT
      </div>
    </At>
  );
};

const Tv: React.FC<{f: number}> = ({f}) => {
  const L0 = b(T.line), O0 = b(T.open);
  if (f < L0 - 1) return null;
  const lw = TVR.w * prog(f, L0, O0, easeOut);
  const oh = prog(f, O0, O0 + b(0.55), easeInOut);
  const h = lerp(10, TVR.h, oh);
  const r = lerp(5, 22, oh);
  const iris = prog(f, O0 + 4, O0 + b(0.6), easeIn);
  const irisR = Math.hypot(TVR.w, TVR.h) / 2 * 1.03;
  const bezel = 12 * prog(f, O0 + b(0.45), O0 + b(0.8), easeOut);
  const stand = spr(f, O0 + b(0.6), SOFT);
  return (
    <At x={TVR.x} y={TVR.y} z={20}>
      {stand > 0.01 ? (
        <div style={{position: 'absolute', left: -110, top: TVR.h / 2 + bezel, width: 220, height: 26 * stand, background: '#05030A', borderRadius: '0 0 14px 14px'}} />
      ) : null}
      <div style={{position: 'absolute', left: -lw / 2 - bezel, top: -h / 2 - bezel, width: lw + 2 * bezel, height: h + 2 * bezel, borderRadius: r + bezel,
        background: bezel > 0.3 ? '#05030A' : 'transparent', boxShadow: bezel > 0.3 ? '0 30px 80px rgba(0,0,0,0.55)' : undefined}}>
        <div style={{position: 'absolute', left: bezel, top: bezel, width: lw, height: h, borderRadius: r, overflow: 'hidden', background: iris >= 1 ? C.bg : C.primary}}>
          {iris > 0 ? (
            <div style={{position: 'absolute', left: lw / 2 - irisR * iris, top: h / 2 - irisR * iris, width: 2 * irisR * iris, height: 2 * irisR * iris, borderRadius: '50%',
              background: `radial-gradient(120% 90% at 30% 0%, #2A1240 0%, ${C.bg} 60%)`}} />
          ) : null}
          {f >= b(T.tvOn) - 2 ? (
            <div style={{position: 'absolute', left: (lw - TVR.w) / 2, top: (h - TVR.h) / 2, width: TVR.w, height: TVR.h}}>
              <TvScreen f={f} />
            </div>
          ) : null}
        </div>
      </div>
    </At>
  );
};

/** Votes fly from the four phones up to Sami's tile on the TV. */
const Votes: React.FC<{f: number}> = ({f}) => (
  <>
    {T.votes.map((land, i) => {
      const t1 = b(land), t0 = t1 - b(0.6);
      if (f < t0) return null;
      const from = {x: ROW[i].x, y: ROW[i].y - RH / 2 - 14};
      const tile = tvWorld(tileX(MOLE), TILE_Y + TH / 2 + 26);
      const to = {x: tile.x + (i - 1.5) * 32, y: tile.y};
      const t = prog(f, t0, t1, easeInOut);
      const x = lerp(from.x, to.x, t), y = lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * 200;
      const k = f >= t1 ? 1 + 0.4 * (1 - spr(f, t1, POP)) : spr(f, t0, POP);
      return (
        <At key={i} x={x} y={y} z={45}>
          <div style={{position: 'absolute', left: -20, top: -20, width: 40, height: 40, borderRadius: 99, background: CAST[i].color,
            border: `4px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${k})`}} />
        </At>
      );
    })}
  </>
);

// ---------------------------------------------------------------- body

/** Camera move 2: a slow push on the TV and the phones after the verdict. */
const PUSH_O = {x: SAFE_CX, y: 1000};
const pushZ = (f: number) => 1 + 0.05 * prog(f, b(T.push), M4_BODY_FRAMES, easeInOut);
const LAST = {x: PUSH_O.x + (STAMP_W.x - PUSH_O.x) * pushZ(END), y: PUSH_O.y + (STAMP_W.y - PUSH_O.y) * pushZ(END)};

const shake = (f: number) => {
  const k = Math.round(f - b(T.stamp));
  const o = [[10, -7], [-8, 6], [5, -4], [-2, 2]];
  const j = Math.round(f - b(T.land));
  const o2 = [[0, 9], [0, -6], [0, 3]];
  if (k >= 0 && k < 4) return o[k];
  if (j >= 0 && j < 3) return o2[j];
  return [0, 0];
};

export const M4Body: React.FC = () => {
  const f = useCurrentFrame();
  const [sx, sy] = shake(f);
  const z = pushZ(f);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px)`}}>
        <Hook f={f} />
        <Burst f={f} />
        <div style={{position: 'absolute', inset: 0, zIndex: 30, transformOrigin: `${PUSH_O.x}px ${PUSH_O.y}px`, transform: `scale(${z})`}}>
          <Tv f={f} />
          <Phones f={f} />
          <Votes f={f} />
        </div>
      </div>

      {/* frame 0 = the thumbnail: the hook line is already up */}
      <AdCaption f={f} text="Stop passing *one* phone around." y={262} start={-b(1.2)} step={3} end={b(2.05)} size={84} accent={C.primary} />
      <AdCaption f={f} text="Someone *always* peeks." y={262} start={b(T.peek)} step={b(0.2)} end={b(4.4)} size={92} />
      <AdCaption f={f} text="Your phone. *Your* *word.*" y={262} start={b(5)} step={b(0.2)} end={b(8.6)} size={88} />
      <AdCaption f={f} text="Sami’s is *PASTA.*" y={250} start={b(T.flips[MOLE]) + 2} step={b(0.2)} end={b(10.55)} size={88} />
      <AdCaption f={f} text="(he doesn’t know)" y={360} start={b(9.6)} step={b(0.15)} end={b(10.6)} size={54} accent={C.accent} />
      <AdCaption f={f} text="The TV is the *stage.*" y={292} start={b(11.3)} step={b(0.2)} end={b(13.95)} size={84} accent={C.primary} />
      <AdCaption f={f} text="Vote out the *Mole.*" y={292} start={b(14.1)} step={b(0.2)} end={b(16.75)} size={84} />
      <AdCaption f={f} text="5 players. 5 phones." y={236} start={b(T.push)} step={b(0.25)} size={76} />
      <AdCaption f={f} text="*Zero* passing." y={346} start={b(19.25)} step={b(0.3)} size={104} accent={C.primary} />
      <BgFlood f={f} start={END} x={LAST.x} y={LAST.y} />
    </div>
  );
};

// ---------------------------------------------------------------- sound
export const M4_HITS: Hit[] = [
  {at: 2, sfx: 'bass_hit', vol: 0.6, max: 40},
  ...T.pass.map((t): Hit => ({at: b(t), sfx: 'whoosh_fast', vol: 0.35})),
  {at: b(T.read), sfx: 'pop_b', vol: 0.55},
  {at: b(T.peek), sfx: 'tick', vol: 0.5, max: 20},
  {at: b(T.slam), sfx: 'wrong', vol: 0.5, max: 60},
  {at: b(T.slam), sfx: 'pop_hard', vol: 0.45},
  {at: b(T.toss) + 10, sfx: 'swoosh_short', vol: 0.45, max: 50},
  {at: b(T.land), sfx: 'bass_hit', vol: 0.75, max: 45},
  {at: FL + FLOOD, sfx: 'whoosh_impact', vol: 0.5, max: 110},
  {at: b(T.split + 0.7), sfx: 'swoosh_short', vol: 0.35, max: 50},
  ...T.flips.slice(0, 4).map((t, i): Hit => ({at: b(t), sfx: i % 2 ? 'pop_b' : 'pop_a', vol: 0.6})),
  {at: b(T.flips[MOLE]), sfx: 'wrong', vol: 0.4, max: 60},
  {at: b(T.flips[MOLE]), sfx: 'bass_hit', vol: 0.65, max: 45},
  {at: b(9.6), sfx: 'tick', vol: 0.35, max: 20},
  {at: b(T.shrink + 0.6), sfx: 'whoosh_fast', vol: 0.35},
  {at: b(T.open), sfx: 'click', vol: 0.7},
  {at: b(T.tvOn), sfx: 'pop_a', vol: 0.45},
  {at: b(T.clues[0]), sfx: 'pop_a', vol: 0.65},
  {at: b(T.clues[1]), sfx: 'pop_b', vol: 0.65},
  {at: b(T.clues[2]), sfx: 'pop_hard', vol: 0.55},
  {at: b(T.lean), sfx: 'tick', vol: 0.4, max: 20},
  ...T.votes.map((t): Hit => ({at: b(t), sfx: 'bass_hit', vol: 0.6, max: 40})),
  // the drumroll's own peak is 3 s in: start it on b16 and cut it 2 frames before the stamp
  {at: b(T.votes[3]) + Math.round(3.006 * 60), sfx: 'drumroll', vol: 0.32, max: Math.round(b(T.stamp) - b(T.votes[3])) - 2},
  {at: b(T.stamp), sfx: 'stamp', vol: 1},
  {at: b(T.stamp), sfx: 'impact_drop', vol: 0.45, max: 120},
  {at: b(T.moleLine), sfx: 'pop_hard', vol: 0.45},
  {at: b(19.25), sfx: 'pop_a', vol: 0.5},
  ...T.reveal.map((t, i): Hit => ({at: b(t), sfx: i === MOLE ? 'pop_hard' : 'pop_b', vol: i === MOLE ? 0.5 : 0.45})),
  {at: END + 14, sfx: 'whoosh_fast', vol: 0.35},
];
