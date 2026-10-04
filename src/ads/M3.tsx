import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, Player, PLAYERS, ROOM_CODE} from '../brand';
import {At, Avatar, Bubble, FONT, PhoneFrame, Rise, Words} from '../parts';
import {b, clamp, easeIn, easeInOut, easeOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AD_H, AD_W, AdBg, AdCaption, BgFlood, Hit, SAFE_CX} from './common';

/**
 * MA_C_M3 "Spot the Mole" puzzle (body, 33 beats). Ad beat 0 = the song's drop.
 * One take: suspects around an amber timer (pre-settled on frame 0) -> clues -> 3-2-1 -> the timer
 * floods amber and irises in to an amber outline around Karim's phone -> his card flips: PASTA ->
 * the TV's "OUT" stamp -> Sami's phone slides out (PIZZA) -> the stamp floods into the slogan ->
 * the backdrop floods out of the last full stop into the end card.
 *
 * Game accuracy (bubble-graph DESIGN.md PH-04 / §6.2): phones stay dark, the word sits on a
 * player-coloured card revealed by a flip (2D squash here), the Mole's phone looks like everyone
 * else's, the verdict stamp is "OUT", the reveal line is "{name} was the Mole".
 */
export const M3_BODY_FRAMES = Math.round(b(33));

// ---------------------------------------------------------------- beat grid
const T = {
  clue0: 4, // clues land on b4, b6, b8, b10, b12
  cta: 13,
  count: 14, // 3 on b14, 2 on b15, 1 on b16
  disc: 16.6,
  flood: 16.85,
  contract: 17.6,
  land: 18.3,
  flipK: 19, // Karim's card flips: PASTA
  stamp: 20, // OUT
  split: 21.4,
  fork: 22,
  flipS: 23, // Sami's card flips: PIZZA
  line: 23.4,
  notMole: 25,
  sFlood: 26.75,
  ev: 27.5,
  inn: 27.9,
  inkDot: 28.6,
  vFlood: 29.5,
  some: 30.2,
  lying: 30.6,
  amberDot: 31.3,
};
const FS = b(T.flood); // timer flood start
const SFS = b(T.sFlood); // stamp flood start
const VFS = b(T.vFlood); // violet flood start
const FLOOD = 21; // frames for a flood to clear the farthest corner (0.35 s)
const END = M3_BODY_FRAMES - 22; // backdrop flood into the end card

// ---------------------------------------------------------------- cast + geometry
const who = (n: string) => PLAYERS.find((p) => p.name === n) as Player;
const CAST: Array<{p: Player; clue: string}> = [
  {p: who('Maya'), clue: 'Cheese'},
  {p: who('Lea'), clue: 'Oven'},
  {p: who('Sami'), clue: 'Fork'},
  {p: who('Joe'), clue: 'Slice'},
  {p: who('Karim'), clue: 'Sauce'},
];
const RING = {x: SAFE_CX, y: 960, r: 320};
const seat = (i: number) => {
  const a = (i * 72 * Math.PI) / 180;
  return {x: RING.x + RING.r * Math.sin(a), y: RING.y - RING.r * Math.cos(a)};
};
const AV = 150;
const BUB = 46;
const TIMER = {r: 115, sw: 16};
const TIMER_OUT = TIMER.r + TIMER.sw / 2;

/** Camera move 1: a slow push into the ring while the clues land (about the ring centre). */
const camZ = (f: number) => 1 + 0.06 * prog(f, b(3.5), b(16.5), easeInOut);

type Rect = {x: number; y: number; w: number; h: number};
const rl = (a: Rect, c: Rect, t: number): Rect => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});
const HERO: Rect = {x: SAFE_CX, y: 920, w: 400, h: 833};
const LEFT: Rect = {x: 300, y: 950, w: 320, h: 667};
const RIGHT: Rect = {x: 722, y: 950, w: 320, h: 667};
const farthest = (x: number, y: number) => Math.hypot(Math.max(x, AD_W - x), Math.max(y, AD_H - y)) * 1.05;

