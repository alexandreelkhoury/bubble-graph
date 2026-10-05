import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, ROOM_CODE} from '../brand';
import {StageBg} from '../bg';
import {At, Bubble, FONT, PhoneFrame} from '../parts';
import {QR, QR_N} from '../qr';
import {b, clamp, easeIn, easeInOut, easeOut, lerp, POP, prog, SNAPPY, spr} from '../time';
import {AD_H, AD_W, BgFlood, Hit, SAFE_CX, VoLine} from './common';
import {ArCaption} from './m6-caption';
import {CIVIL, FAM, FamAvatar, MOLE_I, UNDER} from './m6-cast';
import {ArVoteFace, ArWordFace} from './m6-wordface';

/**
 * MA-F-M6 "Lebanese family game night" (AR, RTL), v2: 36.75 beats (17.8 s) + the Arabic end card. No VO.
 * Frame 0 = the TV lobby, 8/12 relatives in, a giant 8/12 counter under it -> the last four fly in, one per beat
 * (12/12) -> «كلّنا هون، يلّا!» -> the TV opens into the frame and six of the tiles grow into six big phones (the
 * other six step back) -> cards flip right-to-left: تبولة ×5, فتوش on Khalo's (identical screen; amber ring from
 * outside) -> cards hide -> four one-word clues, 0.6 s apart -> votes on the phones -> the frame closes back into
 * the TV, Khalo's phone becomes his tile -> «برّا» stamp (the one magenta flash) + «خالو: الجاسوس» -> payoff ->
 * the backdrop floods out of Khalo into the end card.
 * Word pair: lb-food-01 p001 (civilian تبولة / undercover فتوش). Strings: shared/i18n/ar.json.
 * Every caption holds ≥ holdFrames × 1.15 (Arabic reads slower); lines over 3 words count as key lines.
 */
export const M6_BODY_FRAMES = Math.round(b(36.75));
export const M6_VO: VoLine[] = []; // a Lebanese-dialect voice isn't available: no VO (DECISIONS #11)
const END = M6_BODY_FRAMES - 22;

// ---------------------------------------------------------------- beat grid
const JOINERS = [8, 9, 10, 11];
const JOIN_AT = [1, 2, 3, 4]; // one per beat (the first flight leaves after frame 0: a clean thumbnail)
const joinBeat = (i: number) => (JOINERS.includes(i) ? JOIN_AT[JOINERS.indexOf(i)] : -3);
const T = {
  glow: 4.4,
  press: 5.0,
  open: 5.15, // the TV opens into the frame, six tiles grow into phones
  flip0: 7.0, // cards flip right-to-left, an 8th apart
  ring: 11.75, // Khalo pointed out (from outside his phone)
  hide: 16.0, // words hide (cards flip back)
  clues: [17.0, 18.25, 19.5, 20.75], // 0.6 s apart
  bubOut: 25.2,
  vote0: 25.9, // one vote every half beat
  close: 29.0, // the frame closes back into the TV
  crowd: 29.5,
  stamp: 30.0,
  role: 30.6,
  push: 30.0,
};

// The six on the phones (RTL slots: 0 top-right … 5 bottom-left). Khalo sits bottom-centre.
const SEL = [0, 1, 2, 3, MOLE_I, 6];
const slotOf = (i: number) => SEL.indexOf(i);
const OTHERS = FAM.map((_, i) => i).filter((i) => !SEL.includes(i));
const flipAt = (s: number) => b(T.flip0) + s * b(0.125);

// ---------------------------------------------------------------- geometry
type R = {x: number; y: number; w: number; h: number};
const rl = (a: R, c: R, t: number): R => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});
const TV: R = {x: SAFE_CX, y: 800, w: 900, h: 506};
const TV_FULL: R = {x: AD_W / 2, y: AD_H / 2, w: AD_W, h: AD_H};
const TVL = TV.x - TV.w / 2, TVT = TV.y - TV.h / 2;
/** Lobby grid inside the TV, 4 x 3, column 0 on the right (RTL). */
const LOBBY = (i: number): R => ({x: TVL + 556 - (i % 4) * 152, y: TVT + 152 + Math.floor(i / 4) * 128, w: 142, h: 116});
const PHONE = (s: number): R => ({x: SAFE_CX + (1 - (s % 3)) * 292, y: 822 + Math.floor(s / 3) * 538, w: 252, h: 500});
const VERDICT: R = {x: TV.x, y: TV.y + 4, w: 330, h: 380};
const KHALO = PHONE(slotOf(MOLE_I));

