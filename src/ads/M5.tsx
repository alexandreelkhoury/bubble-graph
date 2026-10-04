import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, PLAYERS} from '../brand';
import {At, Avatar, Bubble, FONT, PhoneFrame, Rise, WordFace} from '../parts';
import {b, clamp, easeIn, easeInOut, easeOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AD_H, AD_W, AdCaption, BgFlood, Hit, SAFE_CX} from './common';
import {
  FF1, flyStart, FLOOD, HomeScreen, JOINERS, Lobby, LookScreen, MOLE_I, Rect, rectLerp, ScreenFlood, SLOT, STAMP_L, T, TV_A, TV_C, tvAt, TvFrame,
  tvPt, VoteBoard, VT,
} from './m5-tv';

/**
 * MA_D_M5 "Nothing to do tonight?" (angle D, boredom). Motion only, one continuous take, ad beat 0 = the drop.
 * Hook (pre-settled on frame 0): a generic TV home screen stepping through the same posters on every beat,
 * a group chat below it: "what are we watching?" "idk" x3 -> Sami: "I've got a game." -> the focused poster floods
 * the TV magenta and contracts into the lobby QR (JQPU) -> the chat avatars fly into the lobby on the beats ->
 * Start -> the TV rises while the lobby tiles fly out and grow into five phones (the real word screen): PIZZA x4,
 * then Sami's PASTA (pointed out from outside: amber ring + glitch) -> the TV comes back as the vote board, the
 * phones drop into a row and give one-word clues -> four votes -> the TV stamps OUT, "Sami was the Mole" ->
 * the stamp floods amber and contracts into the "sorted." block -> backdrop floods into the end card.
 */
export const M5_BODY_FRAMES = Math.round(b(22.75));
const END = M5_BODY_FRAMES - 22;
const out = (f: number, at: number) => spr(f, at, {damping: 26, stiffness: 300});
const farthest = (x: number, y: number) => Math.hypot(Math.max(x, AD_W - x), Math.max(y, AD_H - y)) * 1.05;
const CAST = JOINERS.map((i) => PLAYERS[i]); // Maya, Karim, Lea, Joe, Sami (the Mole)

// ---------------------------------------------------------------- 1. the group chat
const PANEL = {x: SAFE_CX, y: 1272, w: 840, h: 600};
const ROW_Y = [1118, 1208, 1298, 1388, 1486];
const AV = 62;
const AX_L = PANEL.x - PANEL.w / 2 + 62;
const AX_R = PANEL.x + PANEL.w / 2 - 62;
const MSG = ['what are we watching?', 'idk', 'idk', 'idk', 'I’ve got a game.'];
const avPos = (i: number) => ({x: i === 4 ? AX_R : AX_L, y: ROW_Y[i]});
const depart = (i: number) => b(T.join[i]) - b(0.62);
const PANEL_C0 = depart(4) + 8;
/** The friend starts typing just after the previous message lands (the dots bubble is on screen at frame 0). */
const typeAt = (i: number) => (i === 0 ? b(T.chat[0]) - 30 : b(T.chat[i - 1]) + 5);

