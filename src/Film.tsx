import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, MOLE, PLAYERS, ROOM_CODE} from './brand';
import {Layout, layoutFor, Rect} from './layout';
import {At, Avatar, Bubble, FONT, Mark, PhoneFrame, Rise, WordFace, Words} from './parts';
import {QR, QR_N} from './qr';
import {
  b, clamp, easeIn, easeInOut, easeOut, HEAVY, lerp, mix, POP, prog, SNAPPY, SOFT, spr,
} from './time';

// Advance widths (em) of Cairo Black, measured with fontTools (tools: see README).
const EM: Record<string, number> = {"Everyone's": 4.872, innocent: 3.857, "Someone's": 4.882, lying: 2.155};
const BASELINE = 0.85; // Cairo (tightened metrics 880/-180) baseline inside a line-height:1 box

// ---------------------------------------------------------------- geometry helpers

/** TV-local design units (screen 1040 x 585) -> world. */
const tvPt = (L: Layout, lx: number, ly: number) => {
  const s = L.tv.w / 1040;
  return {x: L.tv.x - L.tv.w / 2 + lx * s, y: L.tv.y - L.tv.h / 2 + ly * s, s};
};
const START_LOCAL = {x: 865, y: 520, w: 250, h: 72};
const SLOT_LOCAL = (i: number) => ({x: 465 + (i % 3) * 190, y: 185 + Math.floor(i / 3) * 170});
const LAND = [8, 9, 9.5, 10, 10.5, 11]; // beats at which each player's tile lands on the TV