const openE = (f: number) => prog(f, b(T.open), b(T.open + 0.95), easeInOut);
const closeE = (f: number) => prog(f, b(T.close), b(T.close + 0.85), easeInOut);
const m1At = (s: number) => b(T.open) + 4 + s; // near-unison: tiles grow into the phone grid
const contentAt = (s: number) => m1At(s) + b(0.3); // card backs land while the phone is still growing: no empty screens

/** Where selected cell i is: lobby tile -> phone -> (Khalo only) the TV's verdict tile. */
const cell = (f: number, i: number) => {
  const s = slotOf(i);
  const m1 = prog(f, m1At(s), m1At(s) + b(0.85), easeInOut);
  const m3 = i === MOLE_I ? closeE(f) : 0;
  return {r: rl(rl(LOBBY(i), PHONE(s), m1), VERDICT, m3), m1, m3, s};
};

/** Camera: one slow 6 % push into the TV once the stamp lands. */
const cam = (f: number) => {
  const z = 1 + 0.06 * prog(f, b(T.push), M6_BODY_FRAMES, easeInOut);
  const cx = SAFE_CX, cy = 900;
  return {z, cx, cy, map: (x: number, y: number) => ({x: SAFE_CX + (x - cx) * z, y: 900 + (y - cy) * z})};
};