const typing = (f: number, i: number, me: boolean, y: number) => {
  const at = b(T.chat[i]);
  const k = spr(f, typeAt(i) + 2, POP) - out(f, at - 5);
  if (k <= 0.001 || f >= at + 4) return null;
  return (
    <div style={{position: 'absolute', top: y - 30, height: 60, width: 118, zIndex: 9, left: me ? AX_R - AV / 2 - 18 - 118 : AX_L + AV / 2 + 18,
      transformOrigin: me ? '100% 50%' : '0% 50%', transform: `scale(${k})`, background: me ? C.primary : C.elevated,
      borderRadius: me ? '30px 30px 10px 30px' : '30px 30px 30px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12}}>
      {[0, 1, 2].map((d) => (
        <div key={d} style={{width: 14, height: 14, borderRadius: 99, background: me ? C.ink : C.text2,
          transform: `translateY(${-7 * Math.max(0, Math.sin((f - d * 5) / 5))}px)`}} />
      ))}
    </div>
  );
};

const Chat: React.FC<{f: number}> = ({f}) => {
  const squash = prog(f, PANEL_C0, PANEL_C0 + 9, easeIn);
  const retract = prog(f, PANEL_C0 + 7, PANEL_C0 + 17, easeInOut);
  if (retract >= 1) return null;
  const pin = spr(f, -b(2.2), SNAPPY);
  return (
    <>
      <At x={PANEL.x} y={PANEL.y} z={8}>
        <div style={{position: 'absolute', left: -PANEL.w / 2, top: -PANEL.h / 2, width: PANEL.w, height: PANEL.h, borderRadius: 44,
          background: C.surface, boxShadow: `inset 0 0 0 2px ${C.outline}, 0 30px 70px rgba(0,0,0,0.4)`,
          transform: `scaleX(${1 - retract}) scaleY(${Math.max(0.012, (1 - squash) * pin)})`, overflow: 'hidden', fontFamily: FONT}}>
          <div style={{position: 'absolute', left: 40, top: 26, display: 'flex', alignItems: 'baseline', gap: 16}}>
            <span style={{fontSize: 36, fontWeight: 900, color: C.text}}><Rise f={f} start={-b(2)}>Saturday night</Rise></span>
            <span style={{fontSize: 24, fontWeight: 700, color: C.muted}}><Rise f={f} start={-b(1.9)}>5 people</Rise></span>
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 96, height: 2, background: C.outline}} />
        </div>
      </At>
      {CAST.map((p, i) => {
        if (squash > 0) return null;
        const at = b(T.chat[i]);
        const s = Math.max(0, spr(f, at, POP) - out(f, depart(i) - 7));
        if (s <= 0.001 && f >= at) return null;
        const me = i === 4;
        const {y} = avPos(i);
        return (
          <React.Fragment key={i}>
          {typing(f, i, me, y)}
          <div style={{position: 'absolute', top: y - 35, height: 70, zIndex: 9, left: me ? undefined : AX_L + AV / 2 + 18,
            right: me ? AD_W - (AX_R - AV / 2 - 18) : undefined, transformOrigin: me ? '100% 50%' : '0% 50%', transform: `scale(${s})`,
            background: me ? C.primary : C.elevated, color: me ? C.ink : C.text, borderRadius: me ? '35px 35px 10px 35px' : '35px 35px 35px 10px',
            padding: '0 30px', display: 'flex', alignItems: 'center', fontFamily: FONT, fontWeight: me ? 900 : 700, fontSize: 36, whiteSpace: 'nowrap'}}>
            {MSG[i]}
          </div>
          </React.Fragment>
        );
      })}
    </>
  );
};

/** Chat avatars: pop in with their message, then fly up into their lobby slot on the join beat. */
const Flyers: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map((p, i) => {
      const J = b(T.join[i]);
      if (f >= J) return null;
      const a = avPos(i);
      const pop = spr(f, typeAt(i), POP);
      if (pop <= 0.001) return null;
      const s = TV_A.w / 1040;
      const sl = SLOT(i);
      const to = tvPt(TV_A, sl.x, sl.y - 13);
      const t = prog(f, depart(i), J, easeInOut);
      const x = lerp(a.x, to.x, t), y = lerp(a.y, to.y, t) - Math.sin(Math.PI * t) * 170;
      const size = lerp(AV, 72 * s, t);
      const spin = (i % 2 ? 1 : -1) * 360 * easeInOut(t);
      const squash = f >= depart(i) - 6 && f < depart(i) ? 1 - 0.18 * Math.sin(Math.PI * ((f - depart(i) + 6) / 6)) : 1;
      return (
        <At key={i} x={x} y={y} z={t > 0 ? 30 : 9}>
          <Avatar shape={p.shape} color={p.color} size={size} initial={p.name[0]} cream={p.cream}
            style={{transform: `rotate(${spin}deg) scale(${pop * (2 - squash)}, ${pop * squash})`}} />
        </At>
      );
    })}
  </>
);

// ---------------------------------------------------------------- 2. the phones (lobby tile -> phone -> row)
const PW = 206, PH = 430;
const PH_B: Rect[] = [
  {x: SAFE_CX - 245, y: 900, w: PW, h: PH}, {x: SAFE_CX, y: 900, w: PW, h: PH}, {x: SAFE_CX + 245, y: 900, w: PW, h: PH},
  {x: SAFE_CX - 122, y: 1368, w: PW, h: PH}, {x: SAFE_CX + 122, y: 1368, w: PW, h: PH},
];
const MINI = (i: number): Rect => ({x: SAFE_CX + (i - 2) * 186, y: 1398, w: 150, h: 312});
const flipAt = (i: number) => b(T.flip[i]) - 6; // WordFace shows the face from flipAt + 6: on the beat