type Cam = {z: number; x: number; y: number};
const camAt = (L: Layout, f: number): Cam => {
  const start = tvPt(L, START_LOCAL.x, START_LOCAL.y);
  const keys: Array<[number, number, number, number]> = [
    [0, 2.6, L.tv.x, L.tv.y],
    [b(0.6), 2.6, L.tv.x, L.tv.y],
    [b(2.6), 1, L.W / 2, L.H / 2],
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

// ---------------------------------------------------------------- captions

const Caption: React.FC<{L: Layout; children: React.ReactNode}> = ({L, children}) => (
  <div style={{position: 'absolute', left: L.cap.x - L.cap.maxW / 2, top: L.cap.y - L.cap.size, width: L.cap.maxW, height: L.cap.size * 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    fontFamily: FONT, fontWeight: 900, fontSize: L.cap.size, lineHeight: 1.05, color: C.text, zIndex: 50, letterSpacing: '-0.01em'}}>
    {children}
  </div>
);

// ---------------------------------------------------------------- act 1: TV lobby + phone join

const Tv: React.FC<{L: Layout; f: number}> = ({L, f}) => {
  const s = L.tv.w / 1040;
  const pop = spr(f, 0, POP);
  const m = prog(f, b(0.9), b(2.1));
  const d0 = 64 * s;
  const w = lerp(d0, L.tv.w, easeInOut(clamp(m * 1.7)));
  const h = lerp(d0, L.tv.h, easeInOut(clamp((m - 0.3) / 0.7)));
  const r = lerp(h / 2, 22 * s, clamp((m - 0.55) / 0.45));
  const fill = mix(C.accent, C.bg, clamp(m * 2.2));
  const bezel = 12 * s * prog(f, b(1.9), b(2.4), easeOut);
  const stand = spr(f, b(2.2), SOFT);
  const content = f >= b(1.95);
  const scale = m > 0 ? 1 : pop;
  return (
    <At x={L.tv.x} y={L.tv.y} z={2}>
      {stand > 0.01 ? (
        <div style={{position: 'absolute', left: -110 * s, top: L.tv.h / 2 + bezel, width: 220 * s, height: 26 * s * stand,
          background: '#05030A', borderRadius: `0 0 ${14 * s}px ${14 * s}px`}} />
      ) : null}
      <div style={{position: 'absolute', left: -w / 2 - bezel, top: -h / 2 - bezel, width: w + 2 * bezel, height: h + 2 * bezel,
        borderRadius: r + bezel, background: '#05030A', transform: `scale(${scale})`,
        boxShadow: bezel > 0 ? `0 ${30 * s}px ${80 * s}px rgba(0,0,0,0.55)` : undefined}}>
        <div style={{position: 'absolute', left: bezel, top: bezel, width: w, height: h, borderRadius: r, overflow: 'hidden',
          background: m >= 1 ? `radial-gradient(120% 90% at 30% 0%, #2A1240 0%, ${C.bg} 60%)` : fill}}>
          {content ? <Lobby L={L} f={f} /> : null}
        </div>
      </div>
    </At>
  );
};

const Lobby: React.FC<{L: Layout; f: number}> = ({L, f}) => {
  const s = L.tv.w / 1040;
  const P = (n: number) => n * s;
  const landed = LAND.filter((t) => f >= b(t)).length;
  const qrIn = spr(f, b(2.2), SNAPPY);
  const startIn = spr(f, b(3), POP);
  // Start: breathes in the quiet beats, presses on b15.
  const breathe = f > b(12) && f < b(15) ? 0.035 * Math.sin(((f - b(12)) / b(1)) * Math.PI * 2) : 0;
  const press = f >= b(15) ? 0.08 * Math.sin(Math.PI * clamp((f - b(15)) / 9)) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      {/* left column */}
      <div style={{position: 'absolute', left: P(40), top: P(48), width: P(250), textAlign: 'center', fontSize: P(24), fontWeight: 700,
        color: C.text2, letterSpacing: '0.08em'}}>
        <Rise f={f} start={b(2.05)}>Scan to join</Rise>
      </div>
      <div style={{position: 'absolute', left: P(40), top: P(100), width: P(250), height: P(250), borderRadius: P(26), background: C.text,
        transform: `scale(${qrIn})`}}>
        <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} width="100%" height="100%">
          {QR.flatMap((row, r) => row.map((on, c) => {
            if (!on) return null;
            const dist = Math.hypot(r - QR_N / 2, c - QR_N / 2) / (QR_N / 2);
            const k = spr(f, b(2.35) + dist * b(0.7), {damping: 18, stiffness: 260});
            return k > 0.01 ? <rect key={`${r}-${c}`} x={c + (1 - k) / 2} y={r + (1 - k) / 2} width={k} height={k} fill={C.ink} /> : null;
          }))}
        </svg>
      </div>
      <div style={{position: 'absolute', left: P(30), top: P(372), width: P(270), display: 'flex', justifyContent: 'space-between',
        fontSize: P(96), fontWeight: 900, color: C.accent, lineHeight: 1}}>
        {ROOM_CODE.split('').map((ch, i) => <Rise key={i} f={f} start={b(2 + i)} cfg={POP}>{ch}</Rise>)}
      </div>
      <div style={{position: 'absolute', left: P(40), top: P(492), width: P(250), textAlign: 'center', fontSize: P(18), fontWeight: 600, color: C.muted}}>
        <Rise f={f} start={b(4.5)}>play.mishana.workers.dev</Rise>
      </div>
      {/* right: header + grid */}
      <div style={{position: 'absolute', left: P(380), top: P(48), fontSize: P(28), fontWeight: 800, color: C.text}}>
        <Rise f={f} start={b(2.1)}>Players {landed}/12</Rise>
      </div>
      {Array.from({length: 6}, (_, i) => {
        const c = SLOT_LOCAL(i);
        const slot = spr(f, b(2.15 + i * 0.07), SNAPPY);
        const land = spr(f, b(LAND[i]), POP);
        const p = PLAYERS[i];
        const lit = f >= b(LAND[i]);
        return (
          <div key={i} style={{position: 'absolute', left: P(c.x - 85), top: P(c.y - 75), width: P(170), height: P(150), transform: `scale(${slot})`}}>
            <div style={{position: 'absolute', inset: 0, borderRadius: P(24), border: `${P(2.5)}px dashed ${C.outline}`, opacity: lit ? 0 : 1}} />
            {lit ? (
              <div style={{position: 'absolute', inset: 0, borderRadius: P(24), background: C.surface, transform: `scale(${land})`}}>
                <At x={P(85)} y={P(62)}>
                  {/* Maya's avatar arrives by flight; the others pop */}
                  <Avatar shape={p.shape} color={p.color} size={P(72)} initial={p.name[0]} cream={p.cream}
                    style={{transform: `scale(${i === 0 ? 1 : spr(f, b(LAND[i]) + 2, POP)})`}} />
                </At>
                <div style={{position: 'absolute', left: 0, right: 0, top: P(108), textAlign: 'center', fontSize: P(22), fontWeight: 700, color: C.text}}>{p.name}</div>
              </div>
            ) : null}
          </div>
        );
      })}
      {/* Start */}
      <div style={{position: 'absolute', left: P(START_LOCAL.x - START_LOCAL.w / 2), top: P(START_LOCAL.y - START_LOCAL.h / 2), width: P(START_LOCAL.w),
        height: P(START_LOCAL.h), borderRadius: 999, background: C.primary, transform: `scale(${startIn * (1 + breathe - press)})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: P(12), color: C.ink, fontSize: P(30), fontWeight: 900,
        boxShadow: f > b(12) ? `0 0 ${P(40)}px rgba(255,61,139,${0.5 * prog(f, b(12), b(13.5))})` : undefined}}>
        <svg width={P(22)} height={P(24)} viewBox="0 0 22 24"><path d="M2 2l18 10L2 22z" fill={C.ink} /></svg>
        Start
      </div>
    </div>
  );
};

const JoinPhone: React.FC<{L: Layout; f: number}> = ({L, f}) => {
  const {phone} = L;
  if (f < b(5.3)) return null;
  const u = phone.w / 300;
  const enter = spr(f, b(5.5), SOFT);
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
                boxShadow: i === 0 ? `0 0 0 ${3 * u}px ${C.bg}, 0 0 0 ${6 * u}px ${C.text}` : undefined, opacity: i === 0 ? 1 : 0.55}} />
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

const MayaFlight: React.FC<{L: Layout; f: number}> = ({L, f}) => {
  if (f < b(7.25) || f >= b(8)) return null;
  const u = L.phone.w / 300;
  const from = {x: L.phone.x, y: L.phone.y - L.phone.h / 2 + 330 * u};
  const slot = SLOT_LOCAL(0);
  const to = tvPt(L, slot.x, slot.y - 13);
  const t = prog(f, b(7.25), b(8), easeInOut);
  const x = lerp(from.x, to.x, t);
  const y = lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * 220;
  const size = lerp(110 * u, 72 * to.s, t);
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
const cardState = (L: Layout, f: number, i: number, floodFrom: Rect) => {
  const full: Rect = {x: L.W / 2, y: L.H / 2, w: L.W, h: L.H};
  const R = Math.hypot(Math.max(floodFrom.x, L.W - floodFrom.x), Math.max(floodFrom.y, L.H - floodFrom.y)) * 1.08;
  const fs = b(16) - 9;
  let rect: Rect;
  let radius: number;
  let bezel = 1;
  let tile = 0; // 0 = phone card, 1 = player tile
  if (i === 0 && f < b(17)) {
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
    const e = prog(f, b(17), b(17.8), easeInOut);
    rect = rectLerp(full, L.hero, e);
    radius = lerp(0, L.hero.w * 0.14, e);
    bezel = prog(f, b(17.5), b(18), easeOut);
  } else {
    // fan out from the hero phone to the row, then (b21) shrink into tiles
    const fan = spr(f, b(18) + i * 2.5, SOFT);
    const toTile = prog(f, b(21) + i * 1.5, b(21.75) + i * 1.5, easeInOut);
    const row = rectLerp(L.hero, L.phones[i], fan);
    rect = rectLerp(row, L.tiles[i], toTile);
    radius = lerp(rect.w * 0.14, TILE_R, toTile);
    bezel = 1 - prog(f, b(21), b(21.35));
    tile = toTile;
  }
  return {rect, radius, bezel, tile};
};

const Cards: React.FC<{L: Layout; f: number; floodFrom: Rect}> = ({L, f, floodFrom}) => {
  if (f < b(16) - 9 || f >= b(34.4)) return null;
  const order = [1, 2, 3, 4, 5, 0]; // Maya's card on top while the others slide out from behind it
  return (
    <>
      {order.map((i) => {
        if (i > 0 && f < b(18)) return null;
        const st = cardState(L, f, i, floodFrom);
        const p = PLAYERS[i];
        const mole = i === MOLE;
        const ring = mole ? prog(f, b(20), b(20) + 10, easeOut) * (1 - st.tile) : 0;
        const lift = mole ? spr(f, b(20), POP) * (1 - st.tile) : 0;
        const screen = i === 0 ? mix(C.primary, C.bg, prog(f, b(17), b(17.7))) : C.bg;
        const cardColor = mix(screen, C.surface, st.tile);
        // act 4: everyone but the Mole dims; the Mole grows and shakes
        const dim = !mole ? 1 - 0.6 * prog(f, b(28.2), b(29)) : 1;
        const grow = mole ? 1 + 0.12 * spr(f, b(28.3), SOFT) : 1;
        const shake = mole && f > b(30.8) && f < b(32) ? Math.sin(f * 1.7) * 3.5 * prog(f, b(30.8), b(31.6)) : 0;
        const tiltTo = Math.sign(L.tiles[MOLE].x - L.tiles[i].x) || -1;
        const tilt = !mole ? tiltTo * 7 * (spr(f, b(27.4), SOFT) - spr(f, b(28.4), SOFT)) : 0;
        const {rect} = st;

        return (
          <At key={i} x={rect.x} y={rect.y - lift * rect.h * 0.06} z={i === 0 ? 31 : 30} style={{opacity: dim}}>
            <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${(1 + lift * 0.06) * grow}) rotate(${shake + tilt}deg)`}}>
              {st.tile < 1 ? (
                <>
                  {ring > 0 ? (
                    <div style={{position: 'absolute', left: -rect.w / 2 - 16, top: -rect.h / 2 - 16, width: rect.w + 32, height: rect.h + 32,
                      borderRadius: rect.w * 0.14 + 16, border: `5px solid ${C.accent}`, transform: `scale(${0.9 + 0.1 * ring})`, opacity: ring,
                      boxShadow: `0 0 40px rgba(255,194,61,${0.45 * ring})`}} />
                  ) : null}
                  <PhoneFrame w={rect.w} h={rect.h} bezel={st.bezel} screen={cardColor} island={st.tile < 0.2}>
                    <CardFace f={f} i={i} w={rect.w} h={rect.h} />
                  </PhoneFrame>
                </>
              ) : (
                <div style={{position: 'absolute', left: -rect.w / 2, top: -rect.h / 2, width: rect.w, height: rect.h, borderRadius: TILE_R,
                  background: C.surface, boxShadow: mole && f > b(28.3) ? `0 0 0 ${4}px ${C.accent}` : undefined}} />
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
      flipAt={first ? b(18) : b(19) + i * 2} contentIn={first ? b(17.25) : -999} out={b(20.9)} />
  );
};

const TileFace: React.FC<{f: number; i: number; w: number; h: number}> = ({f, i, w, h}) => {
  const p = PLAYERS[i];
  const a = spr(f, b(21.45) + i * 2, POP);
  return (
    <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, fontFamily: FONT}}>
      <At x={w / 2} y={h * 0.4}>
        <Avatar shape={p.shape} color={p.color} size={w * 0.48} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${a})`}} />
      </At>
      <div style={{position: 'absolute', left: 0, right: 0, top: h * 0.72, textAlign: 'center', fontSize: w * 0.14, fontWeight: 800, color: C.text}}>
        <Rise f={f} start={b(21.6) + i * 2}>{p.name}</Rise>
      </div>
    </div>
  );
};

const CLUE_AT = [22, 23, 24, 25, 26, 27];

const Clues: React.FC<{L: Layout; f: number}> = ({L, f}) => {
  if (f < b(22) || f > b(28.6)) return null;
  const size = L.mode === 'tall' ? 36 : L.mode === 'wide' ? 30 : 28;
  return (
    <>
      {PLAYERS.map((p, i) => {
        const t = L.tiles[i];
        const s = spr(f, b(CLUE_AT[i]), POP) - spr(f, b(28) + i * 1.5, {damping: 26, stiffness: 300});
        return (
          <At key={i} x={t.x} y={t.y - t.h / 2 - 18} z={40}>
            <Bubble text={p.clue} s={Math.max(0, s)} size={size} tone={i === MOLE ? 'amber' : 'cream'} />
          </At>
        );
      })}
    </>
  );
};

const Votes: React.FC<{L: Layout; f: number}> = ({L, f}) => {
  if (f < b(28) || f >= b(34.4)) return null;
  const target = L.tiles[MOLE];
  const grow = 1 + 0.12 * spr(f, b(28.3), SOFT);
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const t0 = b(28 + i * 0.5), t1 = b(28.5 + i * 0.5);
        if (f < t0) return null;
        const from = L.tiles[i];
        const to = {x: target.x + (i - 2) * target.w * 0.17 * grow, y: target.y - (target.h / 2) * grow + 26};
        const t = prog(f, t0, t1, easeInOut);
        const x = lerp(from.x, to.x, t);
        const y = lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * 200;
        const land = f >= t1 ? 1 + 0.35 * (1 - spr(f, t1, POP)) : 1;
        const size = 34 * (L.mode === 'tall' ? 1.15 : 1);
        return (
          <At key={i} x={x} y={y} z={45}>
            <div style={{position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: 99,
              background: PLAYERS[i].color, border: `4px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${land})`}} />
          </At>
        );
      })}
    </>
  );
};

/** The MOLE! stamp slams on b32; on b34 it floods the frame amber. */
const stampRect = (L: Layout) => {
  const t = L.tiles[MOLE];
  return {x: t.x, y: t.y + t.h * 0.05, w: t.w * 1.3, h: t.w * 0.46};
};

const Stamp: React.FC<{L: Layout; f: number}> = ({L, f}) => {
  if (f < b(32) - 7 || f >= b(36.6) + 30) return null;
  const r = stampRect(L);
  const slam = f < b(32) ? lerp(2.6, 1, easeIn(prog(f, b(32) - 7, b(32), (x) => x))) : 1 + 0.1 * (1 - spr(f, b(32), POP));
  const fs = b(34) - 8;
  const e = prog(f, fs, fs + 21, easeIn);
  const R = Math.hypot(L.W, L.H) * 1.1;
  const w = lerp(r.w, 2 * R, e), h = lerp(r.h, 2 * R, e);
  const x = lerp(r.x, L.W / 2, e), y = lerp(r.y, L.H / 2, e);
  const rot = lerp(-8, 0, e);
  const textS = 1 - e;
  return (
    <At x={x} y={y} z={60}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: lerp(r.h * 0.22, 0, e), background: C.accent,
        transform: `rotate(${rot}deg) scale(${slam})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: e < 0.1 ? `0 ${r.h * 0.15}px ${r.h * 0.4}px rgba(0,0,0,0.45)` : undefined}}>
        {textS > 0.02 ? (
          <span style={{fontFamily: FONT, fontWeight: 900, fontSize: r.h * 0.66 * textS + 0.01, color: C.ink, letterSpacing: '0.06em'}}>OUT</span>
        ) : null}
      </div>
    </At>
  );
};