// ---------------------------------------------------------------- the timer ring + suspects

/** Timer arc 0..1: full at the hook, drains one notch per beat (b1..b13), refills by thirds on 3-2-1. */
const arcAt = (f: number) => {
  if (f < b(T.cta + 0.5)) {
    let d = 0;
    for (let k = 1; k <= T.cta; k++) d += spr(f, b(k), SNAPPY);
    return clamp(1 - d / T.cta);
  }
  let u = 0;
  for (let k = 0; k < 3; k++) u += spr(f, b(T.count + k), SNAPPY);
  return clamp(u / 3, 0, 1.02);
};

const Timer: React.FC<{f: number}> = ({f}) => {
  const arc = arcAt(f);
  const circ = 2 * Math.PI * TIMER.r;
  const disc = TIMER_OUT * prog(f, b(T.disc), FS, easeIn);
  const box = TIMER_OUT + 4;
  return (
    <At x={RING.x} y={RING.y} z={5}>
      <svg width={box * 2} height={box * 2} viewBox={`${-box} ${-box} ${box * 2} ${box * 2}`} style={{position: 'absolute', left: -box, top: -box, overflow: 'visible'}}>
        <circle r={TIMER.r} fill="none" stroke={C.outline} strokeWidth={TIMER.sw} opacity={0.7} />
        {arc > 0.004 ? (
          <circle r={TIMER.r} fill="none" stroke={C.accent} strokeWidth={TIMER.sw} strokeLinecap="round" transform="rotate(-90)"
            strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - Math.min(arc, 1))} />
        ) : null}
        {disc > 0.5 ? <circle r={disc} fill={C.accent} /> : null}
      </svg>
      <TimerText f={f} />
    </At>
  );
};

const TimerText: React.FC<{f: number}> = ({f}) => {
  const box: React.CSSProperties = {position: 'absolute', left: -200, width: 400, display: 'flex', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, lineHeight: 1};
  return (
    <>
      <div style={{...box, top: -40, height: 80, fontSize: 70, color: C.text}}>
        <Rise f={f} start={-b(1)} end={b(T.cta)} cfg={POP}>Who<span style={{color: C.accent}}>?</span></Rise>
      </div>
      {[3, 2, 1].map((n, k) => {
        const s0 = b(T.count + k);
        if (f < s0) return null;
        const end = k < 2 ? b(T.count + k + 1) : FS - 3;
        const punch = 1 + 0.5 * (1 - spr(f, s0, POP));
        const col = k === 2 ? mix(C.accent, C.ink, prog(f, b(T.disc) + 8, b(T.disc) + 13)) : C.accent;
        return (
          <div key={n} style={{...box, top: -95, height: 190, fontSize: 190, color: col, transform: `scale(${punch})`}}>
            <Rise f={f} start={s0} end={end} cfg={POP}>{n}</Rise>
          </div>
        );
      })}
    </>
  );
};

const Suspects: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map(({p, clue}, i) => {
      const s = seat(i);
      const clueAt = b(T.clue0 + 2 * i);
      // roll call in the hook (hop clockwise on the 8ths), then a hop as each suspect speaks
      const hopAt = (t0: number, amp: number) => (f > t0 && f < t0 + 16 ? amp * Math.sin(Math.PI * ((f - t0) / 16)) : 0);
      const hop = hopAt(b(0.5 + 0.5 * i), 22) + hopAt(clueAt - 3, 30);
      const lit = f >= clueAt - 3 && f < clueAt + b(1.6);
      return (
        <React.Fragment key={p.name}>
          <At x={s.x} y={s.y - hop} z={10}>
            <Avatar shape={p.shape} color={p.color} size={AV} initial={p.name[0]} cream={p.cream}
              style={{transform: `scale(${spr(f, -b(1) - i * 4, POP)})`, filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.25))'}} />
          </At>
          <div style={{position: 'absolute', left: s.x - 120, width: 240, top: s.y + AV / 2 + 14, textAlign: 'center', fontFamily: FONT,
            fontWeight: 800, fontSize: 36, lineHeight: 1, color: lit ? C.text : C.text2, zIndex: 10}}>
            <Rise f={f} start={-b(1)}>{p.name}</Rise>
          </div>
          <At x={s.x} y={s.y - AV / 2 - BUB * 0.36 - 10 - hop} z={12}>
            <Bubble text={clue} s={spr(f, clueAt, POP)} size={BUB} />
          </At>
        </React.Fragment>
      );
    })}
  </>
);