// ---------------------------------------------------------------- the TV (lobby, RTL: QR column on the right)
const Tv: React.FC<{f: number}> = ({f}) => {
  const eo = openE(f), ec = closeE(f);
  const opening = f < b(T.close);
  if (opening && eo >= 1) return null; // fully open: the stage background is the TV screen
  const e = opening ? eo : 1 - ec;
  const r = rl(TV, TV_FULL, e);
  const bez = 13 * (1 - e);
  const rad = 24 * (1 - e);
  const chrome = 1 - spr(f, b(T.open) - 2, SNAPPY); // lobby chrome pops away as the screen opens
  const joined = 8 + JOIN_AT.filter((t) => f >= b(t)).length;
  const glow = prog(f, b(T.glow), b(T.press));
  const press = f >= b(T.press) ? 0.09 * Math.sin(Math.PI * clamp((f - b(T.press)) / 10)) : 0;
  return (
    <At x={r.x} y={r.y} z={2}>
      {e < 0.4 ? (
        <div style={{position: 'absolute', left: -120, top: TV.h / 2 + bez, width: 240, height: 26 * (1 - e / 0.4), background: '#140A26', borderRadius: '0 0 14px 14px'}} />
      ) : null}
      <div style={{position: 'absolute', left: -r.w / 2 - bez, top: -r.h / 2 - bez, width: r.w + 2 * bez, height: r.h + 2 * bez, borderRadius: rad + bez,
        background: '#140A26', boxShadow: e < 0.6 ? `0 30px 80px rgba(10,4,20,${0.5 * (1 - e)}), 0 0 160px rgba(255,79,154,${0.3 * (1 - e)})` : undefined}}>
        <div style={{position: 'absolute', left: bez, top: bez, width: r.w, height: r.h, borderRadius: rad, overflow: 'hidden'}}>
          <StageBg />
          {/* the TV's own lit screen: a brighter glow that thins out as the screen becomes the whole frame */}
          <div style={{position: 'absolute', inset: 0, opacity: 1 - e, background: 'radial-gradient(110% 90% at 35% 0%, #6A36AE 0%, rgba(74,40,130,0.55) 55%, rgba(43,22,80,0) 100%)'}} />
          {opening && chrome > 0.01 ? (
            <div style={{position: 'absolute', left: (r.w - TV.w) / 2, top: (r.h - TV.h) / 2, width: TV.w, height: TV.h, fontFamily: FONT, direction: 'rtl'}}>
              <div style={{position: 'absolute', right: 26, top: 22, width: 230, textAlign: 'center', fontSize: 22, fontWeight: 700, lineHeight: 1.4, color: C.text2,
                transform: `scale(${chrome})`}}>امسحوا الكود وفوتوا</div>
              <div style={{position: 'absolute', right: 51, top: 66, width: 180, height: 180, borderRadius: 20, background: C.text, transform: `scale(${chrome})`}}>
                <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} width="100%" height="100%">
                  {QR.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${y}-${x}`} x={x} y={y} width={1.02} height={1.02} fill={C.ink} /> : null)))}
                </svg>
              </div>
              <div style={{position: 'absolute', right: 36, top: 262, width: 210, display: 'flex', justifyContent: 'space-between', direction: 'ltr',
                fontSize: 60, fontWeight: 900, color: C.accent, lineHeight: 1.1, transform: `scale(${chrome})`}}>
                {ROOM_CODE.split('').map((ch, k) => <span key={k}>{ch}</span>)}
              </div>
              <div style={{position: 'absolute', right: 26, top: 392, width: 230, height: 70, borderRadius: 999, background: C.primary,
                transform: `scale(${chrome * (1 + 0.06 * glow - press)})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.ink, fontSize: 26, fontWeight: 900, lineHeight: 1.3, boxShadow: glow > 0 ? `0 0 ${44 * glow}px rgba(255,79,154,${0.75 * glow})` : undefined}}>
                كلّنا هون، يلّا!
              </div>
              <div style={{position: 'absolute', right: 270, top: 26, fontSize: 30, fontWeight: 800, lineHeight: 1.4, color: C.text, transform: `scale(${chrome})`, transformOrigin: '100% 50%'}}>
                اللاعبين {joined}/12
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- lobby tiles (the six who step back)
const LobbyFace: React.FC<{f: number; i: number; s: number}> = ({f, i, s}) => (
  <>
    <At x={0} y={-14}><FamAvatar p={FAM[i]} size={62} style={{transform: `scale(${s})`}} /></At>
    <div style={{position: 'absolute', left: -71, width: 142, top: 22, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 22, lineHeight: 1.4,
      color: C.text, direction: 'rtl', transform: `scale(${s})`}}>{FAM[i].name}</div>
  </>
);

const Slot: React.FC<{r: R; s: number}> = ({r, s}) => (
  <div style={{position: 'absolute', left: -r.w / 2, top: -r.h / 2, width: r.w, height: r.h, borderRadius: 20, border: `3px dashed ${C.outline}`,
    boxSizing: 'border-box', transform: `scale(${s})`}} />
);

const Others: React.FC<{f: number}> = ({f}) => (
  <>
    {OTHERS.map((i, k) => {
      const r = LOBBY(i);
      const away = spr(f, b(T.open) - 4 + k * 1.5, SNAPPY);
      if (away > 0.99) return null;
      const land = b(joinBeat(i));
      if (f < land) return <At key={i} x={r.x} y={r.y} z={4}><Slot r={r} s={1 - away} /></At>;
      const pop = spr(f, land, POP);
      return (
        <At key={i} x={r.x} y={r.y} z={6} style={{transform: `scale(${(1 - away) * (0.9 + 0.1 * pop)})`}}>
          <div style={{position: 'absolute', left: -r.w / 2, top: -r.h / 2, width: r.w, height: r.h, borderRadius: 20, background: C.surface}} />
          <LobbyFace f={f} i={i} s={pop} />
        </At>
      );
    })}
  </>
);

// ---------------------------------------------------------------- the six phones
const VOTES: Record<number, {pick: number; at: number}> = {};
SEL.filter((i) => i !== MOLE_I).forEach((i, k) => (VOTES[i] = {pick: MOLE_I, at: b(T.vote0 + 0.5 * k)}));
VOTES[MOLE_I] = {pick: 0, at: b(T.vote0 + 0.25)}; // Khalo votes Teta

const Phones: React.FC<{f: number}> = ({f}) => (
  <>
    {SEL.map((i) => {
      const {r, m1, m3, s} = cell(f, i);
      const p = FAM[i];
      const mole = i === MOLE_I;
      const away = !mole ? spr(f, b(T.close) - 6 + s * 1.5, {damping: 24, stiffness: 300}) : 0; // the others step out as the TV closes
      if (away > 0.99) return null;
      const bezel = Math.min(prog(f, m1At(s) + 2, m1At(s) + b(0.6)), 1 - m3);
      const lift = mole ? 20 * spr(f, b(T.ring), POP) * (1 - m3) : 0;
      const lobbyFace = 1 - spr(f, m1At(s) + b(0.15), SNAPPY);
      const v = VOTES[i];
      const verdictFace = mole ? spr(f, b(T.close + 0.35), POP) : 0;
      return (
        <At key={i} x={r.x} y={r.y - lift} z={mole ? 12 : 10} style={{transform: `scale(${1 - away})`}}>
          <PhoneFrame w={r.w} h={r.h} bezel={bezel} screen={m1 > 0.3 && m3 < 0.5 ? '#2A1550' : C.surface} island={m1 > 0.8 && m3 < 0.2}>
            {m1 > 0.3 && m3 < 0.3 ? (
              <>
                <ArWordFace f={f} w={r.w} h={r.h} p={p} word={mole ? UNDER : CIVIL} flipAt={flipAt(s)} hideAt={b(T.hide) + s * 2} contentIn={contentAt(s)} out={v.at - 2} />
                <ArVoteFace f={f} w={r.w} h={r.h} pick={FAM[v.pick]} at={v.at + 2} out={mole ? b(T.close) : 1e9} />
              </>
            ) : null}
          </PhoneFrame>
          {lobbyFace > 0.01 ? <LobbyFace f={f} i={i} s={lobbyFace * (f < b(joinBeat(i)) ? 0 : 1)} /> : null}
          {verdictFace > 0.001 ? (
            <>
              <At x={0} y={-62}><FamAvatar p={p} size={220} style={{transform: `scale(${verdictFace})`}} /></At>
            </>
          ) : null}
        </At>
      );
    })}
  </>
);

/** Relatives joining: each avatar flies up from the bottom edge (their phones) into its slot. */
const Flights: React.FC<{f: number}> = ({f}) => (
  <>
    {JOINERS.map((i, k) => {
      const t1 = b(JOIN_AT[k]), t0 = t1 - b(0.7);
      if (f < t0 || f >= t1) return null;
      const to = LOBBY(i);
      const t = prog(f, t0, t1, easeOut);
      const x = lerp(to.x + (k % 2 ? 80 : -80), to.x, t);
      const y = lerp(AD_H + 100, to.y - 14, t);
      return (
        <At key={i} x={x} y={y} z={7}>
          <FamAvatar p={FAM[i]} size={lerp(150, 62, t)} style={{transform: `rotate(${(1 - t) * (k % 2 ? 14 : -14)}deg)`, boxShadow: '0 14px 30px rgba(10,4,20,0.4)'}} />
        </At>
      );
    })}
  </>
);

/** Giant amber head-count under the TV: rolls one notch per landing (8 -> 12), punches at 12. */
const Counter: React.FC<{f: number}> = ({f}) => {
  const gone = spr(f, b(T.open) - 6, SNAPPY);
  if (gone > 0.99) return null;
  const roll = JOIN_AT.reduce((acc, t) => acc + spr(f, b(t), SNAPPY), 0); // 0..4
  const full = f >= b(JOIN_AT[3]) ? 1 + 0.16 * (1 - spr(f, b(JOIN_AT[3]), POP)) : 1;
  const H = 300;
  return (
    <At x={SAFE_CX} y={1390} z={8}>
      <div style={{position: 'absolute', left: -450, width: 900, top: -170, height: 340, fontFamily: FONT, fontWeight: 900, lineHeight: 1, direction: 'ltr',
        transform: `scale(${full * (1 - gone)})`, transformOrigin: '50% 55%'}}>
        <div style={{position: 'absolute', right: 470, top: 10, height: H, width: 380, overflow: 'hidden'}}>
          {Array.from({length: 5}, (_, k) => (
            <div key={k} style={{position: 'absolute', right: 0, top: (k - roll) * H, height: H, lineHeight: `${H}px`, fontSize: 290, color: C.accent,
              textShadow: '0 12px 40px rgba(10,4,20,0.45)'}}>{k + 8}</div>
          ))}
        </div>
        <div style={{position: 'absolute', left: 445, top: 128, fontSize: 150, color: C.text, textShadow: '0 10px 30px rgba(10,4,20,0.45)'}}>/12</div>
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- Khalo's amber ring (emphasis from outside the phone)
const Ring: React.FC<{f: number}> = ({f}) => {
  if (f < b(T.ring) - 2) return null;
  const {r} = cell(f, MOLE_I);
  const k = spr(f, b(T.ring), POP);
  const out = spr(f, b(T.close) - 4, SNAPPY);
  if (out > 0.99) return null;
  const lift = 20 * k;
  const bez = Math.max(3, r.w * 0.035), gap = 16;
  const w = r.w + 2 * (bez + gap), h = r.h + 2 * (bez + gap);
  return (
    <At x={r.x} y={r.y - lift} z={11}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: r.w * 0.14 + bez + gap, border: `9px solid ${C.accent}`,
        boxSizing: 'border-box', transform: `scale(${(1.2 - 0.2 * k) * (1 - out)})`, opacity: clamp(k * 1.4), boxShadow: '0 0 60px rgba(255,201,77,0.5)'}} />
    </At>
  );
};

// ---------------------------------------------------------------- clues, verdict
const CLUES: Array<{i: number; t: string}> = [
  {i: 0, t: 'بقدونس'},
  {i: 2, t: 'حامض'},
  {i: 1, t: 'برغل'},
  {i: MOLE_I, t: 'خبز؟'},
];

const Clues: React.FC<{f: number}> = ({f}) => (
  <>
    {CLUES.map(({i, t}, k) => {
      const at = b(T.clues[k]);
      const s = spr(f, at, POP) - spr(f, b(T.bubOut) + k * 2, {damping: 26, stiffness: 300});
      if (s <= 0.001) return null;
      const r = PHONE(slotOf(i));
      const lift = i === MOLE_I ? 20 : 0;
      return (
        <At key={k} x={r.x} y={r.y - r.h / 2 + 70 - lift} z={20} style={{direction: 'rtl'}}>
          <Bubble text={t} s={s} size={60} tone={i === MOLE_I ? 'amber' : 'cream'} />
        </At>
      );
    })}
  </>
);

/** The TV's verdict: «برّا» stamp (lobby.kick / elim.eliminated), −8°, amber. */
const Stamp: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.stamp);
  if (f < t0 - 6) return null;
  const slam = f < t0 ? lerp(1.8, 1, easeIn(prog(f, t0 - 6, t0, (x) => x))) : 1 + 0.08 * (1 - spr(f, t0, POP));
  return (
    <At x={VERDICT.x - 20} y={VERDICT.y + 118} z={30}>
      <div style={{position: 'absolute', left: -210, top: -95, width: 420, height: 190, borderRadius: 30, background: C.accent, border: `8px solid ${C.ink}`, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 124, lineHeight: 1, color: C.ink,
        boxShadow: '0 12px 30px rgba(0,0,0,0.4)', transform: `rotate(-8deg) scale(${slam})`, direction: 'rtl', paddingBottom: 18}}>
        برّا
      </div>
    </At>
  );
};