const MoleWord: React.FC<{L: Layout; f: number}> = ({L, f}) => {
  if (f < b(32.5) || f >= b(34.4)) return null;
  const t = L.tiles[MOLE];
  const size = L.mode === 'tall' ? 40 : 32;
  return (
    <At x={t.x} y={t.y + t.h * 0.56 + size * 0.9} z={46}>
      <div style={{position: 'absolute', left: -200, width: 400, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, color: C.accent}}>
        <Rise f={f} start={b(32.5)} cfg={POP}>Sami was the Mole</Rise>
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

const Slogan: React.FC<{L: Layout; f: number}> = ({L, f}) => {
  if (f < b(34.3) || f >= b(41)) return null;
  const g1 = sloganGeom(L, 'innocent');
  const g2 = sloganGeom(L, 'lying');
  const line1Top = L.H / 2 - 1.02 * L.big;
  // violet flood out of the ink full stop
  const vf = b(36.6);
  const ve = prog(f, vf, vf + 21, easeIn);
  const R = Math.hypot(Math.max(g1.dotX, L.W - g1.dotX), Math.max(g1.dotY, L.H - g1.dotY)) * 1.06;
  const inkDot = spr(f, b(35.5), POP);
  const amberDot = spr(f, b(38.2), POP);
  // amber dot travels to the logo position on b40
  const move = prog(f, b(40.2), b(40.95), easeInOut);
  const L0 = L.logo * 1.35;
  const markDot = (16.64 / 160) * L0;
  const dotTarget = {x: L.W / 2 + (-1.92 / 160) * L0, y: L.H / 2 + (15.84 / 160) * L0};
  const push = 1 + 0.05 * prog(f, b(37), b(40), easeInOut);
  // the text sits in a container scaled by `push` around the centre; the dot lives outside it, so push it by hand
  const px = L.W / 2 + (g2.dotX - L.W / 2) * push, py = L.H / 2 + (g2.dotY - L.H / 2) * push;
  const ax = lerp(px, dotTarget.x, move), ay = lerp(py, dotTarget.y, move) - Math.sin(Math.PI * move) * 60;
  const ad = lerp(g2.dot * push, markDot, move);
  return (
    <>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${f > b(36.6) ? push : 1})`, zIndex: 70}}>
        {f < vf + 21 ? (
          <>
            <SloganLine L={L} f={f} text="Everyone's" top={line1Top} start={b(34.5)} end={b(36.6) + 14} color={C.ink} />
            <SloganLine L={L} f={f} text="innocent" top={g1.lineTop} start={b(35)} end={b(36.6) + 14} color={C.ink} x0={g1.x0} />
            {inkDot > 0 ? (
              <At x={g1.dotX} y={g1.dotY} z={72}>
                <div style={{position: 'absolute', left: -g1.dot / 2, top: -g1.dot / 2, width: g1.dot, height: g1.dot, borderRadius: 99,
                  background: ve > 0 ? C.bg : C.ink, transform: `scale(${ve > 0 ? lerp(1, (2 * R) / g1.dot, ve) : inkDot})`}} />
              </At>
            ) : null}
          </>
        ) : (
          <>
            <div style={{position: 'absolute', inset: 0, background: C.bg}} />
            <SloganLine L={L} f={f} text="Someone's" top={line1Top} start={b(37.2)} end={b(40)} color={C.text} />
            <SloganLine L={L} f={f} text="lying" top={g2.lineTop} start={b(37.7)} end={b(40.1)} color={C.text} x0={g2.x0} />
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

const Outro: React.FC<{L: Layout; f: number}> = ({L, f}) => {
  if (f < b(40.95)) return null;
  const L0 = L.logo * 1.35;
  const wmW = Math.min(L.W * 0.82, L.logo * (L.mode === 'tall' ? 2.9 : 3.1));
  const wmH = wmW * (301.6 / 1001.8);
  const tagSize = L.mode === 'tall' ? 52 : L.mode === 'wide' ? 44 : 40;
  const chipSize = L.mode === 'tall' ? 34 : 28;
  const ctaH = L.mode === 'tall' ? 96 : 80;
  const gaps = [L.logo * 0.06, L.logo * 0.16, tagSize * 0.7, chipSize * 1.2];
  const total = L.logo + gaps[0] + wmH + gaps[1] + tagSize * 1.2 + gaps[2] + chipSize * 1.9 + gaps[3] + ctaH;
  const top = (L.H - total) / 2;
  const markY = top + L.logo / 2;
  const wmY = top + L.logo + gaps[0] + wmH / 2;
  const tagY = wmY + wmH / 2 + gaps[1] + tagSize * 0.6;
  const chipY = tagY + tagSize * 0.6 + gaps[2] + chipSize * 0.95;
  const ctaY = chipY + chipSize * 0.95 + gaps[3] + ctaH / 2;

  const bubble = spr(f, b(41), POP);
  const stroke = prog(f, b(41.2), b(41.75), easeOut);
  const settle = prog(f, b(42), b(42.9), easeInOut);
  const size = lerp(L0, L.logo, settle);
  const mx = L.W / 2, my = lerp(L.H / 2, markY, settle);
  const reveal = prog(f, b(42.2), b(43.1), easeInOut);
  const chips = ['3–12 players', 'Phones are the controllers', 'Free'];
  const cta = spr(f, b(46), POP);
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
        <Words f={f} text="The secret-word party game for your TV" start={b(43)} step={4} />
      </div>
      <div style={{position: 'absolute', left: 0, width: L.W, top: chipY - chipSize * 0.95, height: chipSize * 1.9, display: 'flex', justifyContent: 'center',
        gap: chipSize * 0.5, zIndex: 83, flexWrap: 'nowrap'}}>
        {chips.map((c, i) => {
          const k = spr(f, b(44 + i * 0.5), POP);
          return (
            <div key={i} style={{transform: `scale(${k})`, fontFamily: FONT, fontWeight: 800, fontSize: chipSize, lineHeight: 1, color: C.text,
              border: `2px solid ${C.outline}`, background: C.surface, borderRadius: 999, padding: `${chipSize * 0.42}px ${chipSize * 0.8}px`, whiteSpace: 'nowrap'}}>{c}</div>
          );
        })}
      </div>
      <At x={L.W / 2} y={ctaY} z={84}>
        <div style={{position: 'absolute', left: 0, top: -ctaH / 2, height: ctaH, transform: `translateX(-50%) scale(${cta})`, borderRadius: 999,
          background: C.primary, color: C.ink, fontFamily: FONT, fontWeight: 900, fontSize: ctaH * 0.36, display: 'flex', alignItems: 'center',
          padding: `0 ${ctaH * 0.55}px`, gap: ctaH * 0.2, whiteSpace: 'nowrap', boxShadow: `0 0 ${ctaH * 0.6}px rgba(255,61,139,0.45)`}}>
          <svg width={ctaH * 0.3} height={ctaH * 0.33} viewBox="0 0 22 24"><path d="M2 2l18 10L2 22z" fill={C.ink} /></svg>
          Available on Google TV
        </div>
      </At>
    </>
  );
};

// ---------------------------------------------------------------- the film

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const L = layoutFor(width, height);
  const cam = camAt(L, f);
  const start = tvPt(L, START_LOCAL.x, START_LOCAL.y);
  const sp = toScreen(L, cam, start);
  const floodFrom: Rect = {x: sp.x, y: sp.y, w: START_LOCAL.w * start.s * cam.z, h: START_LOCAL.h * start.s * cam.z};
  const act1 = f < b(17);
  const spot = prog(f, b(12), b(14));
  const bg = f < b(34) ? C.bg : C.bg;
  return (
    <AbsoluteFill style={{background: `radial-gradient(130% 100% at 50% 0%, #22103A 0%, ${bg} 55%, ${C.bgDeep} 100%)`, overflow: 'hidden'}}>
      {act1 ? (
        <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0',
          transform: `translate(${L.W / 2}px, ${L.H / 2}px) scale(${cam.z}) translate(${-cam.x}px, ${-cam.y}px)`}}>
          <Tv L={L} f={f} />
          <JoinPhone L={L} f={f} />
          <MayaFlight L={L} f={f} />
        </div>
      ) : null}
      {act1 && spot > 0 ? (
        <div style={{position: 'absolute', inset: 0, zIndex: 25,
          background: `radial-gradient(circle at ${sp.x}px ${sp.y}px, rgba(5,3,10,0) ${floodFrom.w * 0.7}px, rgba(5,3,10,${0.72 * spot}) ${floodFrom.w * 1.6}px)`}} />
      ) : null}

      <Cards L={L} f={f} floodFrom={floodFrom} />
      <Clues L={L} f={f} />
      <Votes L={L} f={f} />
      <MoleWord L={L} f={f} />
      <Stamp L={L} f={f} />
      <Slogan L={L} f={f} />
      <Outro L={L} f={f} />

      {/* captions (screen space) */}
      <Caption L={L}>
        <Words f={f} text="Turn any TV into a *party.*" start={b(2.25)} step={b(0.2)} end={b(7.6)} />
      </Caption>
      <Caption L={L}>
        <Words f={f} text="Friends join from their phones. *No* *app.*" start={b(8)} step={b(0.16)} end={b(11.7)} />
      </Caption>
      <Caption L={L}>
        <Words f={f} text="Everyone gets a *secret* *word…*" start={b(12)} step={b(0.5)} end={b(15.75)} />
      </Caption>
      <Caption L={L}>
        <Words f={f} text="…but one is *different.*" start={b(19.25)} step={b(0.25)} end={b(21.4)} />
      </Caption>
      <Caption L={L}>
        <Words f={f} text="Give one-word *clues.*" start={b(21.6)} step={b(0.22)} end={b(25.6)} />
      </Caption>
      <Caption L={L}>
        <Words f={f} text="Spot who doesn’t *fit.*" start={b(25.8)} step={b(0.22)} end={b(28)} />
      </Caption>
      <Caption L={L}>
        <Words f={f} text="Vote them *out.*" start={b(28.2)} step={b(0.25)} end={b(31.8)} />
      </Caption>
      <Caption L={L}>
        <Words f={f} text="Caught the *Mole!*" start={b(32.2)} step={b(0.2)} end={b(33.8)} />
      </Caption>
    </AbsoluteFill>
  );
};