const RingScene: React.FC<{f: number}> = ({f}) => {
  if (f >= FS + FLOOD) return null;
  const z = camZ(f);
  return (
    <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0',
      transform: `translate(${RING.x}px, ${RING.y}px) scale(${z}) translate(${-RING.x}px, ${-RING.y}px)`}}>
      <Timer f={f} />
      <Suspects f={f} />
    </div>
  );
};

// ---------------------------------------------------------------- the app's "Your secret word" phone (PH-04)

/** Squash flip (no 3D): 0..1 -> scaleX and which face shows. */
const flip = (f: number, at: number) => {
  const t = prog(f, at - 7, at + 7, easeInOut);
  return {sx: Math.max(0.02, Math.abs(Math.cos(Math.PI * t))), face: t >= 0.5};
};

const WordPhone: React.FC<{f: number; r: Rect; p: Player; word: string; flipAt: number}> = ({f, r, p, word, flipAt}) => {
  const u = r.w / 300;
  const {sx, face} = flip(f, flipAt);
  const glyph = p.cream ? C.elevated : C.ink;
  const cw = 240 * u, ch = 320 * u;
  const back = mix(C.surface, p.color, 0.18);
  const pop = face ? 1 + 0.06 * (1 - spr(f, flipAt, POP)) : 1;
  return (
    <At x={r.x} y={r.y}>
      <PhoneFrame w={r.w} h={r.h} screen={C.bg}>
        <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text}}>
          {/* top bar: room code chip + me */}
          <div style={{position: 'absolute', left: 18 * u, top: 50 * u, height: 26 * u, padding: `0 ${10 * u}px`, borderRadius: 999, background: C.surface,
            border: `${1.5 * u}px solid ${C.outline}`, display: 'flex', alignItems: 'center', fontSize: 14 * u, fontWeight: 800, letterSpacing: '0.12em', color: C.text2}}>
            {ROOM_CODE}
          </div>
          <div style={{position: 'absolute', right: 18 * u, top: 50 * u, height: 26 * u, display: 'flex', alignItems: 'center', gap: 7 * u, fontSize: 16 * u, fontWeight: 800}}>
            <div style={{position: 'relative', width: 24 * u, height: 24 * u}}>
              <At x={12 * u} y={12 * u}><Avatar shape={p.shape} color={p.color} size={24 * u} /></At>
            </div>
            {p.name}
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 108 * u, textAlign: 'center', fontSize: 20 * u, fontWeight: 800, color: C.text2}}>
            Your secret word
          </div>
          {/* the card */}
          <div style={{position: 'absolute', left: (300 * u - cw) / 2, top: 150 * u, width: cw, height: ch, borderRadius: 26 * u, overflow: 'hidden',
            transform: `scaleX(${sx}) scale(${pop})`, background: face ? p.color : back,
            boxShadow: face ? `0 ${10 * u}px ${26 * u}px rgba(0,0,0,0.35)` : undefined}}>
            {face ? (
              <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: glyph}}>
                <div style={{fontSize: 58 * u, fontWeight: 900, lineHeight: 1, letterSpacing: '0.01em'}}>{word}</div>
                <div style={{position: 'absolute', bottom: 20 * u, fontSize: 13 * u, fontWeight: 700, opacity: 0.7}}>Release to hide</div>
              </div>
            ) : (
              <div style={{position: 'absolute', inset: 0,
                backgroundImage: `radial-gradient(${mix(back, p.color, 0.35)} ${1.6 * u}px, transparent ${1.9 * u}px)`, backgroundSize: `${18 * u}px ${18 * u}px`}}>
                <div style={{position: 'absolute', left: 0, right: 0, top: ch / 2 - 46 * u, display: 'flex', justifyContent: 'center'}}>
                  <svg width={40 * u} height={40 * u} viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.8a6 6 0 0 1-4.6-2.2L4.5 15a1.5 1.5 0 0 1 2.3-2L9 15" />
                  </svg>
                </div>
                <div style={{position: 'absolute', left: 22 * u, right: 22 * u, top: ch / 2 + 8 * u, textAlign: 'center', fontSize: 16 * u, fontWeight: 700,
                  lineHeight: 1.25, color: C.text2}}>Press and hold to see your word</div>
              </div>
            )}
          </div>
          <div style={{position: 'absolute', left: 30 * u, right: 30 * u, top: 538 * u, height: 46 * u, borderRadius: 999, background: C.primary, color: C.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 * u, fontWeight: 900}}>Got it</div>
        </div>
      </PhoneFrame>
    </At>
  );
};