/** The rest of the family under the TV once the verdict is up (fills the lower third, hops after the stamp). */
const Crowd: React.FC<{f: number}> = ({f}) => {
  if (f < b(T.crowd)) return null;
  const rest = FAM.map((_, i) => i).filter((i) => i !== MOLE_I);
  return (
    <>
      {rest.map((i, k) => {
        const row = k < 6 ? 0 : 1;
        const col = row === 0 ? k : k - 6;
        const n = row === 0 ? 6 : 5;
        const x = SAFE_CX + ((n - 1) / 2 - col) * 146;
        const y = 1390 + row * 150;
        const s = spr(f, b(T.crowd) + k * 1.2, POP);
        const hop = f > b(T.stamp) ? Math.max(0, Math.sin((f - b(T.stamp) - k * 3) / 7)) * 18 * (1 - prog(f, b(T.stamp + 3), b(T.stamp + 5))) : 0;
        return <At key={i} x={x} y={y - hop} z={9}><FamAvatar p={FAM[i]} size={112} style={{transform: `scale(${s})`, boxShadow: '0 10px 24px rgba(10,4,20,0.35)'}} /></At>;
      })}
    </>
  );
};

/** The one full-screen colour flash (magenta), on the stamp: 6 frames full, then it irises into the stamp. */
const Flash: React.FC<{f: number; x: number; y: number}> = ({f, x, y}) => {
  const t0 = b(T.stamp);
  if (f < t0 || f > t0 + 18) return null;
  const R = Math.hypot(Math.max(x, AD_W - x), Math.max(y, AD_H - y)) * 1.05;
  const r = R * (1 - prog(f, t0 + 6, t0 + 18, easeIn));
  return <div style={{position: 'absolute', inset: 0, zIndex: 80, background: C.primary, clipPath: `circle(${r}px at ${x}px ${y}px)`}} />;
};

