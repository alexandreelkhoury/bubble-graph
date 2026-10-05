import React from 'react';
import {useCurrentFrame} from 'remotion';
import {StageBg} from '../bg';
import {C, Player, PLAYERS} from '../brand';
import {At, Avatar, Bubble, FONT, PhoneFrame, Rise, WordFace, Words} from '../parts';
import {b, easeIn, easeInOut, easeOut, lerp, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AD_H, AD_W, AdCaption, BgFlood, Hit, SAFE, SAFE_CX, VoLine} from './common';
import {ClueScreen, OutStamp, Rect, tvPt, TvFrame, VERDICT_AV, VerdictScreen} from './m3-tv';

/**
 * MA_C_M3 "Spot the Mole" v2 — a fair puzzle (review-v2/DECISIONS.md #13, uiux.md #9). Ad beat 0 = the song's drop.
 *
 * 1. Hook (frame 0 = thumbnail): full-bleed amber, the TV clue screen + five big suspects, "Spot the Mole."
 * 2. The amber irises open from the TV into the stage: "Everyone has PIZZA… except one." (the viewer knows the word)
 * 3. One clue each (52+ px bubbles): Cheese · Fork (red herring) · Oven · Al dente (the Mole) · Slice.
 * 4. "Who doesn't fit?", then a 2.4 s 3-2-1 on the TV with "Pause it. Comment your guess." — all clues stay up.
 * 5. The twist (the ad's one full-screen flash): amber floods out of the TV's "1" and contracts into a ring around
 *    Karim's phone (emphasis outside the phone); his card flips: PASTA. "Al dente? That's pasta."
 * 6. The TV comes back on the verdict, stamps OUT, "Karim was the Mole."
 * 7. Red herring: Sami's phone flips PIZZA, "Fork" — "Sami eats pizza with a fork."
 * 8. Slogan "Everyone's innocent. Someone's lying." then the stage floods out of the amber dot into the end card.
 */
export const M3_BODY_FRAMES = Math.round(b(41.3));

// ---------------------------------------------------------------- beat grid (ad beats)
const T = {
  hookOut: 3.75, // the amber irises open
  every: 4.25, // "Everyone has PIZZA…"
  except: 4.9, // "…except one."
  everyOut: 8.45,
  each: 8.6, // "One clue each."
  eachOut: 11.6,
  clue: [8.9, 10.4, 11.9, 13.4, 14.9], // by seat order below
  fit: 12.15, // "Who doesn't fit?"
  fitOut: 15.9,
  pause: 16.1, // "Pause it." / "Comment your guess."
  comment: 16.6,
  count: [16.35, 17.95, 19.55], // 3 · 2 · 1 (1.6 beats each ≈ 2.35 s, then the flood)
  flood: 21.15,
  flipK: 23.1,
  dente: 23.35, // "Al dente? That's pasta."
  denteOut: 26.9,
  move: 26.75, // phone moves down-left, TV comes back on the verdict
  verdict: 27.35,
  stamp: 27.85,
  karim: 28.1, // "Karim was the Mole."
  karimOut: 31.85,
  sami: 31.6, // Sami's phone slides in
  fork: 32.1,
  samiLine: 32.1, // "Sami eats pizza" / "with a fork."
  samiLine2: 32.6,
  flipS: 33.1,
  samiOut: 36.9,
  iris: 36.75, // the stage closes over the scene from Sami's card
  ev: 37.2,
  inn: 37.45,
  some: 38.1,
  lying: 38.35,
  dot: 38.75,
};
const FLOOD = 21; // frames for a flood to clear the farthest corner (0.35 s)
const FS = b(T.flood);
const FULL = FS + FLOOD; // the frame is fully amber…
const HOLD = 8; // …for 8 frames (≤ 10), then contracts into the ring
const CONTRACT = 24;
const END = M3_BODY_FRAMES - 22;

