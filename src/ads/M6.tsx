import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, ROOM_CODE} from '../brand';
import {At, Bubble, FONT, PhoneFrame, Rise} from '../parts';
import {QR, QR_N} from '../qr';
import {b, clamp, easeIn, easeInOut, easeOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AD_H, AD_W, BgFlood, Hit, SAFE_CX} from './common';
import {ArCaption} from './m6-caption';
import {CIVIL, FAM, FamAvatar, MOLE_I, UNDER} from './m6-cast';
import {ArWordFace} from './m6-wordface';

/**
 * MA_F_M6 "Lebanese family game night" (AR, RTL), 22.75 beats (11 s) + the Arabic end card.
 * One take: the TV lobby is already filling on frame 0 (3/12) -> nine more relatives fly in on the
 * half-beats (12/12) -> «كلّنا هون، يلّا!» -> the TV screen opens into the frame while its 12 tiles grow
 * into 12 phones -> cards flip right-to-left: تبولة ×11, فتوش on Khalo's (identical screen; amber ring from
 * outside) -> phones shrink to tiles -> one-word clues -> votes -> the TV's «برّا» stamp + «خالو: الجاسوس»
 * -> payoff -> backdrop floods out of Khalo into the end card.
 * Word pair: lb-food-01 p001 (civilian تبولة / undercover فتوش). Strings: shared/i18n/ar.json.
 */
export const M6_BODY_FRAMES = Math.round(b(22.75));
const END = M6_BODY_FRAMES - 22;

// ---------------------------------------------------------------- beat grid
const JOIN = FAM.map((_, i) => (i < 3 ? -2 : 0.5 * (i - 2))); // 3 already in on frame 0, then b0.5 .. b4.5
const T = {
  glow: 4.75,
  press: 5.25,
  open: 5.5, // TV opens into the frame, tiles grow into phones
  flip0: 6.75, // cards flip right-to-left, an 8th apart
  ring: 8.75, // Khalo pointed out (from outside)
  shrink: 11, // phones -> tiles
  clues: [11.75, 12.25, 12.75, 13.25, 13.75, 14.25],
  bubOut: 15.5,
  vote0: 15.9,
  stamp: 18,
  role: 18.6,
  push: 18.25,
};
const flipAt = (i: number) => b(T.flip0) + i * b(0.125);

// ---------------------------------------------------------------- geometry (RTL: column 0 is the rightmost)
type R = {x: number; y: number; w: number; h: number};
const rl = (a: R, c: R, t: number): R => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});
const TV: R = {x: SAFE_CX, y: 800, w: 900, h: 506};
const TV_FULL: R = {x: AD_W / 2, y: AD_H / 2, w: AD_W, h: AD_H};
const TVL = TV.x - TV.w / 2, TVT = TV.y - TV.h / 2;
const rc = (i: number) => ({r: Math.floor(i / 4), c: i % 4});
const LOBBY_TILE = (i: number): R => {
  const {r, c} = rc(i);
  return {x: TVL + 549 - c * 150, y: TVT + 152 + r * 136, w: 138, h: 124};
};
const PHONE = (i: number): R => {
  const {r, c} = rc(i);
  return {x: SAFE_CX + (1.5 - c) * 225, y: 642 + r * 395, w: 168, h: 350};
};
const TILE = (i: number): R => ({...PHONE(i), w: 192, h: 204});
const KHALO = PHONE(MOLE_I);

const tvOpen = (f: number) => prog(f, b(T.open), b(T.open + 0.95), easeInOut);
const m1At = (i: number) => b(T.open) + 4 + i * 0.75; // near-unison: the lobby grid scales up into the phone grid without overlaps
const m2At = (i: number) => b(T.shrink) + i * 1.5;

/** Where cell i is: lobby tile -> phone -> table tile. */
const cell = (f: number, i: number) => {
  const m1 = prog(f, m1At(i), m1At(i) + b(0.85), easeInOut);
  const m2 = prog(f, m2At(i), m2At(i) + b(0.7), easeInOut);
  const r = rl(rl(LOBBY_TILE(i), PHONE(i), m1), TILE(i), m2);
  return {r, m1, m2};
};