/** 3-frame, 6 px shake when the stamp lands. */
const shake = (f: number) => {
  const k = Math.round(f - b(T.stamp));
  const o = [[6, -5], [-5, 4], [3, -2]];
  return k >= 0 && k < 3 ? o[k] : [0, 0];
};

// ---------------------------------------------------------------- body
export const M6Body: React.FC = () => {
  const f = useCurrentFrame();
  const {z, cx, cy, map} = cam(f);
  const [sx, sy] = shake(f);
  const flood = map(VERDICT.x, VERDICT.y);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0',
        transform: `translate(${sx}px, ${sy}px) translate(${SAFE_CX}px, 900px) scale(${z}) translate(${-cx}px, ${-cy}px)`}}>
        <Tv f={f} />
        <Counter f={f} />
        <Others f={f} />
        <Phones f={f} />
        <Ring f={f} />
        <Flights f={f} />
        <Clues f={f} />
        <Crowd f={f} />
        <Stamp f={f} />
      </div>
      <Flash f={f} x={flood.x} y={flood.y} />

      {/* hook: composed on frame 0 (thumbnail) */}
      <ArCaption f={f} text="سهرة العيلة؟ | *12* واحد؟" y={360} start={-b(1)} end={b(4.4)} size={96} />
      <ArCaption f={f} text="*أحسن!* كلّنا منلعب." y={340} start={b(4.7)} end={b(8.05)} size={84} />
      <ArCaption f={f} text={`كلّن معن *${CIVIL}*…`} y={340} start={b(8.35)} end={b(11.7)} size={84} />
      <ArCaption f={f} text="إلّا *خالو*… وما بيعرف." y={340} start={b(12.0)} end={b(16.3)} size={96} accent={C.primary} />
      <ArCaption f={f} text="كل واحد *كلمة.*" y={340} start={b(16.6)} end={b(20.0)} size={84} />
      <ArCaption f={f} text="خبز؟ *بالتبولة؟!*" y={340} start={b(21.0)} end={b(25.3)} size={96} accent={C.primary} />
      <ArCaption f={f} text="مين *مش* *منّا؟*" y={340} start={b(25.6)} end={b(29.0)} size={84} />
      <ArCaption f={f} text="خالو: *الجاسوس*" y={1200} start={b(T.role)} size={96} />
      <ArCaption f={f} text="سهرة العيلة | *رح تولّع.*" y={370} start={b(31.6)} size={96} accent={C.primary} />

      <BgFlood f={f} start={END} x={flood.x} y={flood.y} />
    </div>
  );
};