// ---------------------------------------------------------------- cast + geometry
const who = (n: string) => PLAYERS.find((p) => p.name === n) as Player;
const KARIM = who('Karim');
const SAMI = who('Sami');
const AV = 190;
const BUB = 54;
/** Seats: three in front, two behind (the couch). Order = speaking order. */
const CAST: Array<{p: Player; clue: string; x: number; y: number}> = [
  {p: who('Maya'), clue: 'Cheese', x: 210, y: 1120},
  {p: SAMI, clue: 'Fork', x: 510, y: 1120},
  {p: who('Lea'), clue: 'Oven', x: 810, y: 1120},
  {p: KARIM, clue: 'Al dente', x: 360, y: 1480},
  {p: who('Joe'), clue: 'Slice', x: 660, y: 1480},
];
const TV_ROW = [0, 1, 2, 3, 4].map((i) => CAST[i].p);
const TV_A: Rect = {x: SAFE_CX, y: 715, w: 800, h: 450};
const TV_V: Rect = {x: SAFE_CX, y: 690, w: 820, h: 461.25};
const TV_V0: Rect = {...TV_V, y: -320};

const HERO: Rect = {x: SAFE_CX, y: 1050, w: 400, h: 833};
const K2: Rect = {x: 285, y: 1295, w: 280, h: 583};
const S2: Rect = {x: 735, y: 1295, w: 280, h: 583};
const S0: Rect = {...S2, x: 1400};

const rl = (a: Rect, c: Rect, t: number): Rect => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});
const farthest = (x: number, y: number) => Math.hypot(Math.max(x, AD_W - x), Math.max(y, AD_H - y)) * 1.05;
const karimRect = (f: number) => rl(HERO, K2, spr(f, b(T.move), SOFT));
const samiRect = (f: number) => rl(S0, S2, spr(f, b(T.sami), SNAPPY));
const tvVRect = (f: number) => rl(TV_V0, TV_V, spr(f, b(T.move) + 12, SNAPPY));
const SAMI_CARD = {x: S2.x, y: S2.y - 0.05 * S2.h};

// ---------------------------------------------------------------- 1. hook field (amber, then irises open from the TV)

const HookField: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.hookOut);
  if (f >= t0 + FLOOD + 2) return null;
  const r = farthest(TV_A.x, TV_A.y) * prog(f, t0, t0 + FLOOD, easeIn);
  return (
    <>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(110% 70% at 50% 35%, #FFD36A 0%, ${C.accent} 55%, #F5B53A 100%)`}} />
      {r > 0.5 ? <div style={{position: 'absolute', inset: 0, clipPath: `circle(${r}px at ${TV_A.x}px ${TV_A.y}px)`}}><StageBg /></div> : null}
    </>
  );
};

/** Ink caption for the amber hook (cream would vanish on amber): ink text, the hot word on a magenta box. */
const InkCaption: React.FC<{f: number; text: string; y: number; start: number; end: number; size: number}> = ({f, text, y, start, end, size}) => (
  <div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: y - size * 1.1, height: size * 2.2, display: 'flex', alignItems: 'center',
    justifyContent: 'center', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: C.ink, zIndex: 90, letterSpacing: '-0.02em'}}>
    <Words f={f} text={text} start={start} step={b(0.15)} end={end} accent={C.primary} boxed />
  </div>
);

// ---------------------------------------------------------------- 2–4. the clue round

const Suspects: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map(({p, clue, x, y}, i) => {
      const at = b(T.clue[i]);
      const hopAt = (t0: number, amp: number) => (f > t0 && f < t0 + 16 ? amp * Math.sin(Math.PI * ((f - t0) / 16)) : 0);
      // roll call on "…except one." (who is it?), then a hop as each one speaks
      const hop = hopAt(b(T.except + 0.4) + i * 5, 20) + hopAt(at - 4, 30);
      return (
        <React.Fragment key={p.name}>
          <At x={x} y={y - hop} z={10}>
            <Avatar shape={p.shape} color={p.color} size={AV} initial={p.name[0]} cream={p.cream}
              style={{transform: `scale(${spr(f, -b(1) - i * 4, POP)})`, filter: 'drop-shadow(0 10px 0 rgba(26,11,46,0.28))'}} />
          </At>
          <div style={{position: 'absolute', left: x - 140, width: 280, top: y + AV / 2 + 8, textAlign: 'center', fontFamily: FONT, fontWeight: 800,
            fontSize: 40, lineHeight: 1, color: f < b(T.hookOut) + 12 ? C.ink : C.text, zIndex: 10}}>
            <Rise f={f} start={-b(1)}>{p.name}</Rise>
          </div>
          <At x={x} y={y - AV / 2 - 10 - hop} z={12}>
            <Bubble text={clue} s={spr(f, at, POP)} size={BUB} />
          </At>
        </React.Fragment>
      );
    })}
  </>
);