// ---------------------------------------------------------------- reveal: iris into Karim's phone

const phoneOuter = (r: Rect) => {
  const t = r.w * 0.035;
  return {x: r.x, y: r.y, w: r.w + 2 * t, h: r.h + 2 * t, rad: r.w * 0.14 + t};
};
const karimRect = (f: number) => rl(HERO, LEFT, spr(f, b(T.split), SOFT));
const samiRect = (f: number) => rl(HERO, RIGHT, spr(f, b(T.split), SOFT));

const rr = (x: number, y: number, w: number, h: number, r: number) => {
  const R = Math.min(r, w / 2, h / 2);
  const l = x - w / 2, t = y - h / 2;
  return `M${l + R} ${t}H${l + w - R}A${R} ${R} 0 0 1 ${l + w} ${t + R}V${t + h - R}A${R} ${R} 0 0 1 ${l + w - R} ${t + h}H${l + R}A${R} ${R} 0 0 1 ${l} ${t + h - R}V${t + R}A${R} ${R} 0 0 1 ${l + R} ${t}Z`;
};

const GAP = 14, RIM = 12; // the amber outline around Karim's phone (emphasis stays outside the phone)

/** The timer's amber disc floods the frame, then irises in to an outline around Karim's phone. */
const Iris: React.FC<{f: number}> = ({f}) => {
  if (f < FS || f >= SFS + FLOOD) return null;
  if (f < FS + FLOOD) {
    const R0 = TIMER_OUT * camZ(FS);
    const rad = lerp(R0, farthest(RING.x, RING.y), prog(f, FS, FS + FLOOD, easeIn));
    return <div style={{position: 'absolute', left: RING.x - rad, top: RING.y - rad, width: 2 * rad, height: 2 * rad, borderRadius: '50%', background: C.accent, zIndex: 40}} />;
  }
  const o = phoneOuter(karimRect(f));
  const hole = {w: o.w + 2 * GAP, h: o.h + 2 * GAP, rad: o.rad + GAP};
  const ring = {w: hole.w + 2 * RIM, h: hole.h + 2 * RIM, rad: hole.rad + RIM};
  const e = prog(f, b(T.contract), b(T.land), easeInOut);
  const eh = prog(f, b(T.contract), b(T.land), easeOut);
  const big = 2 * farthest(o.x, o.y);
  const ow = lerp(big, ring.w, e), oh = lerp(big, ring.h, e), orad = lerp(big / 2, ring.rad, e);
  const hw = lerp(0, hole.w, eh), hh = lerp(0, hole.h, eh), hrad = lerp(0, hole.rad, eh);
  const pulse = f >= b(T.stamp) ? 1 + 0.03 * (1 - spr(f, b(T.stamp), POP)) : 1;
  return (
    <svg width={AD_W} height={AD_H} style={{position: 'absolute', left: 0, top: 0, zIndex: 40, overflow: 'visible',
      transformOrigin: `${o.x}px ${o.y}px`, transform: `scale(${pulse})`}}>
      <path fillRule="evenodd" fill={C.accent}
        d={rr(o.x, o.y, ow, oh, orad) + (hw > 1 ? rr(o.x, o.y, hw, hh, hrad) : '')} />
    </svg>
  );
};