// ---------------------------------------------------------------- sound (≤ 1 per beat)
export const M6_HITS: Hit[] = [
  ...JOIN_AT.slice(0, 3).map((t, k): Hit => ({at: b(t), sfx: k % 2 ? 'pop_b' : 'pop_a'})),
  {at: b(JOIN_AT[3]), sfx: 'pop_hard', vol: 0.45},
  {at: b(T.press), sfx: 'click', vol: 0.7},
  {at: b(6.0), sfx: 'whoosh_fast', vol: 0.45},
  {at: flipAt(0), sfx: 'tick', vol: 0.45, max: 18},
  {at: b(T.ring), sfx: 'bass_hit', vol: 0.7, max: 40},
  ...T.clues.slice(0, 3).map((t, k): Hit => ({at: b(t), sfx: k % 2 ? 'pop_b' : 'pop_a'})),
  {at: b(T.clues[3]), sfx: 'pop_hard', vol: 0.45},
  {at: b(21.75), sfx: 'wrong', vol: 0.45, max: 50},
  ...[0, 2, 4].map((k): Hit => ({at: b(T.vote0 + 0.5 * k) + 2, sfx: 'tick', vol: 0.4, max: 16})),
  {at: b(T.close), sfx: 'whoosh_fast', vol: 0.4},
  {at: b(T.stamp), sfx: 'stamp', vol: 1},
  {at: b(31.6), sfx: 'sparkle', vol: 0.5},
  {at: END + 10, sfx: 'whoosh_fast', vol: 0.35},
];
