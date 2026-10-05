import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, MOLE, PLAYERS, ROOM_CODE} from './brand';
import {StageBg} from './bg';
import {Layout, layoutFor, Rect} from './layout';
import {At, Avatar, Bubble, FONT, Mark, PhoneFrame, Rise, WordFace, Words} from './parts';
import {QR, QR_N} from './qr';
import {b, clamp, easeIn, easeInOut, easeOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from './time';
import {PLAY_URL} from './ads/EndCard';

// Advance widths (em) of Cairo Black, measured with fontTools (tools: see README).
const EM: Record<string, number> = {"Everyone's": 4.872, innocent: 3.857, "Someone's": 4.882, lying: 2.155};
const BASELINE = 0.85; // Cairo (tightened metrics 880/-180) baseline inside a line-height:1 box

// ---------------------------------------------------------------- v2 timing
//
// v2 (review-v2/DECISIONS.md #3): every caption holds ≥ 1.2 s (key lines ≥ 1.8 s). The story is written in "story
// beats" (the v1 grid); after the drop (beat 16, which stays on the song's drop because the music trim is unchanged)
// whole beats are inserted where a caption or a payoff needs more reading time. B(storyBeat) -> film frame.
const INSERTS: Array<[number, number]> = [
  [20.5, 2], // PIZZA ×5 / PASTA on the phones + "…but one is different."
  [27.5, 2], // Sami's odd clue sits; everyone leans at him; "Spot who doesn't fit."
  [33.5, 2], // OUT + "Sami was the Mole" + "Caught the Mole!"
  [36, 2], // "Everyone's innocent."
  [39.5, 1], // "Someone's lying."
];
const shift = (beat: number) => INSERTS.reduce((s, [at, d]) => s + (beat >= at ? d : 0), 0);
/** Film frame of story beat `beat` (identity before the first insert). */
export const B = (beat: number) => b(beat + shift(beat));
const STORY_END = 52;
export const FILM_BEATS = STORY_END + shift(STORY_END); // 61 beats
export const FILM_DURATION = Math.round(b(FILM_BEATS)) + 30; // ≈ 30.1 s
/** Pre-settled start: things that must already be composed on frame 0 (the thumbnail). */
const PRE = -b(4);

// ---------------------------------------------------------------- layout (v2 overrides of layout.ts)

type FilmLayout = Layout & {cx: number; ui: number; clue: number; vote: number; moleSize: number; moleY: number | null};

const filmLayout = (W: number, H: number): FilmLayout => {
  const L = layoutFor(W, H);
  const phoneR = (x: number, y: number, h: number): Rect => ({x, y, w: h * 0.48, h});
  const grid = (cx: number, cy: number, cols: number, w: number, h: number, gx: number, gy: number): Rect[] =>
    Array.from({length: 6}, (_, i) => {
      const rows = Math.ceil(6 / cols);
      const c = i % cols, r = Math.floor(i / cols);
      return {x: cx + (c - (cols - 1) / 2) * (w + gx), y: cy + (r - (rows - 1) / 2) * (h + gy), w, h};
    });
  if (L.mode === 'tall') {
    // bigger UI, everything inside the 9:16 safe zone (x 60–960, centre 510; content down to y ≈ 1600)
    const cx = 510;
    return {
      ...L, cx, ui: 1.3, clue: 52, vote: 48, moleSize: 72, moleY: 1545,
      cap: {x: cx, y: 275, size: 84, maxW: 900},
      hero: phoneR(cx, 1010, 1180),
      phones: grid(cx, 1020, 3, 288, 600, 24, 30).map((r) => phoneR(r.x, r.y, 600)),
      tiles: grid(cx, 1080, 3, 290, 310, 20, 140),
    };
  }
  if (L.mode === 'wide') {
    return {
      ...L, cx: W / 2, ui: 1, clue: 40, vote: 38, moleSize: 60, moleY: 730,
      cap: {x: W / 2, y: 885, size: 72, maxW: 1700},
      hero: phoneR(W / 2, 455, 740),
      phones: grid(W / 2, 480, 6, 0.48 * 560, 560, 28, 0).map((r) => phoneR(r.x, r.y, 560)),
      tiles: grid(W / 2, 520, 6, 260, 284, 34, 0),
    };
  }
  // 1:1: a slightly smaller TV on the left so the join phone (in frame from frame 0) never covers Start
  return {...L, cx: W / 2, ui: 1.1, clue: 36, vote: 36, moleSize: 40, moleY: null, cap: {x: W / 2, y: 935, size: 60, maxW: 980},
    tv: {x: 405, y: 440, w: 740, h: 740 * 9 / 16}, phone: phoneR(925, 450, 500)};
};

// ---------------------------------------------------------------- geometry helpers

/** TV-local design units (screen 1040 x 585) -> world. */
const tvPt = (L: Layout, lx: number, ly: number) => {
  const s = L.tv.w / 1040;
  return {x: L.tv.x - L.tv.w / 2 + lx * s, y: L.tv.y - L.tv.h / 2 + ly * s, s};
};
const START_LOCAL = {x: 865, y: 520, w: 250, h: 72};
const SLOT_LOCAL = (i: number) => ({x: 465 + (i % 3) * 190, y: 185 + Math.floor(i / 3) * 170});
// Beats at which each player's tile lands on the TV. Karim and Lea are already in on frame 0 (a live lobby, not an
// empty one); Maya joins by phone and flies in on beat 8; the rest pop in, one per beat.
const LAND = [8, -12, -12, 9, 10, 11];

type Cam = {z: number; x: number; y: number};
const camAt = (L: Layout, f: number): Cam => {
  const start = tvPt(L, START_LOCAL.x, START_LOCAL.y);
  // 16:9 opens close on the lit lobby TV (≈ 70 % of the frame width), then pulls back for the phone.
  const open: [number, number, number] = L.mode === 'wide' ? [1.24, L.tv.x, L.tv.y + 70] : [1, L.W / 2, L.H / 2];
  const keys: Array<[number, number, number, number]> = [
    [0, ...open],
    [b(3.4), ...open],
    [b(5.2), 1, L.W / 2, L.H / 2],
    [b(12), 1, L.W / 2, L.H / 2],
    [b(15.6), 1.9, start.x, start.y],
  ];
  if (f <= keys[0][0]) return {z: keys[0][1], x: keys[0][2], y: keys[0][3]};
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, z0, x0, y0] = keys[i];
    const [f1, z1, x1, y1] = keys[i + 1];
    if (f <= f1) {
      const t = easeInOut(clamp((f - f0) / (f1 - f0)));
      return {z: Math.exp(lerp(Math.log(z0), Math.log(z1), t)), x: lerp(x0, x1, t), y: lerp(y0, y1, t)};
    }
  }
  const k = keys[keys.length - 1];
  return {z: k[1], x: k[2], y: k[3]};
};
const toScreen = (L: Layout, cam: Cam, p: {x: number; y: number}) => ({
  x: L.W / 2 + (p.x - cam.x) * cam.z,
  y: L.H / 2 + (p.y - cam.y) * cam.z,
});