const Phones: React.FC<{f: number}> = ({f}) => {
  if (f < b(T.contract) || f >= VFS + FLOOD) return null;
  const sr = samiRect(f);
  return (
    <>
      {f >= b(T.split) ? (
        <div style={{position: 'absolute', inset: 0, zIndex: 28}}>
          <WordPhone f={f} r={sr} p={who('Sami')} word="PIZZA" flipAt={b(T.flipS)} />
          <At x={sr.x} y={sr.y - sr.h / 2 - BUB * 0.36 - 22}>
            <Bubble text="Fork" s={spr(f, b(T.fork), POP)} size={BUB} />
          </At>
        </div>
      ) : null}
      <div style={{position: 'absolute', inset: 0, zIndex: 30}}>
        <WordPhone f={f} r={karimRect(f)} p={who('Karim')} word="PASTA" flipAt={b(T.flipK)} />
      </div>
    </>
  );
};

/** The TV's verdict stamp "OUT" (amber, -8°) lands on Karim on b20, rides with him, then floods the frame amber. */
const Stamp: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.stamp);
  if (f < t0 - 7 || f >= VFS + FLOOD) return null;
  const k = karimRect(f);
  const r = {x: k.x, y: k.y + 0.385 * k.h, w: 0.94 * k.w, h: 0.38 * k.w};
  const slam = f < t0 ? lerp(2.6, 1, easeIn(prog(f, t0 - 7, t0, (x) => x))) : 1 + 0.1 * (1 - spr(f, t0, POP));
  const e = prog(f, SFS, SFS + FLOOD, easeIn);
  const R = farthest(r.x, r.y) * 1.02;
  const w = lerp(r.w, 2 * R, e), h = lerp(r.h, 2 * R, e);
  const textS = 1 - e;
  return (
    <At x={r.x} y={r.y} z={60}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: lerp(r.h * 0.22, R, e), background: C.accent,
        transform: `rotate(${lerp(-8, 0, e)}deg) scale(${slam})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        border: e < 0.6 ? `${r.h * 0.05 * (1 - e / 0.6)}px solid ${C.ink}` : undefined,
        boxShadow: e < 0.1 ? `0 ${r.h * 0.15}px ${r.h * 0.4}px rgba(0,0,0,0.45)` : undefined}}>
        {textS > 0.02 ? (
          <span style={{fontFamily: FONT, fontWeight: 900, fontSize: r.h * 0.66 * textS + 0.01, lineHeight: 1, color: C.ink, letterSpacing: '0.06em'}}>OUT</span>
        ) : null}
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- slogan

// Advance widths (em) of Cairo Black (same table as Film.tsx).
const EM: Record<string, number> = {"Everyone's": 4.872, innocent: 3.857, "Someone's": 4.882, lying: 2.155};
const BASELINE = 0.85;
const BIG = 158;
const SY = 900; // slogan block centre
const geom = (word: string) => {
  const dot = BIG * 0.2, gap = BIG * 0.05, ww = EM[word] * BIG;
  const x0 = SAFE_CX - (ww + gap + dot) / 2;
  const lineTop = SY + 0.02 * BIG;
  return {dot, x0, dotX: x0 + ww + gap + dot / 2, dotY: lineTop + BASELINE * BIG - dot / 2, lineTop};
};
const LINE1 = SY - 1.02 * BIG;
const G1 = geom('innocent');
const G2 = geom('lying');
/** Camera move 2 (only in): a slow push on the last line, about the slogan centre. */
const push = (f: number) => 1 + 0.04 * prog(f, b(T.some), M3_BODY_FRAMES, easeInOut);
const LAST_DOT = {x: SAFE_CX + (G2.dotX - SAFE_CX) * push(END), y: SY + (G2.dotY - SY) * push(END)};

const Line: React.FC<{f: number; text: string; top: number; start: number; end?: number; color: string; x0?: number}> = ({f, text, top, start, end, color, x0}) => (
  <div style={{position: 'absolute', top, height: BIG, left: x0 ?? 0, width: x0 === undefined ? 2 * SAFE_CX : undefined,
    textAlign: x0 === undefined ? 'center' : 'left', fontFamily: FONT, fontWeight: 900, fontSize: BIG, lineHeight: 1, color, whiteSpace: 'nowrap'}}>
    <Rise f={f} start={start} end={end} cfg={SNAPPY}>{text}</Rise>
  </div>
);

const Dot: React.FC<{x: number; y: number; d: number; color: string; s: number}> = ({x, y, d, color, s}) => (
  <At x={x} y={y}>
    <div style={{position: 'absolute', left: -d / 2, top: -d / 2, width: d, height: d, borderRadius: 999, background: color, transform: `scale(${s})`}} />
  </At>
);

const Slogan: React.FC<{f: number}> = ({f}) => {
  if (f < b(T.ev) - 2) return null;
  const ve = prog(f, VFS, VFS + FLOOD, easeIn);
  const vr = farthest(G1.dotX, G1.dotY) * ve;
  return (
    <>
      {f < VFS + FLOOD ? (
        <div style={{position: 'absolute', inset: 0, zIndex: 70}}>
          <Line f={f} text="Everyone’s" top={LINE1} start={b(T.ev)} end={VFS + 12} color={C.ink} />
          <Line f={f} text="innocent" top={G1.lineTop} start={b(T.inn)} end={VFS + 12} color={C.ink} x0={G1.x0} />
          {f >= b(T.inkDot) ? <Dot x={G1.dotX} y={G1.dotY} d={G1.dot} color={C.ink} s={spr(f, b(T.inkDot), POP)} /> : null}
          {ve > 0 ? (
            <div style={{position: 'absolute', inset: 0, clipPath: `circle(${vr}px at ${G1.dotX}px ${G1.dotY}px)`}}><AdBg /></div>
          ) : null}
        </div>
      ) : null}
      {f >= VFS + 6 ? (
        <div style={{position: 'absolute', inset: 0, zIndex: 72, transformOrigin: `${SAFE_CX}px ${SY}px`, transform: `scale(${push(f)})`}}>
          <Line f={f} text="Someone’s" top={LINE1} start={b(T.some)} color={C.text} />
          <Line f={f} text="lying" top={G2.lineTop} start={b(T.lying)} color={C.text} x0={G2.x0} />
          {f >= b(T.amberDot) ? <Dot x={G2.dotX} y={G2.dotY} d={G2.dot} color={C.accent} s={spr(f, b(T.amberDot), POP)} /> : null}
        </div>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------- body

/** 4-frame shake when the stamp lands. */
const shake = (f: number) => {
  const k = Math.round(f - b(T.stamp));
  const o = [[10, -7], [-8, 6], [5, -4], [-2, 2]];
  return k >= 0 && k < 4 ? o[k] : [0, 0];
};

export const M3Body: React.FC = () => {
  const f = useCurrentFrame();
  const [sx, sy] = shake(f);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px)`}}>
        <RingScene f={f} />
        <Phones f={f} />
        <Iris f={f} />
        <Stamp f={f} />
      </div>
      <Slogan f={f} />

      {/* the viewer's job, already on screen at frame 0 (thumbnail) */}
      <AdCaption f={f} text="One of them has a" y={226} start={-b(1)} end={b(3.4)} size={76} />
      <AdCaption f={f} text="*different* *word.*" y={318} start={-b(1)} end={b(3.5)} size={76} />
      <AdCaption f={f} text="Their *clues:*" y={270} start={b(3.75)} end={b(8.6)} />
      <AdCaption f={f} text="Who doesn’t *fit?*" y={270} start={b(8.8)} end={b(12.75)} />
      <AdCaption f={f} text="Comment your *guess.*" y={270} start={b(T.cta)} end={b(T.flood)} />
      <AdCaption f={f} text="*Karim* was the Mole." y={270} start={b(T.flipK) + 6} end={b(21.25)} />
      <AdCaption f={f} text="And *Sami?*" y={270} start={b(21.6)} end={b(24.8)} />
      <AdCaption f={f} text="Not the *Mole.*" y={270} start={b(T.notMole)} end={b(26.6)} />
      <div style={{position: 'absolute', left: 60, width: 900, top: 1380, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 48,
        lineHeight: 1.15, color: C.accent, zIndex: 50}}>
        <Words f={f} text="(Sami just eats pizza with a fork.)" start={b(T.line)} step={3} end={b(26.6)} />
      </div>

      <BgFlood f={f} start={END} x={LAST_DOT.x} y={LAST_DOT.y} />
    </div>
  );
};