const ClueStage: React.FC<{f: number}> = ({f}) => {
  if (f >= FULL) return null;
  return (
    <>
      <TvFrame r={TV_A}>
        <ClueScreen f={f} cast={TV_ROW} speakAt={T.clue.map(b)} timer={[b(T.each), b(T.pause)]} promptOut={b(T.count[0]) - 6}
          count={T.count.map(b)} countEnd={FULL} />
      </TvFrame>
      <Suspects f={f} />
    </>
  );
};

// ---------------------------------------------------------------- 5. the twist: flood -> ring around Karim's phone

const phoneOuter = (r: Rect) => {
  const t = Math.max(3, r.w * 0.035);
  return {x: r.x, y: r.y, w: r.w + 2 * t, h: r.h + 2 * t, rad: r.w * 0.14 + t};
};
const rr = (x: number, y: number, w: number, h: number, r: number) => {
  const R = Math.min(r, w / 2, h / 2);
  const l = x - w / 2, t = y - h / 2;
  return `M${l + R} ${t}H${l + w - R}A${R} ${R} 0 0 1 ${l + w} ${t + R}V${t + h - R}A${R} ${R} 0 0 1 ${l + w - R} ${t + h}H${l + R}A${R} ${R} 0 0 1 ${l} ${t + h - R}V${t + R}A${R} ${R} 0 0 1 ${l + R} ${t}Z`;
};
const GAP = 14, RIM = 12;
/** The number "1" sits at the TV's centre: the amber floods out of it. */
const ONE = tvPt(TV_A, 520, 220);

const Twist: React.FC<{f: number}> = ({f}) => {
  if (f < FS) return null;
  if (f < FULL) {
    const rad = lerp(60, farthest(ONE.x, ONE.y), prog(f, FS, FULL, easeIn));
    return <div style={{position: 'absolute', left: ONE.x - rad, top: ONE.y - rad, width: 2 * rad, height: 2 * rad, borderRadius: '50%', background: C.accent, zIndex: 40}} />;
  }
  const o = phoneOuter(karimRect(f));
  const hole = {w: o.w + 2 * GAP, h: o.h + 2 * GAP, rad: o.rad + GAP};
  const ring = {w: hole.w + 2 * RIM, h: hole.h + 2 * RIM, rad: hole.rad + RIM};
  const c0 = FULL + HOLD;
  const e = prog(f, c0, c0 + CONTRACT, easeInOut);
  const eh = prog(f, c0, c0 + CONTRACT, easeOut);
  const big = 2 * farthest(o.x, o.y);
  const ow = lerp(big, ring.w, e), oh = lerp(big, ring.h, e), orad = lerp(big / 2, ring.rad, e);
  const hw = lerp(0, hole.w, eh), hh = lerp(0, hole.h, eh), hrad = lerp(0, hole.rad, eh);
  const pulse = 1 + 0.035 * (1 - spr(f, b(T.flipK), POP)) * (f >= b(T.flipK) ? 1 : 0);
  return (
    <svg width={AD_W} height={AD_H} style={{position: 'absolute', left: 0, top: 0, zIndex: 40, overflow: 'visible', transformOrigin: `${o.x}px ${o.y}px`, transform: `scale(${pulse})`}}>
      <path fillRule="evenodd" fill={C.accent} d={rr(o.x, o.y, ow, oh, orad) + (hw > 1 ? rr(o.x, o.y, hw, hh, hrad) : '')} />
    </svg>
  );
};

const SCREEN = 'linear-gradient(180deg, #341A5E 0%, #2B1650 100%)';
const Phone: React.FC<{f: number; r: Rect; p: Player; word: string; flipAt: number; z: number}> = ({f, r, p, word, flipAt, z}) => (
  <At x={r.x} y={r.y} z={z}>
    <PhoneFrame w={r.w} h={r.h} screen={SCREEN}>
      <WordFace f={f} w={r.w} h={r.h} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={word} flipAt={flipAt} />
    </PhoneFrame>
  </At>
);