const rectLerp = (a: Rect, c: Rect, t: number): Rect => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});

// ---------------------------------------------------------------- captions (v2: boxed hot words, soft shadow)

const Caption: React.FC<{L: FilmLayout; f: number; text: string; start: number; end: number; hook?: boolean; accent?: string}> = ({L, f, text, start, end, hook, accent = C.accent}) => {
  const size = Math.round(L.cap.size * (hook ? 96 / 84 : 1));
  return (
    <div style={{position: 'absolute', left: L.cap.x - L.cap.maxW / 2, top: L.cap.y - size * 1.1, width: L.cap.maxW, height: size * 2.2,
      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: C.text, zIndex: 90, letterSpacing: '-0.01em',
      textShadow: `0 ${size * 0.05}px ${size * 0.22}px rgba(14,6,28,0.75), 0 0 ${size * 0.04}px rgba(14,6,28,0.9)`}}>
      {/* " | " forces a line break (balanced two-line hooks); each line keeps the word-by-word rise */}
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', rowGap: '0.12em'}}>
        {text.split(' | ').map((line, i, all) => {
          const before = all.slice(0, i).join(' ').split(' ').filter(Boolean).length;
          return <Words key={i} f={f} text={line} start={start + before * b(0.12)} step={b(0.12)} end={end === undefined ? undefined : end + before * b(0.12) * 0.35} accent={accent} boxed />;
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- act 1: TV lobby + phone join

const Tv: React.FC<{L: FilmLayout; f: number}> = ({L, f}) => {
  const s = L.tv.w / 1040;
  const bezel = 12 * s;
  return (
    <At x={L.tv.x} y={L.tv.y} z={2}>
      <div style={{position: 'absolute', left: -110 * s, top: L.tv.h / 2 + bezel, width: 220 * s, height: 26 * s,
        background: '#140B24', borderRadius: `0 0 ${14 * s}px ${14 * s}px`}} />
      <div style={{position: 'absolute', left: -L.tv.w / 2 - bezel, top: -L.tv.h / 2 - bezel, width: L.tv.w + 2 * bezel, height: L.tv.h + 2 * bezel,
        borderRadius: 22 * s + bezel, background: '#140B24', boxShadow: `0 ${30 * s}px ${80 * s}px rgba(10,4,24,0.45), 0 0 ${120 * s}px rgba(140,80,230,0.25)`}}>
        <div style={{position: 'absolute', left: bezel, top: bezel, width: L.tv.w, height: L.tv.h, borderRadius: 22 * s, overflow: 'hidden',
          background: `radial-gradient(120% 90% at 30% 0%, #553090 0%, #3A2068 55%, #2E1857 100%)`}}>
          <Lobby L={L} f={f} />
        </div>
      </div>
    </At>
  );
};

const Lobby: React.FC<{L: FilmLayout; f: number}> = ({L, f}) => {
  const s = L.tv.w / 1040;
  const P = (n: number) => n * s;
  const U = L.ui; // 9:16: TV text 30 % larger (it can't be read at feed size otherwise)
  const landed = LAND.filter((t) => f >= b(t)).length;
  // Start: breathes in the quiet beats, presses on b15.
  const breathe = f > b(12) && f < b(15) ? 0.035 * Math.sin(((f - b(12)) / b(1)) * Math.PI * 2) : 0;
  const press = f >= b(15) ? 0.08 * Math.sin(Math.PI * clamp((f - b(15)) / 9)) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      {/* left column */}
      <div style={{position: 'absolute', left: P(25), top: P(50 - 6 * U), width: P(280), textAlign: 'center', fontSize: P(24 * U), fontWeight: 800,
        color: C.text2, letterSpacing: '0.06em'}}>Scan to join</div>
      <div style={{position: 'absolute', left: P(40), top: P(100), width: P(250), height: P(250), borderRadius: P(26), background: C.text}}>
        <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} width="100%" height="100%">
          {QR.flatMap((row, r) => row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={C.ink} /> : null)))}
        </svg>
      </div>
      <div style={{position: 'absolute', left: P(30), top: P(372), width: P(270), display: 'flex', justifyContent: 'space-between',
        fontSize: P(96), fontWeight: 900, color: C.accent, lineHeight: 1}}>
        {ROOM_CODE.split('').map((ch, i) => <span key={i}>{ch}</span>)}
      </div>
      <div style={{position: 'absolute', left: P(10), top: P(492), width: P(310), textAlign: 'center', fontSize: P(18 * U), fontWeight: 700, color: C.text2}}>
        play.mishana.workers.dev
      </div>
      {/* right: header + grid */}
      <div style={{position: 'absolute', left: P(380), top: P(48 - 8 * (U - 1) * 2), fontSize: P(28 * U), fontWeight: 800, color: C.text}}>
        Players {landed}/12
      </div>
      {Array.from({length: 6}, (_, i) => {
        const c = SLOT_LOCAL(i);
        const land = spr(f, b(LAND[i]), POP);
        const p = PLAYERS[i];
        const lit = f >= b(LAND[i]);
        return (
          <div key={i} style={{position: 'absolute', left: P(c.x - 85), top: P(c.y - 75), width: P(170), height: P(150)}}>
            <div style={{position: 'absolute', inset: 0, borderRadius: P(24), border: `${P(2.5)}px dashed ${C.outline}`, opacity: lit ? 0 : 1}} />
            {lit ? (
              <div style={{position: 'absolute', inset: 0, borderRadius: P(24), background: C.elevated, transform: `scale(${land})`}}>
                <At x={P(85)} y={P(58)}>
                  {/* Maya's avatar arrives by flight; the others pop */}
                  <Avatar shape={p.shape} color={p.color} size={P(70)} initial={p.name[0]} cream={p.cream}
                    style={{transform: `scale(${i === 0 ? 1 : spr(f, b(LAND[i]) + 2, POP)})`}} />
                </At>
                <div style={{position: 'absolute', left: 0, right: 0, top: P(150 - 22 * U - 14), textAlign: 'center', fontSize: P(22 * U), lineHeight: 1,
                  fontWeight: 800, color: C.text}}>{p.name}</div>
              </div>
            ) : null}
          </div>
        );
      })}
      {/* Start */}
      <div style={{position: 'absolute', left: P(START_LOCAL.x - START_LOCAL.w / 2), top: P(START_LOCAL.y - START_LOCAL.h / 2), width: P(START_LOCAL.w),
        height: P(START_LOCAL.h), borderRadius: 999, background: C.primary, transform: `scale(${1 + breathe - press})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: P(12), color: C.ink, fontSize: P(30), fontWeight: 900,
        boxShadow: f > b(12) ? `0 0 ${P(40)}px rgba(255,79,154,${0.55 * prog(f, b(12), b(13.5))})` : undefined}}>
        <svg width={P(22)} height={P(24)} viewBox="0 0 22 24"><path d="M2 2l18 10L2 22z" fill={C.ink} /></svg>
        Start
      </div>
    </div>
  );
};

const JoinPhone: React.FC<{L: FilmLayout; f: number}> = ({L, f}) => {
  const {phone} = L;
  // 16:9: slides in once the camera has pulled back. 9:16 and 1:1: already in the frame on frame 0.
  const enterAt = L.mode === 'wide' ? b(5.5) : PRE;
  if (f < enterAt) return null;
  const u = phone.w / 300;
  const enter = spr(f, enterAt, SOFT);
  const dy = (1 - enter) * (L.H - phone.y + phone.h);
  const typed = 'Maya'.slice(0, [6, 6.22, 6.44, 6.66].filter((t) => f >= b(t)).length);
  const caret = f < b(7) && Math.floor(f / 18) % 2 === 0;
  const press = f >= b(7) ? 0.06 * Math.sin(Math.PI * clamp((f - b(7)) / 10)) : 0;
  const joined = f >= b(7.3);
  const p = PLAYERS[0];
  return (
    <At x={phone.x} y={phone.y + dy} z={6}>
      <PhoneFrame w={phone.w} h={phone.h} screen={C.bg}>
        <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text, textAlign: 'center'}}>
          <div style={{position: 'absolute', top: 64 * u, width: '100%', fontSize: 17 * u, fontWeight: 700, color: C.text2}}>Join room</div>
          <div style={{position: 'absolute', top: 88 * u, width: '100%', fontSize: 46 * u, fontWeight: 900, color: C.accent, letterSpacing: '0.12em'}}>{ROOM_CODE}</div>
          <div style={{position: 'absolute', top: 170 * u, left: 26 * u, fontSize: 15 * u, fontWeight: 700, color: C.muted}}>Your name</div>
          <div style={{position: 'absolute', top: 196 * u, left: 24 * u, width: 252 * u, height: 54 * u, borderRadius: 16 * u, background: C.surface,
            border: `${2 * u}px solid ${f < b(7.3) ? C.primary : C.outline}`, display: 'flex', alignItems: 'center', paddingLeft: 18 * u,
            fontSize: 26 * u, fontWeight: 800, boxSizing: 'border-box'}}>
            {typed}
            <span style={{display: 'inline-block', width: 2.5 * u, height: 28 * u, marginLeft: 3 * u, background: caret ? C.text : 'transparent'}} />
          </div>
          <div style={{position: 'absolute', top: 318 * u, left: 0, right: 0, fontSize: 20 * u, fontWeight: 700, color: C.text2}}>
            <Rise f={f} start={b(8)}>Waiting for the host…</Rise>
          </div>
          <div style={{position: 'absolute', top: 410 * u, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10 * u}}>
            {PLAYERS.map((q, i) => (
              <div key={i} style={{width: 30 * u, height: 30 * u, borderRadius: 99, background: q.color,
                boxShadow: i === 0 ? `0 0 0 ${3 * u}px ${C.bg}, 0 0 0 ${6 * u}px ${C.text}` : undefined, opacity: i === 0 ? 1 : 0.75}} />
            ))}
          </div>
          <div style={{position: 'absolute', top: 500 * u, left: 24 * u, width: 252 * u, height: 66 * u, borderRadius: 999,
            background: joined ? C.success : C.primary, color: C.ink, fontSize: 26 * u, fontWeight: 900, display: 'flex', alignItems: 'center',
            justifyContent: 'center', transform: `scale(${1 - press})`}}>
            {joined ? <Rise f={f} start={b(7.3)} cfg={POP}>✓ You’re in</Rise> : 'Join'}
          </div>
        </div>
      </PhoneFrame>
      {/* Maya's avatar sits in the phone until it flies to the TV (drawn by MayaFlight) */}
      {f < b(7.25) ? (
        <At x={0} y={-phone.h / 2 + 330 * u}>
          <Avatar shape={p.shape} color={p.color} size={110 * u} initial="M" style={{transform: `scale(${spr(f, b(6.1), POP)})`}} />
        </At>
      ) : null}
    </At>
  );
};

const MayaFlight: React.FC<{L: FilmLayout; f: number}> = ({L, f}) => {
  if (f < b(7.25) || f >= b(8)) return null;
  const u = L.phone.w / 300;
  const from = {x: L.phone.x, y: L.phone.y - L.phone.h / 2 + 330 * u};
  const slot = SLOT_LOCAL(0);
  const to = tvPt(L, slot.x, slot.y - 17);
  const t = prog(f, b(7.25), b(8), easeInOut);
  const x = lerp(from.x, to.x, t);
  const y = lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * 220;
  const size = lerp(110 * u, 70 * to.s, t);
  const p = PLAYERS[0];
  return (
    <At x={x} y={y} z={20}>
      <Avatar shape={p.shape} color={p.color} size={size} initial="M" style={{transform: `rotate(${Math.sin(Math.PI * t) * -25}deg)`}} />
    </At>
  );
};

// ---------------------------------------------------------------- act 2-4: cards, tiles, votes

const TILE_R = 30;

/** Where card i is (screen space) and what it looks like, from the drop until the stamp flood. */
const cardState = (L: FilmLayout, f: number, i: number, floodFrom: Rect) => {
  const full: Rect = {x: L.W / 2, y: L.H / 2, w: L.W, h: L.H};
  const R = Math.hypot(Math.max(floodFrom.x, L.W - floodFrom.x), Math.max(floodFrom.y, L.H - floodFrom.y)) * 1.08;
  const fs = b(16) - 9;
  let rect: Rect;
  let radius: number;
  let bezel = 1;
  let tile = 0; // 0 = phone card, 1 = player tile
  // the magenta flood covers the frame on the drop and is full-bleed for ≤ 10 frames before it settles into Maya's phone
  const shrink0 = b(16) + 8;
  if (i === 0 && f < shrink0) {
    const e = prog(f, fs, fs + 21, easeIn);
    const ee = clamp(e * 1.15);
    rect = {x: floodFrom.x, y: floodFrom.y, w: lerp(floodFrom.w, 2 * R, ee), h: lerp(floodFrom.h, 2 * R, ee)};
    radius = lerp(floodFrom.h / 2, R, ee);
    if (ee >= 1) {
      rect = full;
      radius = 0;
    }
    bezel = 0;
  } else if (i === 0 && f < b(18)) {
    const e = prog(f, shrink0, b(17.4), easeInOut);
    rect = rectLerp(full, L.hero, e);
    radius = lerp(0, L.hero.w * 0.14, e);
    bezel = prog(f, b(17), b(17.6), easeOut);
  } else {
    // fan out from the hero phone to the row, then shrink into tiles
    const fan = spr(f, b(18) + i * 2.5, SOFT);
    const toTile = prog(f, B(21) + i * 1.5, B(21.75) + i * 1.5, easeInOut);
    const row = rectLerp(L.hero, L.phones[i], fan);
    rect = rectLerp(row, L.tiles[i], toTile);
    radius = lerp(rect.w * 0.14, TILE_R, toTile);
    bezel = 1 - prog(f, B(21), B(21.35));
    tile = toTile;
  }
  return {rect, radius, bezel, tile};
};

const Cards: React.FC<{L: FilmLayout; f: number; floodFrom: Rect}> = ({L, f, floodFrom}) => {
  if (f < b(16) - 9 || f >= B(34.4)) return null;
  const order = [1, 2, 3, 4, 5, 0]; // Maya's card on top while the others slide out from behind it
  return (
    <>
      {order.map((i) => {
        if (i > 0 && f < b(18)) return null;
        const st = cardState(L, f, i, floodFrom);
        const mole = i === MOLE;
        const ring = mole ? prog(f, b(20), b(20) + 10, easeOut) * (1 - st.tile) : 0;
        const lift = mole ? spr(f, b(20), POP) * (1 - st.tile) : 0;
        const screen = i === 0 ? mix(C.primary, C.bg, prog(f, b(16.6), b(17.4))) : C.bg;
        const cardColor = mix(screen, C.surface, st.tile);
        // act 4: everyone but the Mole steps back (desaturated, never below 75 %); the Mole grows and shakes
        const back = !mole ? prog(f, B(28.2), B(29)) : 0;
        const grow = mole ? 1 + 0.12 * spr(f, B(28.3), SOFT) : 1;
        const shake = mole && f > B(30.8) && f < B(32) ? Math.sin(f * 1.7) * 3.5 * prog(f, B(30.8), B(31.6)) : 0;
        const tiltTo = Math.sign(L.tiles[MOLE].x - L.tiles[i].x) || -1;
        const tilt = !mole ? tiltTo * 7 * (spr(f, B(27.4), SOFT) - spr(f, B(28.4), SOFT)) : 0;
        const {rect} = st;

        return (
          <At key={i} x={rect.x} y={rect.y - lift * rect.h * 0.06} z={i === 0 ? 31 : 30}
            style={{opacity: 1 - 0.25 * back, filter: back > 0 ? `saturate(${1 - 0.7 * back})` : undefined}}>
            <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${(1 + lift * 0.06) * grow}) rotate(${shake + tilt}deg)`}}>
              {st.tile < 1 ? (
                <>
                  {ring > 0 ? (
                    <div style={{position: 'absolute', left: -rect.w / 2 - 16, top: -rect.h / 2 - 16, width: rect.w + 32, height: rect.h + 32,
                      borderRadius: rect.w * 0.14 + 16, border: `6px solid ${C.accent}`, transform: `scale(${0.9 + 0.1 * ring})`, opacity: ring,
                      boxShadow: `0 0 40px rgba(255,201,77,${0.5 * ring})`}} />
                  ) : null}
                  <PhoneFrame w={rect.w} h={rect.h} bezel={st.bezel} screen={cardColor} island={st.tile < 0.2}>
                    <CardFace f={f} i={i} w={rect.w} h={rect.h} />
                  </PhoneFrame>
                </>
              ) : (
                <div style={{position: 'absolute', left: -rect.w / 2, top: -rect.h / 2, width: rect.w, height: rect.h, borderRadius: TILE_R,
                  background: C.surface, boxShadow: mole && f > B(28.3) ? `0 0 0 5px ${C.accent}, 0 0 40px rgba(255,201,77,0.35)` : '0 12px 30px rgba(10,4,24,0.3)'}} />
              )}
              {st.tile > 0.6 ? <TileFace f={f} i={i} w={rect.w} h={rect.h} /> : null}
            </div>
          </At>
        );
      })}
    </>
  );
};