// ---------------------------------------------------------------- sound
export const M3_HITS: Hit[] = [
  // hook + clue phase: the timer ticks down one notch per beat (soft), clues pop on the even beats
  ...[1, 2, 3].map((k): Hit => ({at: b(k), sfx: 'tick', vol: 0.45, max: 20})),
  ...[0, 1, 2, 3, 4].map((i): Hit => ({at: b(T.clue0 + 2 * i), sfx: i % 2 ? 'pop_b' : 'pop_a', vol: 0.75})),
  ...[5, 7, 9, 11].map((k): Hit => ({at: b(k), sfx: 'tick', vol: 0.3, max: 20})),
  {at: b(T.cta), sfx: 'tick', vol: 0.45, max: 20},
  // 3-2-1 + a drumroll building into the flood (cut at the flood)
  ...[0, 1, 2].map((k): Hit => ({at: b(T.count + k), sfx: 'tick', vol: 0.9, max: 24})),
  {at: b(T.cta) + Math.round(3.006 * 60), sfx: 'drumroll', vol: 0.35, max: Math.round(FS - b(T.cta))},
  {at: FS + 14, sfx: 'whoosh_fast', vol: 0.5},
  // Karim
  {at: b(T.land), sfx: 'bass_hit', vol: 0.55, max: 50},
  {at: b(T.flipK), sfx: 'wrong', vol: 0.45},
  {at: b(T.stamp), sfx: 'stamp', vol: 0.9},
  {at: b(T.stamp), sfx: 'impact_drop', vol: 0.6},
  // Sami
  {at: b(T.split) + 20, sfx: 'swoosh_short', vol: 0.4},
  {at: b(T.fork), sfx: 'pop_b', vol: 0.7},
  {at: b(T.flipS), sfx: 'pop_hard', vol: 0.6},
  {at: b(T.notMole), sfx: 'click', vol: 0.5},
  // slogan
  {at: SFS + 14, sfx: 'whoosh_fast', vol: 0.4},
  {at: b(T.inkDot), sfx: 'pop_a', vol: 0.5},
  {at: VFS + 12, sfx: 'swoosh_short', vol: 0.35},
  {at: b(T.amberDot), sfx: 'sparkle', vol: 0.65},
];