// ---------------------------------------------------------------- 6–7. verdict + red herring

const Reveal: React.FC<{f: number}> = ({f}) => {
  if (f < FULL || f >= b(T.iris) + FLOOD + 2) return null;
  const tv = tvVRect(f);
  const av = tvPt(tv, VERDICT_AV.x, VERDICT_AV.y + 10);
  const sr = samiRect(f);
  return (
    <>
      {f >= b(T.move) ? (
        <>
          <TvFrame r={tv} z={5}><VerdictScreen f={f} p={KARIM} at={b(T.verdict)} /></TvFrame>
          <OutStamp f={f} at={b(T.stamp)} x={av.x + 6} y={av.y + 70} w={360} />
        </>
      ) : null}
      <Phone f={f} r={karimRect(f)} p={KARIM} word="PASTA" flipAt={b(T.flipK)} z={30} />
      {f >= b(T.sami) ? (
        <>
          <Phone f={f} r={sr} p={SAMI} word="PIZZA" flipAt={b(T.flipS)} z={30} />
          <At x={sr.x} y={sr.y - sr.h / 2 - 14} z={45}>
            <Bubble text="Fork" s={spr(f, b(T.fork), POP)} size={BUB + 6} />
          </At>
        </>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------- 8. slogan

const BIG = 124;
const SY = 980; // block centre
const LINES = [
  {text: 'Everyone’s', at: T.ev, color: C.text},
  {text: 'innocent.', at: T.inn, color: C.text},
  {text: 'Someone’s', at: T.some, color: C.accent},
  {text: 'lying', at: T.lying, color: C.accent},
];
const LH = BIG * 1.04;
const top0 = SY - (LINES.length * LH) / 2;
// the amber full stop after "lying" (Cairo Black: "lying" ≈ 2.155 em wide)
const DOT = {d: BIG * 0.2, x: SAFE_CX + (2.155 * BIG) / 2 + BIG * 0.05 + BIG * 0.1 - BIG * 0.12, y: top0 + 3 * LH + BIG * 0.85 - BIG * 0.1};
const LYING_X = SAFE_CX - (BIG * 0.05 + BIG * 0.2) / 2;

const Slogan: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.iris);
  if (f < t0) return null;
  const r = farthest(SAMI_CARD.x, SAMI_CARD.y) * prog(f, t0, t0 + FLOOD, easeIn);
  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 80}}>
      <div style={{position: 'absolute', inset: 0, clipPath: `circle(${r}px at ${SAMI_CARD.x}px ${SAMI_CARD.y}px)`}}><StageBg /></div>
      {LINES.map((l, i) => (
        <div key={i} style={{position: 'absolute', left: i === 3 ? 0 : 0, width: 2 * (i === 3 ? LYING_X : SAFE_CX), top: top0 + i * LH, height: LH, textAlign: 'center',
          fontFamily: FONT, fontWeight: 900, fontSize: BIG, lineHeight: 1, letterSpacing: '-0.02em', color: l.color, whiteSpace: 'nowrap',
          textShadow: '0 6px 26px rgba(14,6,28,0.55)'}}>
          <Rise f={f} start={b(l.at)}>{l.text}</Rise>
        </div>
      ))}
      {f >= b(T.dot) ? (
        <At x={DOT.x} y={DOT.y}>
          <div style={{position: 'absolute', left: -DOT.d / 2, top: -DOT.d / 2, width: DOT.d, height: DOT.d, borderRadius: 999, background: C.primary,
            transform: `scale(${spr(f, b(T.dot), POP)})`}} />
        </At>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- body

/** 2-frame 6 px shake when the stamp lands. */
const shake = (f: number) => {
  const k = Math.round(f - b(T.stamp));
  return k === 0 ? [6, -4] : k === 1 ? [-4, 3] : [0, 0];
};

export const M3Body: React.FC = () => {
  const f = useCurrentFrame();
  const [sx, sy] = shake(f);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <HookField f={f} />
      <div style={{position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px)`}}>
        <ClueStage f={f} />
        <Reveal f={f} />
        <Twist f={f} />
      </div>
      <Slogan f={f} />

      {/* 1. hook — on screen, settled, at frame 0 */}
      <InkCaption f={f} text="Spot the *Mole.*" y={360} start={-b(1)} end={b(T.hookOut)} size={96} />
      {/* 2. the shared word first: the puzzle is fair */}
      <AdCaption f={f} text="Everyone has *PIZZA…*" y={300} start={b(T.every)} end={b(T.everyOut)} />
      <AdCaption f={f} text="except *one.*" y={400} start={b(T.except)} end={b(T.everyOut)} />
      {/* 3–4. clues, question, countdown */}
      <AdCaption f={f} text="One clue each." y={360} start={b(T.each)} end={b(T.eachOut)} />
      <AdCaption f={f} text="Who doesn’t *fit?*" y={360} start={b(T.fit)} end={b(T.fitOut)} size={96} />
      <AdCaption f={f} text="Pause it." y={300} start={b(T.pause)} end={b(T.flood)} />
      <AdCaption f={f} text="Comment your *guess.*" y={400} start={b(T.comment)} end={b(T.flood)} />
      {/* 5–7. reveal */}
      <AdCaption f={f} text="*Al dente?* That’s pasta." y={400} start={b(T.dente)} end={b(T.denteOut)} />
      <AdCaption f={f} text="*Karim* was the Mole." y={330} start={b(T.karim)} end={b(T.karimOut)} />
      <AdCaption f={f} text="*Sami* eats pizza" y={300} start={b(T.samiLine)} end={b(T.samiOut)} />
      <AdCaption f={f} text="with a *fork.*" y={400} start={b(T.samiLine2)} end={b(T.samiOut)} />

      <BgFlood f={f} start={END} x={DOT.x} y={DOT.y} />
    </div>
  );
};

// ---------------------------------------------------------------- sound (≤ 1 hit per beat, stamp + impact = one designed layer)
export const M3_HITS: Hit[] = [
  {at: b(T.hookOut), sfx: 'whoosh_fast', vol: 0.35},
  {at: b(T.every + 0.5), sfx: 'click', vol: 0.4},
  ...T.clue.map((t, i): Hit => ({at: b(t), sfx: i % 2 ? 'pop_b' : 'pop_a', vol: 0.45})),
  ...T.count.map((t): Hit => ({at: b(t), sfx: 'tick', vol: 0.9, max: 24})),
  {at: FS + 10, sfx: 'whoosh_impact', vol: 0.5},
  {at: b(T.flipK), sfx: 'wrong', vol: 0.45, max: 50},
  {at: b(T.move), sfx: 'swoosh_short', vol: 0.35},
  {at: b(T.stamp), sfx: 'stamp', vol: 0.95},
  {at: b(T.stamp), sfx: 'impact_drop', vol: 0.45, max: 120},
  {at: b(T.sami), sfx: 'swoosh_short', vol: 0.35},
  {at: b(T.fork), sfx: 'pop_b', vol: 0.45},
  {at: b(T.flipS), sfx: 'correct', vol: 0.4},
  {at: b(T.iris) + 8, sfx: 'whoosh_fast', vol: 0.3},
  {at: b(T.dot), sfx: 'sparkle', vol: 0.6},
];

// ---------------------------------------------------------------- optional VO (uiux.md §3.6, adapted to the fair copy; every line is also a caption)
const vo = (n: number, at: number, dur: number): VoLine => ({at: Math.round(at), dur, src: `vo/m3-en-${String(n).padStart(2, '0')}.mp3`});
export const M3_VO: VoLine[] = [
  vo(1, b(T.every), 120), // "Everyone has pizza… except one." (5 wds, 2.5 w/s)
  vo(2, b(T.fit), 78), // "Who doesn't fit?" (3 wds)
  vo(3, b(T.pause), 132), // "Pause it. Comment your guess." (5 wds)
  vo(4, b(T.dente), 96), // "Al dente? That's pasta." (4 wds)
  vo(5, b(T.karim), 96), // "Karim was the Mole." (4 wds)
];