const CardFace: React.FC<{f: number; i: number; w: number; h: number}> = ({f, i, w, h}) => {
  const p = PLAYERS[i];
  const first = i === 0;
  // Maya's card arrives as the flood settles into her phone and flips on beat 18; the others flip on beat 19
  return (
    <WordFace f={f} w={w} h={h} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={p.word}
      flipAt={first ? b(18) : b(19) + i * 2} contentIn={first ? b(17.1) : -999} out={B(20.9)} />
  );
};

const TileFace: React.FC<{f: number; i: number; w: number; h: number}> = ({f, i, w, h}) => {
  const p = PLAYERS[i];
  const a = spr(f, B(21.45) + i * 2, POP);
  return (
    <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, fontFamily: FONT}}>
      <At x={w / 2} y={h * 0.4}>
        <Avatar shape={p.shape} color={p.color} size={w * 0.48} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${a})`}} />
      </At>
      <div style={{position: 'absolute', left: 0, right: 0, top: h * 0.72, textAlign: 'center', fontSize: w * 0.14, fontWeight: 800, color: C.text}}>
        <Rise f={f} start={B(21.6) + i * 2}>{p.name}</Rise>
      </div>
    </div>
  );
};

const CLUE_AT = [22, 23, 24, 25, 26, 27];

const Clues: React.FC<{L: FilmLayout; f: number}> = ({L, f}) => {
  if (f < B(22) || f > B(28.6)) return null;
  return (
    <>
      {PLAYERS.map((p, i) => {
        const t = L.tiles[i];
        const s = spr(f, B(CLUE_AT[i]), POP) - spr(f, B(28) + i * 1.5, {damping: 26, stiffness: 300});
        return (
          <At key={i} x={t.x} y={t.y - t.h / 2 - 18} z={40}>
            <Bubble text={p.clue} s={Math.max(0, s)} size={L.clue} tone={i === MOLE ? 'amber' : 'cream'} />
          </At>
        );
      })}
    </>
  );
};

const Votes: React.FC<{L: FilmLayout; f: number}> = ({L, f}) => {
  if (f < B(28) || f >= B(34.4)) return null;
  const target = L.tiles[MOLE];
  const grow = 1 + 0.12 * spr(f, B(28.3), SOFT);
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const t0 = B(28 + i * 0.5), t1 = B(28.5 + i * 0.5);
        if (f < t0) return null;
        const from = L.tiles[i];
        const to = {x: target.x + (i - 2) * target.w * 0.17 * grow, y: target.y - (target.h / 2) * grow + 26};
        const t = prog(f, t0, t1, easeInOut);
        const x = lerp(from.x, to.x, t);
        const y = lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * 200;
        const land = f >= t1 ? 1 + 0.35 * (1 - spr(f, t1, POP)) : 1;
        const size = L.vote;
        return (
          <At key={i} x={x} y={y} z={45}>
            <div style={{position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: 99,
              background: PLAYERS[i].color, border: `${size * 0.12}px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${land})`}} />
          </At>
        );
      })}
    </>
  );
};

/** The OUT stamp slams on b32; on b34 it floods the frame amber (the film's one twist flash), then becomes the slogan plate. */
const stampRect = (L: Layout) => {
  const t = L.tiles[MOLE];
  return {x: t.x, y: t.y + t.h * 0.05, w: t.w * 1.3, h: t.w * 0.46};
};

const Stamp: React.FC<{L: FilmLayout; f: number}> = ({L, f}) => {
  if (f < B(32) - 7 || f >= B(36.6) + 30) return null;
  const r = stampRect(L);
  const slam = f < B(32) ? lerp(2.6, 1, easeIn(prog(f, B(32) - 7, B(32), (x) => x))) : 1 + 0.1 * (1 - spr(f, B(32), POP));
  const fs = B(34) - 8;
  const e = prog(f, fs, fs + 21, easeIn);
  const R = Math.hypot(L.W, L.H) * 1.1;
  // the one twist flash: full-bleed amber for ≤ 10 frames, then it settles into a tilted amber plate behind the slogan
  const p0 = fs + 21 + 5;
  const k = prog(f, p0, p0 + 24, easeOut);
  const plate = {w: EM["Everyone's"] * L.big + 0.7 * L.big, h: 2.04 * L.big + 0.5 * L.big};
  const full = 2 * R;
  // shrink from "just covers the frame" so the plate edge appears on the first frame of the settle
  const w = k > 0 ? lerp(L.W + 24, plate.w, k) : lerp(r.w, full, e);
  const h = k > 0 ? lerp(L.H + 24, plate.h, k) : lerp(r.h, full, e);
  const x = lerp(r.x, L.W / 2, e), y = lerp(r.y, L.H / 2, e);
  const rot = k > 0 ? lerp(0, -2, k) : lerp(-8, 0, e);
  const radius = k > 0 ? lerp(0, 0.14 * L.big, k) : lerp(r.h * 0.22, 0, e);
  const textS = 1 - e;
  return (
    <At x={x} y={y} z={60}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: radius, background: C.accent,
        transform: `rotate(${rot}deg) scale(${slam})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: e < 0.1 ? `0 ${r.h * 0.15}px ${r.h * 0.4}px rgba(10,4,24,0.4)` : k > 0 ? `0 ${0.08 * L.big}px ${0.3 * L.big}px rgba(10,4,24,${0.45 * k})` : undefined}}>
        {textS > 0.02 ? (
          <span style={{fontFamily: FONT, fontWeight: 900, fontSize: r.h * 0.66 * textS + 0.01, color: C.ink, letterSpacing: '0.06em'}}>OUT</span>
        ) : null}
      </div>
    </At>
  );
};