const phoneRect = (f: number, i: number) => {
  const fs = flyStart(i);
  const tv = tvAt(f);
  const s = tv.w / 1040;
  const sl = SLOT(i);
  const c = tvPt(tv, sl.x, sl.y);
  const tile: Rect = {x: c.x, y: c.y, w: 170 * s, h: 150 * s};
  const m = prog(f, fs, fs + b(0.8), easeInOut);
  const m2 = prog(f, b(T.tvC) + i * 2, b(T.tvC) + i * 2 + b(0.7), easeInOut);
  const r = rectLerp(rectLerp(tile, PH_B[i], m), MINI(i), m2);
  return {r: {...r, y: r.y - Math.sin(Math.PI * m) * 40}, m, s};
};

const Phones: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map((p, i) => {
      const fs = flyStart(i);
      if (f < fs) return null;
      const {r, m} = phoneRect(f, i);
      const mole = i === MOLE_I;
      const bezel = clamp((m - 0.35) / 0.5);
      const screen = mix(C.surface, C.bg, clamp(m * 1.6));
      const tileK = 1 - out(f, fs);
      const k = r.w / 170;
      // the Mole: identical screen; pointed out from outside (amber ring, a glitch on the frame, a wobble)
      const P = b(T.flip[4]);
      const ring = mole ? spr(f, P, POP) : 0;
      const glitch = mole && f >= P - 1 && f < P + 5;
      const wob = mole ? 7 * (spr(f, P, POP) - spr(f, P + 8, POP)) : 0;
      const gx = glitch ? (f % 2 ? 10 : -10) : 0;
      const pad = 14, rw = 7;
      return (
        <At key={i} x={r.x + gx} y={r.y} z={mole ? 22 : i >= 3 ? 19 : 20}>
          <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${wob}deg)`}}>
            {ring > 0.01 ? (
              <div style={{position: 'absolute', left: -r.w / 2 - pad - rw, top: -r.h / 2 - pad - rw, width: r.w + 2 * (pad + rw), height: r.h + 2 * (pad + rw),
                borderRadius: r.w * 0.14 + pad + rw, border: `${rw}px solid ${C.accent}`, boxSizing: 'border-box', transform: `scale(${0.85 + 0.15 * ring})`,
                boxShadow: glitch ? '-12px 0 0 rgba(0,255,255,0.55), 12px 0 0 rgba(255,0,90,0.55)' : `0 0 40px rgba(255,194,61,0.45)`}} />
            ) : null}
            <PhoneFrame w={r.w} h={r.h} bezel={bezel} screen={screen} island={m > 0.85}>
              {m > 0.3 ? (
                <WordFace f={f} w={r.w} h={r.h} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={p.word} flipAt={flipAt(i)}
                  contentIn={fs + b(0.45)} />
              ) : null}
            </PhoneFrame>
            {tileK > 0.01 ? (
              <>
                <At x={0} y={-13 * k}>
                  <Avatar shape={p.shape} color={p.color} size={72 * k * tileK} initial={p.name[0]} cream={p.cream} />
                </At>
                <div style={{position: 'absolute', left: -85 * k, width: 170 * k, top: 29 * k, textAlign: 'center', fontFamily: FONT, fontWeight: 800,
                  fontSize: 24 * k * tileK, color: C.text}}>{p.name}</div>
              </>
            ) : null}
          </div>
        </At>
      );
    })}
  </>
);

// ---------------------------------------------------------------- 3. clues + votes
const CLUES = ['Cheese', 'Slice', 'Oven', 'Crust', 'Boiled?'];
const Clues: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map((p, i) => {
      const s = spr(f, b(T.clue[i]), POP) - out(f, b(15.6) + i * 2);
      if (s <= 0.001) return null;
      const r = MINI(i);
      const hop = f > b(T.clue[i]) - 4 && f < b(T.clue[i]) + 12 ? 18 * Math.sin(Math.PI * ((f - b(T.clue[i]) + 4) / 16)) : 0;
      return (
        <At key={i} x={r.x} y={r.y - r.h / 2 - 26 - hop} z={26}>
          <Bubble text={CLUES[i]} s={s} size={36} tone={i === MOLE_I ? 'amber' : 'cream'} />
        </At>
      );
    })}
  </>
);

const Votes: React.FC<{f: number}> = ({f}) => (
  <>
    {T.vote.map((land, i) => {
      const t1 = b(land), t0 = t1 - b(0.6);
      if (f < t0 || f > b(T.pFlood) + FLOOD) return null;
      const from = MINI(i);
      const vt = VT(MOLE_I);
      const to = tvPt(TV_C, vt.x + (i - 1.5) * 36, vt.y - 100 + 6);
      const t = prog(f, t0, t1, easeInOut);
      const x = lerp(from.x, to.x, t), y = lerp(from.y - from.h / 2, to.y, t) - Math.sin(Math.PI * t) * 200;
      const k = f >= t1 ? 1 + 0.4 * (1 - spr(f, t1, POP)) : 1;
      return (
        <At key={i} x={x} y={y} z={35}>
          <div style={{position: 'absolute', left: -21, top: -21, width: 42, height: 42, borderRadius: 99, background: CAST[i].color,
            border: `4px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${k})`}} />
        </At>
      );
    })}
  </>
);

// ---------------------------------------------------------------- 4. OUT stamp -> amber flood -> "sorted." block
const SC = TV_C.w / 1040;
const SP = tvPt(TV_C, STAMP_L.x, STAMP_L.y);
const PF = b(T.pFlood);
const FF2 = Math.round(PF) + FLOOD;
const BLOCK = {x: SAFE_CX, y: 1010, w: 600, h: 200};

const Stamp: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.stamp);
  if (f < t0 - 7 || f >= FF2) return null;
  const w0 = STAMP_L.w * SC, h0 = STAMP_L.h * SC;
  const slam = f < t0 ? lerp(2.6, 1, easeIn(prog(f, t0 - 7, t0, (x) => x))) : 1 + 0.1 * (1 - spr(f, t0, POP));
  const e = prog(f, PF, FF2, easeIn);
  const R = farthest(SP.x, SP.y);
  const w = lerp(w0, 2 * R, e), h = lerp(h0, 2 * R, e);
  const textS = 1 - e;
  return (
    <At x={SP.x} y={SP.y} z={60}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: lerp(h0 * 0.22, R, e), background: C.accent,
        transform: `rotate(${lerp(-8, 0, e)}deg) scale(${slam})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        border: e < 0.6 ? `${h0 * 0.06 * (1 - e / 0.6)}px solid ${C.ink}` : undefined,
        boxShadow: e < 0.1 ? `0 ${h0 * 0.15}px ${h0 * 0.4}px rgba(0,0,0,0.45)` : undefined}}>
        {textS > 0.02 ? (
          <span style={{fontFamily: FONT, fontWeight: 900, fontSize: h0 * 0.7 * textS + 0.01, lineHeight: 1, color: C.ink, letterSpacing: '0.06em'}}>OUT</span>
        ) : null}
      </div>
    </At>
  );
};