/** Camera (one move): a slow push towards Khalo once the stamp lands. */
const cam = (f: number) => {
  const p = prog(f, b(T.push), M6_BODY_FRAMES, easeInOut);
  const z = 1 + 0.08 * p;
  const cx = lerp(SAFE_CX, KHALO.x, 0.3 * p), cy = lerp(960, KHALO.y, 0.3 * p);
  return {z, cx, cy, map: (x: number, y: number) => ({x: SAFE_CX + (x - cx) * z, y: 960 + (y - cy) * z})};
};

// ---------------------------------------------------------------- the TV (lobby, RTL: QR column on the right)
const BG_GRAD = `radial-gradient(120% 70% at 50% 0%, #22103A 0%, ${C.bg} 55%, ${C.bgDeep} 100%)`;

const Tv: React.FC<{f: number}> = ({f}) => {
  const e = tvOpen(f);
  if (e >= 1) return null;
  const r = rl(TV, TV_FULL, e);
  const bez = 12 * (1 - e);
  const rad = 22 * (1 - e);
  const gone = 1 - spr(f, b(T.open) - 2, SNAPPY); // lobby chrome pops away as the screen opens
  const joined = JOIN.filter((t) => f >= b(t)).length;
  const glow = prog(f, b(T.glow), b(T.press));
  const press = f >= b(T.press) ? 0.09 * Math.sin(Math.PI * clamp((f - b(T.press)) / 10)) : 0;
  const L = (x: number) => x; // TV-local px (the TV never scales: only its box opens)
  return (
    <At x={r.x} y={r.y} z={2}>
      {e < 0.4 ? (
        <div style={{position: 'absolute', left: -110, top: TV.h / 2 + bez, width: 220, height: 24 * (1 - e / 0.4), background: '#05030A', borderRadius: '0 0 14px 14px'}} />
      ) : null}
      <div style={{position: 'absolute', left: -r.w / 2 - bez, top: -r.h / 2 - bez, width: r.w + 2 * bez, height: r.h + 2 * bez, borderRadius: rad + bez,
        background: '#05030A', boxShadow: e < 0.5 ? `0 30px 80px rgba(0,0,0,${0.55 * (1 - 2 * e)})` : undefined}}>
        <div style={{position: 'absolute', left: bez, top: bez, width: r.w, height: r.h, borderRadius: rad, overflow: 'hidden', background: BG_GRAD}}>
          {gone > 0.01 ? (
            <div style={{position: 'absolute', left: 0, top: 0, width: TV.w, height: TV.h, fontFamily: FONT, direction: 'rtl',
              transform: `translate(${(r.w - TV.w) / 2}px, ${(r.h - TV.h) / 2}px)`}}>
              {/* right column: scan + QR + code + start */}
              <div style={{position: 'absolute', right: L(30), top: L(22), width: L(220), textAlign: 'center', fontSize: 21, fontWeight: 700, color: C.text2,
                transform: `scale(${gone})`}}>امسحوا الكود وفوتوا</div>
              <div style={{position: 'absolute', right: L(45), top: L(62), width: L(190), height: L(190), borderRadius: 22, background: C.text, transform: `scale(${gone})`}}>
                <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} width="100%" height="100%">
                  {QR.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${y}-${x}`} x={x} y={y} width={1.02} height={1.02} fill={C.ink} /> : null)))}
                </svg>
              </div>
              <div style={{position: 'absolute', right: L(30), top: L(262), width: L(220), display: 'flex', justifyContent: 'space-between', direction: 'ltr',
                fontSize: 62, fontWeight: 900, color: C.accent, lineHeight: 1, transform: `scale(${gone})`}}>
                {ROOM_CODE.split('').map((ch, k) => <span key={k}>{ch}</span>)}
              </div>
              <div style={{position: 'absolute', right: L(30), top: L(398), width: L(220), height: L(66), borderRadius: 999, background: C.primary,
                transform: `scale(${gone * (1 + 0.06 * glow - press)})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.ink, fontSize: 25, fontWeight: 900, boxShadow: glow > 0 ? `0 0 ${40 * glow}px rgba(255,61,139,${0.7 * glow})` : undefined}}>
                كلّنا هون، يلّا!
              </div>
              {/* left: header + 4 x 3 grid (tiles are drawn by <Cells/> on top) */}
              <div style={{position: 'absolute', right: L(276), top: L(30), fontSize: 26, fontWeight: 800, color: C.text, transform: `scale(${gone})`, transformOrigin: '100% 50%'}}>
                اللاعبين {joined}/12
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- the 12 cells
const Cells: React.FC<{f: number}> = ({f}) => (
  <>
    {FAM.map((p, i) => {
      const {r, m1, m2} = cell(f, i);
      const land = b(JOIN[i]);
      const mole = i === MOLE_I;
      // empty slot before this relative lands (dashed, inside the TV)
      if (f < land) {
        const slot = 1 - spr(f, b(T.open) - 2, SNAPPY);
        return (
          <At key={i} x={r.x} y={r.y} z={4}>
            <div style={{position: 'absolute', left: -r.w / 2, top: -r.h / 2, width: r.w, height: r.h, borderRadius: 20, border: `2.5px dashed ${C.outline}`,
              boxSizing: 'border-box', transform: `scale(${slot})`}} />
          </At>
        );
      }
      const pop = spr(f, land, POP);
      const screen = mix(mix(C.surface, C.bg, m1), C.surface, m2);
      const bezel = Math.min(prog(f, m1At(i) + 4, m1At(i) + b(0.6)), 1 - prog(f, m2At(i), m2At(i) + b(0.35)));
      const lift = mole ? 22 * spr(f, b(T.ring), POP) * (1 - m2) : 0;
      const dim = !mole ? 1 - 0.5 * prog(f, b(T.stamp), b(T.stamp) + 12) : 1;
      // lobby face (small) -> gone during the morph -> table face (big)
      const lobbyFace = (1 - spr(f, m1At(i) + 4, SNAPPY)) * (r.w / 138);
      const tableFace = spr(f, m2At(i) + b(0.35), POP);
      return (
        <At key={i} x={r.x} y={r.y - lift} z={mole ? 12 : 10} style={{opacity: dim}}>
          <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${pop})`}}>
            <PhoneFrame w={r.w} h={r.h} bezel={bezel} screen={screen} island={m1 > 0.8 && m2 < 0.2}>
              {m1 > 0.5 && m2 < 0.5 ? (
                <ArWordFace f={f} w={r.w} h={r.h} p={p} word={mole ? UNDER : CIVIL} flipAt={flipAt(i)} contentIn={m1At(i) + b(0.55)} out={m2At(i) - 2} />
              ) : null}
            </PhoneFrame>
            {lobbyFace > 0.01 && m1 < 0.6 ? (
              <>
                <At x={0} y={-14}><FamAvatar p={p} size={60} style={{transform: `scale(${lobbyFace * spr(f, land + 2, POP)})`}} /></At>
                <div style={{position: 'absolute', left: -70, width: 140, top: 26, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 21, lineHeight: 1.3,
                  color: C.text, direction: 'rtl', transform: `scale(${lobbyFace})`}}>{p.name}</div>
              </>
            ) : null}
            {m2 > 0.3 ? (
              <>
                <At x={0} y={-24}><FamAvatar p={p} size={98} style={{transform: `scale(${tableFace})`}} /></At>
                <div style={{position: 'absolute', left: -100, width: 200, top: 34, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 38, lineHeight: 1.3,
                  color: C.text, direction: 'rtl'}}>
                  <Rise f={f} start={m2At(i) + b(0.4)} pad={0.42}>{p.name}</Rise>
                </div>
              </>
            ) : null}
          </div>
        </At>
      );
    })}
  </>
);

/** Relatives joining: each avatar flies up from the bottom edge (their phones) into its slot. */
const Flights: React.FC<{f: number}> = ({f}) => (
  <>
    {FAM.map((p, i) => {
      if (i < 3) return null;
      const t1 = b(JOIN[i]), t0 = t1 - b(0.6);
      if (f < t0 || f >= t1) return null;
      const to = LOBBY_TILE(i);
      const t = prog(f, t0, t1, easeOut);
      const x = lerp(to.x + (i % 2 ? 60 : -60), to.x, t);
      const y = lerp(AD_H + 90, to.y - 14, t);
      return (
        <At key={i} x={x} y={y} z={30}>
          <FamAvatar p={p} size={lerp(130, 60, t)} style={{transform: `rotate(${(1 - t) * (i % 2 ? 14 : -14)}deg)`, boxShadow: '0 14px 30px rgba(0,0,0,0.4)'}} />
        </At>
      );
    })}
  </>
);

/** Big amber head-count under the TV: an odometer that rolls one notch per landing, punches at 12. */
const Counter: React.FC<{f: number}> = ({f}) => {
  const out = b(T.open) - 4;
  const gone = spr(f, out, SNAPPY);
  if (gone > 0.99) return null;
  const roll = JOIN.slice(3).reduce((acc, t) => acc + spr(f, b(t), SNAPPY), 0); // 0..9
  const full = f >= b(JOIN[11]) ? 1 + 0.22 * (1 - spr(f, b(JOIN[11]), POP)) : 1;
  const H = 250;
  return (
    <At x={SAFE_CX} y={1300} z={8}>
      <div style={{position: 'absolute', left: -450, width: 900, top: -150, height: 300, fontFamily: FONT, fontWeight: 900, lineHeight: 1, direction: 'ltr',
        transform: `scale(${full * (1 - gone)})`, transformOrigin: '50% 60%'}}>
        <div style={{position: 'absolute', right: 470, top: 10, height: H, width: 330, overflow: 'hidden'}}>
          {Array.from({length: 10}, (_, k) => (
            <div key={k} style={{position: 'absolute', right: 0, top: (k - roll) * H, height: H, lineHeight: `${H}px`, fontSize: 240, color: C.accent}}>{k + 3}</div>
          ))}
        </div>
        <div style={{position: 'absolute', left: 445, top: 112, fontSize: 128, color: C.text}}>/12</div>
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- Khalo's amber ring (emphasis from outside the phone)
const rrect = (w: number, h: number, rad: number) => ({position: 'absolute' as const, left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: rad});

const Ring: React.FC<{f: number}> = ({f}) => {
  if (f < b(T.ring) - 2) return null;
  const {r, m2} = cell(f, MOLE_I);
  const lift = 22 * spr(f, b(T.ring), POP) * (1 - m2);
  const k = spr(f, b(T.ring), POP);
  const gap = lerp(16, 12, m2);
  const pulse = f >= b(T.stamp) ? 1 + 0.06 * (1 - spr(f, b(T.stamp), POP)) : 1;
  const bez = Math.max(3, r.w * 0.035) * (1 - m2);
  const w = r.w + 2 * (bez + gap), h = r.h + 2 * (bez + gap);
  return (
    <At x={r.x} y={r.y - lift} z={11}>
      <div style={{...rrect(w, h, r.w * 0.14 + bez + gap), border: `7px solid ${C.accent}`, boxSizing: 'border-box',
        transform: `scale(${(1.25 - 0.25 * k) * pulse})`, opacity: clamp(k * 1.4), boxShadow: `0 0 50px rgba(255,194,61,0.45)`}} />
    </At>
  );
};

// ---------------------------------------------------------------- clues, votes, verdict
const CLUES: Array<{i: number; t: string}> = [
  {i: 0, t: 'بقدونس'},
  {i: 3, t: 'برغل'},
  {i: 6, t: 'حامض'},
  {i: 9, t: 'بندورة'},
  {i: 11, t: 'نعنع'},
  {i: MOLE_I, t: 'خبز؟'},
];

const Clues: React.FC<{f: number}> = ({f}) => (
  <>
    {CLUES.map(({i, t}, k) => {
      const at = b(T.clues[k]);
      const s = spr(f, at, POP) - spr(f, b(T.bubOut) + k * 2, {damping: 26, stiffness: 300});
      if (s <= 0.001) return null;
      const r = TILE(i);
      return (
        <At key={k} x={r.x} y={r.y - r.h / 2 - 20} z={20} style={{direction: 'rtl'}}>
          <Bubble text={t} s={s} size={42} tone={i === MOLE_I ? 'amber' : 'cream'} />
        </At>
      );
    })}
  </>
);

const VOTERS = FAM.map((_, i) => i).filter((i) => i !== MOLE_I);
const Votes: React.FC<{f: number}> = ({f}) => {
  const gone = spr(f, b(T.stamp) + 1, {damping: 24, stiffness: 300});
  if (gone > 0.98) return null;
  return (
    <>
      {VOTERS.map((vi, k) => {
        const t1 = b(T.vote0) + k * b(0.18), t0 = t1 - b(0.55);
        if (f < t0) return null;
        const from = TILE(vi);
        // two rows of ballots stacking on top of Khalo's tile
        const row = k < 6 ? 0 : 1, col = k < 6 ? k - 2.5 : k - 6 - 2;
        const to = {x: KHALO.x - col * 46, y: KHALO.y - TILE(MOLE_I).h / 2 - 30 - row * 44};
        const t = prog(f, t0, t1, easeInOut);
        const x = lerp(from.x, to.x, t), y = lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * 160;
        const s = (f >= t1 ? 1 + 0.4 * (1 - spr(f, t1, POP)) : 1) * (1 - gone);
        return (
          <At key={vi} x={x} y={y} z={25}>
            <div style={{position: 'absolute', left: -21, top: -21, width: 42, height: 42, borderRadius: 99, background: FAM[vi].color,
              border: `4px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${s})`, boxShadow: '0 6px 14px rgba(0,0,0,0.35)'}} />
          </At>
        );
      })}
    </>
  );
};

/** The TV's verdict: «برّا» stamp (elim.eliminated / lobby.kick), then the role line «خالو: الجاسوس» (elim.wasUndercover). */
const Verdict: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.stamp);
  if (f < t0 - 7) return null;
  const slam = f < t0 ? lerp(2.6, 1, easeIn(prog(f, t0 - 7, t0, (x) => x))) : 1 + 0.1 * (1 - spr(f, t0, POP));
  return (
    <>
      <At x={KHALO.x} y={KHALO.y + 6} z={30}>
        <div style={{position: 'absolute', left: -160, top: -66, width: 320, height: 132, borderRadius: 26, background: C.accent, border: `6px solid ${C.ink}`, boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 92, lineHeight: 1, color: C.ink,
          boxShadow: '0 18px 40px rgba(0,0,0,0.45)', transform: `rotate(-8deg) scale(${slam})`, direction: 'rtl', paddingBottom: 10}}>
          برّا
        </div>
      </At>
      <At x={KHALO.x} y={KHALO.y + 160} z={30}>
        <div style={{position: 'absolute', left: -300, width: 600, top: -40, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 54, lineHeight: 1.3,
          color: C.accent, WebkitTextStroke: `5px ${C.bg}`, paintOrder: 'stroke fill', direction: 'rtl'}}>
          <Rise f={f} start={b(T.role)} cfg={POP} pad={0.42}>خالو: الجاسوس</Rise>
        </div>
      </At>
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

export const M6Body: React.FC = () => {
  const f = useCurrentFrame();
  const {z, cx, cy, map} = cam(f);
  const [sx, sy] = shake(f);
  const flood = map(KHALO.x, KHALO.y);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0',
        transform: `translate(${sx}px, ${sy}px) translate(${SAFE_CX}px, 960px) scale(${z}) translate(${-cx}px, ${-cy}px)`}}>
        <Tv f={f} />
        <Counter f={f} />
        <Cells f={f} />
        <Ring f={f} />
        <Flights f={f} />
        <Clues f={f} />
        <Votes f={f} />
        <Verdict f={f} />
      </div>

      {/* hook: composed on frame 0 (thumbnail) */}
      <ArCaption f={f} text="سهرة العيلة؟" y={236} start={-b(1)} end={b(1.6)} size={96} />
      <ArCaption f={f} text="*12* واحد؟" y={350} start={-b(1) + 4} end={b(1.7)} size={96} />
      <ArCaption f={f} text="*أحسن!*" y={236} start={b(1.9)} end={b(5.35)} size={104} />
      <ArCaption f={f} text="كلّنا منلعب." y={350} start={b(2.25)} end={b(5.45)} size={88} />
      <ArCaption f={f} text={`كلّن معن *${CIVIL}*…`} y={300} start={b(7)} end={b(8.5)} size={86} />
      <ArCaption f={f} text="إلّا *خالو.*" y={300} start={b(T.ring)} step={b(0.2)} end={b(9.75)} size={100} />
      <ArCaption f={f} text="وما *بيعرف.*" y={300} start={b(9.9)} step={b(0.2)} end={b(10.9)} size={100} />
      <ArCaption f={f} text="كل واحد *كلمة.*" y={300} start={b(11.25)} end={b(14.1)} size={86} />
      <ArCaption f={f} text="خبز؟ *بالتبولة؟!*" y={300} start={b(14.45)} step={b(0.2)} end={b(15.6)} size={92} accent={C.primary} />
      <ArCaption f={f} text="مين *مش* *منّا؟*" y={300} start={b(15.8)} end={b(17.8)} size={92} />
      <ArCaption f={f} text="طلع *خالو!*" y={300} start={b(18.3)} step={b(0.2)} end={b(19.6)} size={110} />
      <ArCaption f={f} text="سهرة العيلة" y={246} start={b(19.85)} size={96} />
      <ArCaption f={f} text="*رح* *تولّع.*" y={360} start={b(20.25)} step={b(0.25)} size={110} accent={C.primary} />

      <BgFlood f={f} start={END} x={flood.x} y={flood.y} />
    </div>
  );
};

// ---------------------------------------------------------------- sound
export const M6_HITS: Hit[] = [
  ...JOIN.slice(3).map((t, k): Hit => ({at: b(t), sfx: k % 2 ? 'pop_b' : 'pop_a', vol: 0.6})),
  ...JOIN.slice(3).map((t): Hit => ({at: b(t) - b(0.45), sfx: 'swoosh_short', vol: 0.18, max: 24})),
  {at: b(JOIN[11]), sfx: 'pop_hard', vol: 0.6},
  {at: b(JOIN[11]) + 4, sfx: 'sparkle', vol: 0.45},
  {at: b(T.press), sfx: 'click', vol: 0.7},
  {at: b(T.open) + 16, sfx: 'whoosh_fast', vol: 0.45},
  ...FAM.map((_, i): Hit => ({at: flipAt(i), sfx: 'tick', vol: i === MOLE_I ? 0.5 : 0.28, max: 18})),
  {at: b(T.ring), sfx: 'bass_hit', vol: 0.7, max: 40},
  {at: b(T.ring) + 2, sfx: 'wrong', vol: 0.4, max: 50},
  {at: b(9.9), sfx: 'click', vol: 0.45},
  {at: b(T.shrink) + 8, sfx: 'swoosh_short', vol: 0.4},
  ...T.clues.slice(0, 5).map((t, k): Hit => ({at: b(t), sfx: k % 2 ? 'pop_b' : 'pop_a', vol: 0.65})),
  {at: b(T.clues[5]), sfx: 'pop_hard', vol: 0.6},
  {at: b(T.clues[5]) + 6, sfx: 'wrong', vol: 0.45, max: 50},
  ...VOTERS.map((_, k): Hit => ({at: b(T.vote0) + k * b(0.18), sfx: 'tick', vol: 0.35, max: 16})),
  {at: b(16.2), sfx: 'drumroll', vol: 0.3, max: Math.round(b(T.stamp - 16.2))},
  {at: b(T.stamp), sfx: 'stamp', vol: 1},
  {at: b(T.stamp), sfx: 'impact_drop', vol: 0.5, max: 120},
  {at: b(T.role), sfx: 'pop_hard', vol: 0.5},
  {at: b(20.25), sfx: 'sparkle', vol: 0.5},
  {at: END + 10, sfx: 'whoosh_fast', vol: 0.35},
];