const MoleWord: React.FC<{L: FilmLayout; f: number}> = ({L, f}) => {
  if (f < B(32.5) || f >= B(34.4)) return null;
  const t = L.tiles[MOLE];
  const size = L.moleSize;
  const x = L.moleY === null ? t.x : L.cx;
  const y = L.moleY ?? t.y + t.h * 0.56 + size * 0.9;
  return (
    <At x={x} y={y} z={46}>
      <div style={{position: 'absolute', left: -450, width: 900, top: -size * 0.6, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size,
        lineHeight: 1.2, color: C.accent, textShadow: `0 ${size * 0.05}px ${size * 0.22}px rgba(14,6,28,0.7)`}}>
        <Rise f={f} start={B(32.5)} cfg={POP}>Sami was the Mole</Rise>
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- act 5-6: slogan + logo

const sloganGeom = (L: Layout, word: string) => {
  const big = L.big;
  const dot = big * 0.2;
  const gap = big * 0.05;
  const ww = EM[word] * big;
  const total = ww + gap + dot;
  const x0 = L.W / 2 - total / 2;
  const lineTop = L.H / 2 + 0.02 * big; // second line box top
  return {big, dot, x0, ww, lineTop, dotX: x0 + ww + gap + dot / 2, dotY: lineTop + BASELINE * big - dot / 2};
};

const SloganLine: React.FC<{L: Layout; f: number; text: string; top: number; start: number; end: number; color: string; x0?: number}> = ({L, f, text, top, start, end, color, x0}) => (
  <div style={{position: 'absolute', left: x0 ?? 0, width: x0 === undefined ? L.W : undefined, top, height: L.big, textAlign: x0 === undefined ? 'center' : 'left',
    fontFamily: FONT, fontWeight: 900, fontSize: L.big, lineHeight: 1, color, letterSpacing: 0, whiteSpace: 'nowrap', zIndex: 70}}>
    <Rise f={f} start={start} end={end} cfg={SNAPPY}>{text}</Rise>
  </div>
);

const Slogan: React.FC<{L: FilmLayout; f: number}> = ({L, f}) => {
  if (f < B(34.3) || f >= B(41)) return null;
  const g1 = sloganGeom(L, 'innocent');
  const g2 = sloganGeom(L, 'lying');
  const line1Top = L.H / 2 - 1.02 * L.big;
  // the stage comes back out of the ink full stop
  const vf = B(36.6);
  const ve = prog(f, vf, vf + 21, easeIn);
  const R = Math.hypot(Math.max(g1.dotX, L.W - g1.dotX), Math.max(g1.dotY, L.H - g1.dotY)) * 1.06;
  const inkDot = spr(f, B(35.5), POP);
  const amberDot = spr(f, B(38.2), POP);
  // amber dot travels to the logo position on b40
  const move = prog(f, B(40.2), B(40.95), easeInOut);
  const L0 = L.logo * 1.35;
  const markDot = (16.64 / 160) * L0;
  const dotTarget = {x: L.W / 2 + (-1.92 / 160) * L0, y: L.H / 2 + (15.84 / 160) * L0};
  const push = 1 + 0.05 * prog(f, B(37), B(40), easeInOut);
  // the text sits in a container scaled by `push` around the centre; the dot lives outside it, so push it by hand
  const px = L.W / 2 + (g2.dotX - L.W / 2) * push, py = L.H / 2 + (g2.dotY - L.H / 2) * push;
  const ax = lerp(px, dotTarget.x, move), ay = lerp(py, dotTarget.y, move) - Math.sin(Math.PI * move) * 60;
  const ad = lerp(g2.dot * push, markDot, move);
  return (
    <>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${f > vf ? push : 1})`, zIndex: 70}}>
        {f < vf + 21 ? (
          <>
            <SloganLine L={L} f={f} text="Everyone's" top={line1Top} start={B(34.5)} end={B(36.6) + 14} color={C.ink} />
            <SloganLine L={L} f={f} text="innocent" top={g1.lineTop} start={B(35)} end={B(36.6) + 14} color={C.ink} x0={g1.x0} />
            {inkDot > 0 && ve <= 0 ? (
              <At x={g1.dotX} y={g1.dotY} z={72}>
                <div style={{position: 'absolute', left: -g1.dot / 2, top: -g1.dot / 2, width: g1.dot, height: g1.dot, borderRadius: 99,
                  background: C.ink, transform: `scale(${inkDot})`}} />
              </At>
            ) : null}
            {ve > 0 ? (
              <div style={{position: 'absolute', inset: 0, zIndex: 73, clipPath: `circle(${lerp(g1.dot / 2, R, ve)}px at ${g1.dotX}px ${g1.dotY}px)`}}>
                <StageBg />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <StageBg />
            <SloganLine L={L} f={f} text="Someone's" top={line1Top} start={B(37.2)} end={B(40)} color={C.text} />
            <SloganLine L={L} f={f} text="lying" top={g2.lineTop} start={B(37.7)} end={B(40.1)} color={C.text} x0={g2.x0} />
          </>
        )}
      </div>
      {amberDot > 0 && f >= vf + 21 ? (
        <At x={ax} y={ay} z={80}>
          <div style={{position: 'absolute', left: -ad / 2, top: -ad / 2, width: ad, height: ad, borderRadius: 99, background: C.accent,
            transform: `scale(${move > 0 ? 1 : amberDot})`}} />
        </At>
      ) : null}
    </>
  );
};

export type Cta = 'live' | 'prelaunch';

const Outro: React.FC<{L: FilmLayout; f: number; cta: Cta}> = ({L, f, cta}) => {
  if (f < B(40.95)) return null;
  const tall = L.mode === 'tall';
  const L0 = L.logo * 1.35;
  const wmW = Math.min(L.W * 0.82, L.logo * (tall ? 2.9 : 3.1));
  const wmH = wmW * (301.6 / 1001.8);
  const tagSize = tall ? 52 : L.mode === 'wide' ? 44 : 40;
  const chipSize = tall ? 38 : 28;
  const ctaH = tall ? 104 : 84;
  const urlSize = tall ? 46 : L.mode === 'wide' ? 40 : 36;
  // 9:16: two chip rows so nothing reaches the right-hand rail (all inside x 60–960)
  const rows = tall ? [['3–12 players', 'Free to play'], ['Phones are the controllers']] : [['3–12 players', 'Phones are the controllers', 'Free to play']];
  const rowH = chipSize * 1.9, rowGap = chipSize * 0.45;
  const chipsH = rows.length * rowH + (rows.length - 1) * rowGap;
  const pre = cta === 'prelaunch';
  // pre-launch (design-v3 E3): "Open on a laptop or TV browser:" + the URL in the ads' pill + "Google TV app coming soon"
  const openSize = urlSize * 0.72, subSize = urlSize * 0.8, pillH = urlSize * 1.2 + 20;
  const below = pre ? urlSize * 0.45 + openSize * 1.3 + urlSize * 0.2 + pillH + urlSize * 0.3 + subSize * 1.2 : 0;
  const gaps = [L.logo * 0.06, L.logo * 0.14, tagSize * 0.6, chipSize * 1.0];
  const total = L.logo + gaps[0] + wmH + gaps[1] + tagSize * 1.2 + gaps[2] + chipsH + gaps[3] + ctaH + below;
  const top = (L.H - total) / 2;
  const markY = top + L.logo / 2;
  const wmY = top + L.logo + gaps[0] + wmH / 2;
  const tagY = wmY + wmH / 2 + gaps[1] + tagSize * 0.6;
  const chipTop = tagY + tagSize * 0.6 + gaps[2];
  const ctaY = chipTop + chipsH + gaps[3] + ctaH / 2;
  const openTop = ctaY + ctaH / 2 + urlSize * 0.45;
  const urlTop = openTop + openSize * 1.3 + urlSize * 0.2;
  const subTop = urlTop + pillH + urlSize * 0.3;

  const bubble = spr(f, B(41), POP);
  const stroke = prog(f, B(41.2), B(41.75), easeOut);
  const settle = prog(f, B(42), B(42.9), easeInOut);
  const size = lerp(L0, L.logo, settle);
  const mx = L.W / 2, my = lerp(L.H / 2, markY, settle);
  const reveal = prog(f, B(42.2), B(43.1), easeInOut);
  const ctaPop = spr(f, B(45.5), POP);
  let chipIndex = 0;
  return (
    <>
      <At x={mx} y={my} z={82}>
        <Mark size={size} bubble={bubble} stroke={stroke} />
      </At>
      <At x={L.W / 2} y={wmY} z={81}>
        <div style={{position: 'absolute', left: -wmW / 2, top: -wmH / 2, width: wmW, height: wmH,
          clipPath: `inset(0 ${50 * (1 - reveal)}% 0 ${50 * (1 - reveal)}%)`, transform: `translateY(${(1 - reveal) * 30}px)`}}>
          <Img src={staticFile('wordmark-latin.svg')} style={{width: '100%', height: '100%'}} />
        </div>
      </At>
      <div style={{position: 'absolute', left: 0, width: L.W, top: tagY - tagSize * 0.6, textAlign: 'center', fontFamily: FONT, fontWeight: 700,
        fontSize: tagSize, lineHeight: 1.2, color: C.text2, zIndex: 83}}>
        <Words f={f} text="The secret-word party game for your TV" start={B(43)} step={4} />
      </div>
      {rows.map((row, r) => (
        <div key={r} style={{position: 'absolute', left: 0, width: L.W, top: chipTop + r * (rowH + rowGap), height: rowH, display: 'flex', justifyContent: 'center',
          alignItems: 'center', gap: chipSize * 0.5, zIndex: 83, flexWrap: 'nowrap'}}>
          {row.map((c) => {
            const k = spr(f, B(43.8 + chipIndex++ * 0.5), POP);
            return (
              <div key={c} style={{transform: `scale(${k})`, fontFamily: FONT, fontWeight: 800, fontSize: chipSize, lineHeight: 1, color: C.text,
                border: `2px solid ${C.outline}`, background: C.surface, borderRadius: 999, padding: `${chipSize * 0.42}px ${chipSize * 0.8}px`, whiteSpace: 'nowrap'}}>{c}</div>
            );
          })}
        </div>
      ))}
      <At x={L.W / 2} y={ctaY} z={84}>
        <div style={{position: 'absolute', left: 0, top: -ctaH / 2, height: ctaH, transform: `translateX(-50%) scale(${ctaPop})`, borderRadius: 999,
          background: C.primary, color: C.ink, fontFamily: FONT, fontWeight: 900, fontSize: ctaH * 0.36, display: 'flex', alignItems: 'center',
          padding: `0 ${ctaH * 0.55}px`, gap: ctaH * 0.2, whiteSpace: 'nowrap', boxShadow: `0 0 ${ctaH * 0.6}px rgba(255,79,154,0.45)`}}>
          <svg width={ctaH * 0.3} height={ctaH * 0.33} viewBox="0 0 22 24"><path d="M2 2l18 10L2 22z" fill={C.ink} /></svg>
          {cta === 'live' ? 'Available on Google TV' : 'Play free on your TV'}
        </div>
      </At>
      {pre ? (
        <>
          <div style={{position: 'absolute', left: 0, width: L.W, top: openTop, textAlign: 'center', fontFamily: FONT, fontWeight: 700,
            fontSize: openSize, lineHeight: 1.3, color: C.text2, zIndex: 84}}>
            <Rise f={f} start={B(45.8)}>Open on a laptop or TV browser:</Rise>
          </div>
          {/* the ads' URL pill (EndCard.tsx): one recognisable "type this" object across ads and film */}
          <div style={{position: 'absolute', left: 0, width: L.W, top: urlTop, textAlign: 'center', zIndex: 84}}>
            <span style={{display: 'inline-block', boxSizing: 'border-box', height: pillH, fontFamily: FONT, fontWeight: 800, fontSize: urlSize, lineHeight: 1.2,
              color: C.text, background: 'rgba(14,6,28,0.45)', border: `2px solid ${C.outline}`, borderRadius: 22, padding: `8px ${urlSize * 0.6}px`}}>
              <Rise f={f} start={B(45.9)}>{PLAY_URL}</Rise>
            </span>
          </div>
          <div style={{position: 'absolute', left: 0, width: L.W, top: subTop, textAlign: 'center', fontFamily: FONT, fontWeight: 700,
            fontSize: subSize, lineHeight: 1.2, color: C.text2, zIndex: 84}}>
            <Rise f={f} start={B(46.2)}>Google TV app coming soon</Rise>
          </div>
        </>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------- the film

const OPENING: Record<Cta, string> = {
  // pre-launch: nothing on the screen may contradict "Play free in your browser" (DECISIONS.md #16)
  prelaunch: 'Your TV. Everyone’s phone. *One liar.*',
  live: 'Turn your Google TV into a *party.*',
};

/** One on-screen caption: [id, text, start frame, end frame, accent]. Exported for the landing's caption-free hero loop. */
export type CaptionSpec = {id: string; text: string; start: number; end: number; accent?: string; hook?: boolean};
export const captionsFor = (cta: Cta, square = false): CaptionSpec[] => [
  {id: 'opening', text: square && cta === 'live' ? 'Turn your Google TV | into a *party.*' : OPENING[cta], start: -90, end: b(5.5), hook: true,
    accent: cta === 'prelaunch' ? C.primary : C.accent},
  {id: 'friends', text: 'Friends join from their phones. *No\u00A0app.*', start: b(5.8), end: b(11.3)},
  {id: 'secret', text: 'Everyone gets a *secret\u00A0word…*', start: b(11.55), end: b(15.8)},
  {id: 'different', text: '…but one is *different.*', start: B(19.25), end: B(21.4), accent: C.primary},
  {id: 'clues', text: 'Give one-word *clues.*', start: B(21.6), end: B(25.6)},
  {id: 'fit', text: 'Spot who doesn’t *fit.*', start: B(25.8), end: B(28)},
  {id: 'out', text: 'Vote them *out.*', start: B(28.2), end: B(31.8)},
  {id: 'mole', text: 'Caught the *Mole!*', start: B(32.05), end: B(33.8), accent: C.primary},
];
/** "Sami was the Mole" (amber line under the Mole's tile): also hidden when `captions` is false. */
export const MOLE_WORD = {text: 'Sami was the Mole', start: () => B(32.5), end: () => B(34.4)};

/** `captions={false}`: the caption-free cut (landing hero, design-v3 C6); every caption and the "Sami was the Mole" line
 * are hidden, everything else (slogan, outro) is unchanged. */
export const Film: React.FC<{cta?: Cta; captions?: boolean}> = ({cta = 'live', captions = true}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const L = filmLayout(width, height);
  const cam = camAt(L, f);
  const start = tvPt(L, START_LOCAL.x, START_LOCAL.y);
  const sp = toScreen(L, cam, start);
  const floodFrom: Rect = {x: sp.x, y: sp.y, w: START_LOCAL.w * start.s * cam.z, h: START_LOCAL.h * start.s * cam.z};
  const act1 = f < b(17);
  const spot = prog(f, b(12), b(14));
  return (
    <AbsoluteFill style={{background: C.bg, overflow: 'hidden'}}>
      <StageBg />
      {act1 ? (
        <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0',
          transform: `translate(${L.W / 2}px, ${L.H / 2}px) scale(${cam.z}) translate(${-cam.x}px, ${-cam.y}px)`}}>
          <Tv L={L} f={f} />
          <JoinPhone L={L} f={f} />
          <MayaFlight L={L} f={f} />
        </div>
      ) : null}
      {act1 && spot > 0 ? (
        // a soft violet spotlight on Start (never a black vignette)
        <div style={{position: 'absolute', inset: 0, zIndex: 25,
          background: `radial-gradient(circle at ${sp.x}px ${sp.y}px, rgba(29,16,54,0) ${floodFrom.w * 0.7}px, rgba(29,16,54,${0.5 * spot}) ${floodFrom.w * 1.8}px)`}} />
      ) : null}

      <Cards L={L} f={f} floodFrom={floodFrom} />
      <Clues L={L} f={f} />
      <Votes L={L} f={f} />
      {captions ? <MoleWord L={L} f={f} /> : null}
      <Stamp L={L} f={f} />
      <Slogan L={L} f={f} />
      <Outro L={L} f={f} cta={cta} />

      {/* captions (screen space); on-screen times respect holdFrames() — see the hold table in the report */}
      {captions
        ? captionsFor(cta, L.mode === 'square').map((c) => <Caption key={c.id} L={L} f={f} text={c.text} start={c.start} end={c.end} hook={c.hook} accent={c.accent} />)
        : null}
    </AbsoluteFill>
  );
};

/** Caption on-screen seconds (start → end; the opening counts from frame 0). Exported for the QA report. */
export const CAPTION_HOLDS = (): Array<[string, number]> => [
  ['opening', b(5.5) / 60],
  ['friends', (b(11.3) - b(5.8)) / 60],
  ['secret', (b(15.8) - b(11.55)) / 60],
  ['different', (B(21.4) - B(19.25)) / 60],
  ['clues', (B(25.6) - B(21.6)) / 60],
  ['fit', (B(28) - B(25.8)) / 60],
  ['out', (B(31.8) - B(28.2)) / 60],
  ['mole', (B(33.8) - B(32.05)) / 60],
  ['innocent', (B(36.6) + 14 - B(34.5)) / 60],
  ['lying', (B(40) - B(37.2)) / 60],
  ['cta', (FILM_DURATION - B(45.5)) / 60],
];