const Payoff: React.FC<{f: number}> = ({f}) => {
  if (f < FF2) return null;
  const c = spr(f, FF2, {damping: 18, stiffness: 150});
  const R = farthest(BLOCK.x, BLOCK.y);
  const w = lerp(2 * R, BLOCK.w, c), h = lerp(2 * R, BLOCK.h, c);
  const bump = f >= b(T.bump) ? 1 + 0.06 * Math.sin(Math.PI * clamp((f - b(T.bump)) / 14)) : 1;
  return (
    <>
      <At x={BLOCK.x} y={BLOCK.y} z={70}>
        <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: lerp(R, 46, c), background: C.accent,
          transform: `rotate(${-3 * clamp(c)}deg) scale(${bump})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT, fontWeight: 900, fontSize: 150, lineHeight: 1, color: C.ink}}>
          <Rise f={f} start={b(T.sorted)} cfg={POP} pad={0.1}>sorted.</Rise>
        </div>
      </At>
      <div style={{position: 'absolute', left: 0, width: 2 * SAFE_CX, top: 745, height: 170, textAlign: 'center', fontFamily: FONT, fontWeight: 900,
        fontSize: 150, lineHeight: 1.1, color: C.text, zIndex: 71, letterSpacing: '-0.01em'}}>
        <Rise f={f} start={b(T.sat)} cfg={SNAPPY}>Saturday,</Rise>
      </div>
      {CAST.map((p, i) => {
        const at = b(T.crew + i * 0.25);
        const s = spr(f, at, POP);
        if (s <= 0.001) return null;
        const hopT = b(T.bump) + i * 2;
        const hop = f > hopT && f < hopT + 16 ? 30 * Math.sin(Math.PI * ((f - hopT) / 16)) : 0;
        return (
          <At key={i} x={SAFE_CX + (i - 2) * 150} y={1290 - hop} z={71}>
            <Avatar shape={p.shape} color={p.color} size={104} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${s})`}} />
          </At>
        );
      })}
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

export const M5Body: React.FC = () => {
  const f = useCurrentFrame();
  const [sx, sy] = shake(f);
  const scene = f < FF2;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {scene ? (
        <div style={{position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px)`}}>
          <TvFrame r={tvAt(f)}>
            {f < FF1 ? <HomeScreen f={f} /> : null}
            <ScreenFlood f={f} />
            {f < b(T.tvB + 0.8) ? <Lobby f={f} /> : null}
            <LookScreen f={f} />
            <VoteBoard f={f} />
          </TvFrame>
          <Chat f={f} />
          <Flyers f={f} />
          <Phones f={f} />
          <Clues f={f} />
          <Votes f={f} />
        </div>
      ) : null}
      <Stamp f={f} />
      <Payoff f={f} />

      <AdCaption f={f} text="Nothing to do *tonight?*" y={250} size={84} start={-b(1.2)} step={b(0.1)} end={b(2.3)} />
      <AdCaption f={f} text="Phones out. *Scan* the TV." y={250} size={76} start={b(2.6)} step={b(0.15)} end={b(4.9)} accent={C.primary} />
      <AdCaption f={f} text="*No app* on phones." y={250} size={82} start={b(5.1)} step={b(0.2)} end={b(6.95)} />
      <AdCaption f={f} text="Secret word: *PIZZA.*" y={596} size={74} start={b(7.75)} step={b(0.2)} end={b(10.05)} />
      <AdCaption f={f} text="Except *Sami.*" y={596} size={84} start={b(10.35)} step={b(0.25)} end={b(11.6)} />
      <AdCaption f={f} text="One clue *each.*" y={262} size={80} start={b(12.4)} step={b(0.2)} end={b(14.8)} />
      <AdCaption f={f} text="Who’s *off?*" y={262} size={84} start={b(14.95)} step={b(0.25)} end={b(16.35)} />
      <AdCaption f={f} text="Caught *him.*" y={262} size={88} start={b(16.6)} step={b(0.25)} end={b(18.1)} />
      <BgFlood f={f} start={END} x={BLOCK.x} y={BLOCK.y} />
    </div>
  );
};

// ---------------------------------------------------------------- sound
export const M5_HITS: Hit[] = [
  {at: 2, sfx: 'bass_hit', vol: 0.7, max: 50},
  ...[1, 2].map((k): Hit => ({at: b(k), sfx: 'tick', vol: 0.35, max: 18})),
  {at: b(T.chat[2]), sfx: 'pop_a', vol: 0.6},
  {at: b(T.chat[3]), sfx: 'pop_b', vol: 0.6},
  {at: b(T.chat[4]), sfx: 'pop_hard', vol: 0.55},
  {at: b(T.select), sfx: 'click', vol: 0.7},
  {at: b(T.flood) + 14, sfx: 'whoosh_fast', vol: 0.45},
  {at: FF1 + 14, sfx: 'pop_a', vol: 0.5},
  ...T.join.map((j): Hit => ({at: b(j), sfx: 'pop_b', vol: 0.65})),
  {at: b(T.start), sfx: 'pop_a', vol: 0.5},
  {at: b(T.press), sfx: 'click', vol: 0.8},
  {at: b(T.fly + 0.8), sfx: 'swoosh_short', vol: 0.4, max: 50},
  ...T.flip.slice(0, 4).map((t, i): Hit => ({at: b(t), sfx: i % 2 ? 'pop_b' : 'pop_a', vol: 0.55})),
  {at: b(T.flip[4]), sfx: 'wrong', vol: 0.45, max: 60},
  {at: b(T.flip[4]), sfx: 'bass_hit', vol: 0.65, max: 45},
  {at: b(T.tvC + 0.7), sfx: 'whoosh_fast', vol: 0.35},
  ...T.clue.slice(0, 4).map((t, i): Hit => ({at: b(t), sfx: i % 2 ? 'pop_b' : 'pop_a', vol: 0.65})),
  {at: b(T.clue[4]), sfx: 'pop_hard', vol: 0.6},
  ...T.vote.map((t): Hit => ({at: b(t), sfx: 'bass_hit', vol: 0.55, max: 35})),
  {at: b(T.stamp), sfx: 'stamp', vol: 1},
  {at: b(T.stamp), sfx: 'impact_drop', vol: 0.45, max: 110},
  {at: b(T.reveal), sfx: 'pop_hard', vol: 0.45},
  {at: PF + 14, sfx: 'whoosh_fast', vol: 0.4},
  {at: b(T.sat), sfx: 'swoosh_short', vol: 0.35, max: 50},
  {at: b(T.sorted), sfx: 'sparkle', vol: 0.65},
  ...[0, 1, 2, 3, 4].map((i): Hit => ({at: b(T.crew + i * 0.25), sfx: 'pop_b', vol: 0.4})),
  {at: b(T.bump), sfx: 'pop_hard', vol: 0.4},
  {at: END + 18, sfx: 'swoosh_short', vol: 0.35, max: 50},
];

