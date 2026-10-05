import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C} from '../brand';
import {At, Avatar, FONT, PhoneFrame, WordFace} from '../parts';
import {b, clamp, easeIn, easeInOut, lerp, mix, POP, prog, SNAPPY, spr} from '../time';
import {AdCaption, BgFlood, Hit, SAFE_CX, VoLine} from './common';
import {
  BOSS, BrowserScreen, CalendarScreen, CAST, Lobby, MarkScreen, out, QR_C, Rect, rectLerp, STAMP_L, T, TV_A, TV_C, tvAt, TvFrame, tvPt, VoteBoard, VT,
} from './m7-tv';

/**
 * MA_G_M7 "Team party / office" (DECISIONS.md #14). One continuous take, ad beat 0 = the drop.
 * Hook (pre-settled on frame 0): the meeting-room screen shows the calendar — "Team event · 5:00 PM · Agenda: ???" —
 * above five colleagues at the table, each with a silent "…" bubble; the clock ticks 4:58 -> 4:59.
 * The laptop opens, an HDMI cable draws to the screen, the browser types play.mishana.workers.dev/tv -> lobby.
 * Each colleague holds up a phone and scans in -> Start -> the scan phones grow into the real word screens:
 * COFFEE x4 -> the boss's phone comes forward: TEA (amber ring, outside the phone) -> TV back as the vote board,
 * phones drop into a row, one clue each, votes fly from the phones -> OUT (one amber flash) -> "Dana was the Mole"
 * -> Dana: "I had TEA" while the team laughs -> the team pops up with "3–12 players · Free to play" -> end card.
 * Word pair: Coffee / Tea, pair p001 of word-packs/packs/en/en-everyday-01.json.
 */
export const M7_BODY_FRAMES = Math.round(b(35.5));
const END = M7_BODY_FRAMES - 22;

// ---------------------------------------------------------------- captions (and VO: same words, ≤ 2.5 words/s)
type Cap = {text: string; vo: string; y: number; size: 84 | 96; start: number; end: number};
const CAPS: Cap[] = [
  {text: 'Team event at 5. *No\u00A0plan.*', vo: 'Team event at five. No plan.', y: 372, size: 96, start: -70, end: 148},
  {text: 'Big screen. *Nothing* to install.', vo: 'Big screen. Nothing to install.', y: 372, size: 84, start: 154, end: 284},
  {text: 'Everyone *scans* in.', vo: 'Everyone scans in.', y: 372, size: 84, start: 292, end: 372},
  {text: 'Secret word: *COFFEE.*', vo: 'Secret word: coffee.', y: 632, size: 84, start: 378, end: 486},
  {text: 'Except the *boss.*', vo: 'Except the boss.', y: 632, size: 84, start: 492, end: 602},
  {text: 'One clue each. *Then\u00A0vote.*', vo: 'One clue each. Then vote.', y: 372, size: 84, start: 612, end: 744},
  {text: 'The *boss* was\u00A0the\u00A0Mole.', vo: 'The boss was the Mole.', y: 372, size: 96, start: 756, end: 888},
  {text: 'Your next team *icebreaker.*', vo: 'Your next team icebreaker.', y: 372, size: 96, start: 898, end: END - 2},
];
const words = (s: string) => s.split(' ').length;
export const M7_VO: VoLine[] = CAPS.map((c, i) => ({
  at: Math.max(0, c.start + 4),
  dur: words(c.vo) * 24, // exactly 2.5 words/s
  src: `vo/m7-en-${String(i + 1).padStart(2, '0')}.mp3`,
}));

// ---------------------------------------------------------------- 1. the meeting room
const AV_X = (i: number) => 170 + 170 * i;
const AV_Y = 1200;
const AV = 120;
const LAP = {x: SAFE_CX, y: 1470, w: 250, h: 156};
const awayY = (f: number) => 1000 * prog(f, b(T.s3), b(T.s3 + 0.65), easeIn);

const Dots: React.FC<{f: number; i: number}> = ({f, i}) => {
  const s = spr(f, -b(1.6) + i * b(0.22), POP) - out(f, b(4.1) + i * 2);
  if (s <= 0.001) return null;
  return (
    <At x={AV_X(i) + 34} y={AV_Y - 96} z={12}>
      <div style={{position: 'absolute', left: -58, top: -34, width: 116, height: 62, borderRadius: '31px 31px 31px 8px', background: C.text,
        transform: `scale(${s})`, transformOrigin: '10% 100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
        boxShadow: '0 8px 20px rgba(10,4,20,0.3)'}}>
        {[0, 1, 2].map((d) => <div key={d} style={{width: 13, height: 13, borderRadius: 99, background: '#8E7FA8'}} />)}
      </div>
    </At>
  );
};

const Office: React.FC<{f: number}> = ({f}) => {
  const dy = awayY(f);
  if (dy >= 999) return null;
  const lid = 0.07 + 0.93 * spr(f, b(T.laptop), SNAPPY);
  const cable = prog(f, b(T.cable), b(T.cable + 0.75), easeInOut);
  const onTv = f >= b(T.browser);
  const lobby = f >= b(T.enter) + 6;
  const CABLE = 'M 640 1462 C 760 1466, 935 1470, 935 1330 L 935 1000';
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translateY(${dy}px)`}}>
      {/* chair backs */}
      {CAST.map((_, i) => (
        <div key={`c${i}`} style={{position: 'absolute', left: AV_X(i) - 76, top: AV_Y - 40, width: 152, height: 120, borderRadius: '40px 40px 12px 12px',
          background: C.elevated, zIndex: 6}} />
      ))}
      {/* colleagues, fidgeting in the silence */}
      {CAST.map((p, i) => {
        const sway = f < b(5) ? (i % 2 ? 1 : -1) * 5 * Math.sin((Math.PI * f) / b(1) + i) : 0;
        const J = b(T.join[i]);
        const hop = f > J && f < J + 16 ? 22 * Math.sin((Math.PI * (f - J)) / 16) : 0;
        return (
          <At key={i} x={AV_X(i)} y={AV_Y - hop} z={7}>
            <Avatar shape={p.shape} color={p.color} size={AV} initial={p.name[0]} cream={p.cream} style={{transform: `rotate(${sway}deg)`}} />
          </At>
        );
      })}
      {/* table */}
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, zIndex: 8, overflow: 'visible'}}>
        <path d="M 120 1250 L 900 1250 L 975 1520 L 45 1520 Z" fill="#6A4BB0" stroke="#6A4BB0" strokeWidth={36} strokeLinejoin="round" />
        <path d="M 45 1520 L 975 1520 L 975 1556 L 45 1556 Z" fill="#4A2E86" stroke="#4A2E86" strokeWidth={20} strokeLinejoin="round" />
        <path d="M 130 1240 L 890 1240" stroke="#8C70D2" strokeWidth={10} strokeLinecap="round" />
      </svg>
      {/* place cards */}
      {CAST.map((p, i) => (
        <div key={`n${i}`} style={{position: 'absolute', left: AV_X(i) - 100, width: 200, top: 1262, display: 'flex', justifyContent: 'center', zIndex: 9}}>
          <div style={{background: C.text, color: C.ink, borderRadius: 12, padding: '2px 14px', fontFamily: FONT, fontWeight: 800, fontSize: 30, display: 'flex',
            alignItems: 'center', gap: 8, boxShadow: '0 6px 12px rgba(10,4,20,0.25)'}}>
            {p.name}
            {i === BOSS ? <span style={{background: C.primary, color: C.ink, borderRadius: 8, padding: '0 8px', fontSize: 22, fontWeight: 900}}>BOSS</span> : null}
          </div>
        </div>
      ))}
      {/* HDMI cable */}
      {cable > 0 ? (
        <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, zIndex: 9}}>
          <path d={CABLE} stroke="#120A22" strokeWidth={10} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - cable} />
        </svg>
      ) : null}
      {/* laptop */}
      <At x={LAP.x} y={LAP.y} z={10}>
        <div style={{position: 'absolute', left: -LAP.w / 2, top: -LAP.h, width: LAP.w, height: LAP.h, transformOrigin: '50% 100%', transform: `scaleY(${lid})`,
          background: '#1A1030', borderRadius: '14px 14px 4px 4px', padding: 9, boxSizing: 'border-box'}}>
          <div style={{width: '100%', height: '100%', borderRadius: 6, background: lobby ? C.bg : onTv ? '#FBF6F0' : '#D9CCE4', position: 'relative', overflow: 'hidden'}}>
            {lobby ? <div style={{position: 'absolute', left: 18, top: 26, width: 62, height: 62, borderRadius: 8, background: C.text}} /> : null}
            {onTv && !lobby ? <div style={{position: 'absolute', left: 10, right: 10, top: 10, height: 16, borderRadius: 99, background: '#FFFFFF', boxShadow: `inset 0 0 0 2px ${C.primary}`}} /> : null}
          </div>
        </div>
        <div style={{position: 'absolute', left: -LAP.w / 2 - 26, top: -2, width: LAP.w + 52, height: 20, borderRadius: '4px 4px 12px 12px', background: '#CFC4E2'}} />
      </At>
    </div>
  );
};

// ---------------------------------------------------------------- 2. phones: scan phone -> word screen -> row
const SCAN = (i: number): Rect => ({x: AV_X(i) + (i === BOSS ? -10 : 0), y: 1062, w: 78, h: 156});
const PW = 224, PH = 466;
const GRID: Rect[] = [
  {x: SAFE_CX - 262, y: 930, w: PW, h: PH}, {x: SAFE_CX, y: 930, w: PW, h: PH}, {x: SAFE_CX + 262, y: 930, w: PW, h: PH},
  {x: SAFE_CX - 131, y: 1372, w: PW, h: PH}, {x: SAFE_CX + 131, y: 1372, w: PW, h: PH},
];
const FOCUS: Rect = {x: SAFE_CX, y: 1180, w: 300, h: 624};
const MINI = (i: number): Rect => ({x: SAFE_CX + (i - 2) * 186, y: 1450, w: 150, h: 312});
const scanAt = (i: number) => b(T.join[i]) - b(0.8);
const flipAt = (i: number) => (i === BOSS ? b(T.moleFlip) : b(T.flip[i])) - 6; // face shows on the beat

const phoneRect = (f: number, i: number) => {
  const m = prog(f, b(T.s3) + i * 2, b(T.s3 + 0.8) + i * 2, easeInOut);
  let r = rectLerp(SCAN(i), GRID[i], m);
  if (i === BOSS) r = rectLerp(r, FOCUS, prog(f, b(T.focus), b(T.focus + 0.7), easeInOut));
  const m2 = prog(f, b(T.s4) + i * 2, b(T.s4 + 0.7) + i * 2, easeInOut);
  r = rectLerp(r, MINI(i), m2);
  return {r: {...r, y: r.y - Math.sin(Math.PI * m) * 60}, m};
};

const ScanScreen: React.FC<{f: number; i: number; w: number; h: number}> = ({f, i, w, h}) => {
  const J = b(T.join[i]);
  const p = CAST[i];
  if (f >= J) {
    const k = spr(f, J, POP);
    return (
      <div style={{position: 'absolute', inset: 0, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <svg width={w * 0.5} height={w * 0.5} viewBox="0 0 40 40" style={{transform: `scale(${k})`}}>
          <path d="M8 21l8 8 16-17" stroke={p.cream ? C.text : C.ink} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  const c = w * 0.22, t = 3.5, ins = w * 0.18;
  const corner = (x: number, y: number, rx: number, ry: number) => (
    <div style={{position: 'absolute', left: x, top: y, width: c, height: c, borderStyle: 'solid', borderColor: C.text,
      borderWidth: `${ry < 0 ? t : 0}px ${rx > 0 ? t : 0}px ${ry > 0 ? t : 0}px ${rx < 0 ? t : 0}px`}} />
  );
  return (
    <div style={{position: 'absolute', inset: 0, background: '#3B3352'}}>
      {corner(ins, h / 2 - w / 2 + ins, -1, -1)}
      {corner(w - ins - c, h / 2 - w / 2 + ins, 1, -1)}
      {corner(ins, h / 2 + w / 2 - ins - c, -1, 1)}
      {corner(w - ins - c, h / 2 + w / 2 - ins - c, 1, 1)}
    </div>
  );
};

const VoteScreen: React.FC<{f: number; i: number; w: number; h: number}> = ({f, i, w, h}) => {
  const u = w / 150;
  const pick = i === BOSS ? 1 : BOSS;
  const at = b(T.vote[i]) - b(0.6);
  const others = CAST.map((_, j) => j).filter((j) => j !== i);
  return (
    <div style={{position: 'absolute', inset: 0, background: C.bg, fontFamily: FONT, transform: `translateY(${(1 - spr(f, b(T.voteUi), SNAPPY)) * h}px)`}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 30 * u, textAlign: 'center', fontSize: 15 * u, fontWeight: 900, color: C.text}}>Vote</div>
      {others.map((j, k) => {
        const on = j === pick && f >= at;
        const p = CAST[j];
        return (
          <div key={j} style={{position: 'absolute', left: 12 * u, right: 12 * u, top: (64 + k * 54) * u, height: 44 * u, borderRadius: 12 * u,
            background: on ? C.primary : C.surface, display: 'flex', alignItems: 'center', gap: 8 * u, paddingLeft: 10 * u,
            transform: `scale(${on ? 1 + 0.06 * (1 - spr(f, at, POP)) : 1})`}}>
            <div style={{position: 'relative', width: 22 * u, height: 22 * u}}>
              <div style={{position: 'absolute', left: 11 * u, top: 11 * u}}><Avatar shape={p.shape} color={p.color} size={22 * u} /></div>
            </div>
            <span style={{fontSize: 13 * u, fontWeight: 800, color: on ? C.ink : C.text}}>{p.name}</span>
          </div>
        );
      })}
    </div>
  );
};

const Phones: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map((p, i) => {
      const s0 = scanAt(i);
      if (f < s0) return null;
      const pop = spr(f, s0, POP);
      const gone = out(f, b(T.close) + i * 2);
      if (gone > 0.99) return null;
      const {r, m} = phoneRect(f, i);
      const boss = i === BOSS;
      const word = m > 0.45;
      // pointed out from outside the phone only: amber ring + wobble on the TEA beat
      const P = b(T.moleFlip);
      const ring = boss ? spr(f, P, POP) - out(f, b(T.s4)) : 0;
      const wob = boss ? 6 * (spr(f, P, POP) - spr(f, P + 8, POP)) : 0;
      const sat = !boss ? 1 - 0.7 * (prog(f, b(T.focus), b(T.focus) + 12) - prog(f, b(T.s4), b(T.s4) + 12)) : 1;
      const laughT = b(T.laugh) + i * 3;
      const hop = !boss && f > laughT && f < laughT + 16 ? 26 * Math.sin((Math.PI * (f - laughT)) / 16)
        : boss && f > b(T.tea) - 2 && f < b(T.tea) + 14 ? 20 * Math.sin((Math.PI * (f - b(T.tea) + 2)) / 16) : 0;
      const pad = 16, rw = 8;
      const vote = f >= b(T.voteUi);
      return (
        <At key={i} x={r.x} y={r.y - hop} z={boss ? 24 : i >= 3 ? 21 : 20}>
          <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${wob + (m < 0.01 ? (i % 2 ? 6 : -6) : 0)}deg) scale(${pop * (1 - gone)})`,
            filter: sat < 0.999 ? `saturate(${sat})` : undefined}}>
            {ring > 0.01 ? (
              <div style={{position: 'absolute', left: -r.w / 2 - pad - rw, top: -r.h / 2 - pad - rw, width: r.w + 2 * (pad + rw), height: r.h + 2 * (pad + rw),
                borderRadius: r.w * 0.14 + pad + rw, border: `${rw}px solid ${C.accent}`, boxSizing: 'border-box', transform: `scale(${0.85 + 0.15 * ring})`,
                boxShadow: '0 0 44px rgba(255,201,77,0.5)'}} />
            ) : null}
            <PhoneFrame w={r.w} h={r.h} screen={word ? C.bg : '#3B3352'} island={r.w > 120}>
              {!word ? <ScanScreen f={f} i={i} w={r.w} h={r.h} /> : (
                <>
                  <WordFace f={f} w={r.w} h={r.h} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={p.word} flipAt={flipAt(i)}
                    contentIn={b(T.s3) + b(0.45)} />
                  {vote ? <VoteScreen f={f} i={i} w={r.w} h={r.h} /> : null}
                </>
              )}
            </PhoneFrame>
          </div>
        </At>
      );
    })}
  </>
);

/** Scan beams: phone -> the TV's QR, a dot travelling up the line into the code. */
const Beams: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map((_, i) => {
      const J = b(T.join[i]);
      const a = J - b(0.5);
      if (f < a || f > J + 8) return null;
      const s = SCAN(i);
      const q = tvPt(TV_A, QR_C.x, QR_C.y);
      const x0 = s.x, y0 = s.y - s.h / 2;
      const t = prog(f, a, J, easeInOut);
      const fade = 1 - prog(f, J, J + 8);
      const len = Math.hypot(q.x - x0, q.y - y0);
      const ang = (Math.atan2(q.y - y0, q.x - x0) * 180) / Math.PI;
      return (
        <div key={i} style={{position: 'absolute', left: x0, top: y0, width: len, height: 0, transformOrigin: '0 0', transform: `rotate(${ang}deg)`, zIndex: 15}}>
          <div style={{position: 'absolute', left: 0, top: -3, width: len * t, height: 6, borderRadius: 3, background: CAST[i].color,
            transform: `scaleY(${fade})`, boxShadow: `0 0 14px ${CAST[i].color}`}} />
          <div style={{position: 'absolute', left: len * t - 13, top: -13, width: 26, height: 26, borderRadius: 99, background: C.text,
            transform: `scale(${fade})`, boxShadow: `0 0 18px ${C.text}`}} />
        </div>
      );
    })}
  </>
);

// ---------------------------------------------------------------- 3. clues, votes, OUT
const BubbleX: React.FC<{text: string; s: number; size: number; tone: 'cream' | 'amber'; dx?: number}> = ({text, s, size, tone, dx = 0}) => {
  if (s <= 0.05) return null;
  const bg = tone === 'amber' ? C.accent : C.text;
  return (
    <div style={{position: 'absolute', left: dx, bottom: 0, transform: `translateX(-50%) scale(${s})`, transformOrigin: `calc(50% - ${dx}px) 100%`}}>
      <div style={{position: 'relative', background: bg, color: C.ink, fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.1,
        padding: `${size * 0.26}px ${size * 0.55}px`, borderRadius: size * 0.7, whiteSpace: 'nowrap', boxShadow: '0 10px 24px rgba(10,4,20,0.35)'}}>
        {text}
        <div style={{position: 'absolute', left: `calc(50% - ${dx}px)`, bottom: -size * 0.32, marginLeft: -size * 0.3, width: 0, height: 0,
          borderLeft: `${size * 0.3}px solid transparent`, borderRight: `${size * 0.3}px solid transparent`, borderTop: `${size * 0.36}px solid ${bg}`}} />
      </div>
    </div>
  );
};

const CLUE_DX = [12, 0, 0, 0, -44];
const Clues: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map((p, i) => {
      const at = b(T.clue[i]);
      const s = spr(f, at, POP) - out(f, b(T.clueOut) + i * 2);
      if (s <= 0.001) return null;
      const r = MINI(i);
      const hop = f > at - 4 && f < at + 12 ? 16 * Math.sin((Math.PI * (f - at + 4)) / 16) : 0;
      return (
        <At key={i} x={r.x} y={r.y - r.h / 2 - 24 - (i % 2 ? 92 : 0) - hop} z={26}>
          <BubbleX text={p.clue} s={s} size={54} tone={i === BOSS ? 'amber' : 'cream'} dx={CLUE_DX[i]} />
        </At>
      );
    })}
  </>
);

const TeaLine: React.FC<{f: number}> = ({f}) => {
  const s = spr(f, b(T.tea), POP) - out(f, b(T.close) - 6);
  if (s <= 0.001) return null;
  const r = MINI(BOSS);
  return (
    <At x={r.x} y={r.y - r.h / 2 - 26} z={27}>
      <BubbleX text="I had TEA!" s={s} size={54} tone="cream" dx={-130} />
    </At>
  );
};

const voteTarget = (i: number) => {
  const j = i === BOSS ? 1 : BOSS;
  const n = i === BOSS ? 0 : i;
  const v = VT(j);
  return tvPt(TV_C, v.x + (i === BOSS ? 0 : (n - 1.5) * 36), v.y - 100 - 14);
};

const Votes: React.FC<{f: number}> = ({f}) => (
  <>
    {T.vote.map((land, i) => {
      const t1 = b(land), t0 = t1 - b(0.6);
      if (f < t0) return null;
      const from = MINI(i);
      const to = voteTarget(i);
      const t = prog(f, t0, t1, easeInOut);
      const x = lerp(from.x, to.x, t), y = lerp(from.y - from.h / 2, to.y, t) - Math.sin(Math.PI * t) * 200;
      const k = f >= t1 ? 1 + 0.4 * (1 - spr(f, t1, POP)) : 1;
      return (
        <At key={i} x={x} y={y} z={35}>
          <div style={{position: 'absolute', left: -22, top: -22, width: 44, height: 44, borderRadius: 99, background: CAST[i].color,
            border: `4px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${k})`}} />
        </At>
      );
    })}
  </>
);

const SC = TV_C.w / 1040;
const SP = tvPt(TV_C, STAMP_L.x, STAMP_L.y);
const Stamp: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.stamp);
  if (f < t0 - 7) return null;
  const w = STAMP_L.w * SC, h = STAMP_L.h * SC;
  const slam = f < t0 ? lerp(2.6, 1, easeIn(clamp((f - t0 + 7) / 7))) : 1 + 0.1 * (1 - spr(f, t0, POP));
  return (
    <At x={SP.x} y={SP.y} z={60}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: h * 0.22, background: C.accent,
        transform: `rotate(-8deg) scale(${slam})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        border: `${h * 0.06}px solid ${C.ink}`, boxShadow: `0 ${h * 0.15}px ${h * 0.4}px rgba(0,0,0,0.45)`}}>
        <span style={{fontFamily: FONT, fontWeight: 900, fontSize: h * 0.7, lineHeight: 1, color: C.ink, letterSpacing: '0.06em'}}>OUT</span>
      </div>
    </At>
  );
};

/** The one full-screen flash (DECISIONS #7): amber, 6 frames, on the stamp. */
const Flash: React.FC<{f: number}> = ({f}) => {
  const t0 = Math.round(b(T.stamp));
  if (f < t0 || f >= t0 + 6) return null;
  return <div style={{position: 'absolute', inset: 0, zIndex: 92, background: mix(C.accent, '#FFE4A0', f - t0 < 2 ? 0.5 : 0)}} />;
};

// ---------------------------------------------------------------- 4. the team + the facts
const CREW_Y = 1336;
const Crew: React.FC<{f: number}> = ({f}) => (
  <>
    {CAST.map((p, i) => {
      const at = b(T.crew + i * 0.2);
      const s = spr(f, at, POP);
      if (s <= 0.001) return null;
      const hop = T.hops.reduce((h, hb, k) => {
        const t = b(hb) + i * 2 + k;
        return f > t && f < t + 16 ? h + 30 * Math.sin((Math.PI * (f - t)) / 16) : h;
      }, 0);
      const x = MINI(i).x;
      return (
        <React.Fragment key={i}>
          <At x={x} y={CREW_Y - hop} z={40}>
            <Avatar shape={p.shape} color={p.color} size={136} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${s})`}} />
          </At>
          <div style={{position: 'absolute', left: x - 100, width: 200, top: CREW_Y + 78, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 34,
            color: C.text, zIndex: 40, transform: `scale(${s})`}}>{p.name}</div>
        </React.Fragment>
      );
    })}
  </>
);

const PILL = {x: SAFE_CX, y: 1548};
const Pill: React.FC<{f: number}> = ({f}) => {
  const s = spr(f, b(T.pill), POP);
  if (s <= 0.001) return null;
  return (
    <At x={PILL.x} y={PILL.y} z={41}>
      <div style={{position: 'absolute', left: -380, width: 760, top: -40, height: 80, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
        <div style={{background: C.primary, color: C.ink, borderRadius: 999, padding: '0 34px', height: 80, display: 'flex', alignItems: 'center', fontFamily: FONT,
          fontWeight: 900, fontSize: 46, whiteSpace: 'nowrap', boxShadow: '0 12px 30px rgba(10,4,20,0.35)'}}>
          3–12 players · Free to play
        </div>
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- body
const shake = (f: number) => {
  const k = Math.round(f - b(T.stamp));
  const o = [[10, -7], [-8, 6], [5, -4], [-2, 2]];
  return k >= 0 && k < 4 ? o[k] : [0, 0];
};

export const M7Body: React.FC = () => {
  const f = useCurrentFrame();
  const [sx, sy] = shake(f);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px)`}}>
        <TvFrame r={tvAt(f)}>
          {f < b(T.browser) + 14 ? <CalendarScreen f={f} /> : null}
          {f < b(T.enter) + 30 ? <BrowserScreen f={f} /> : null}
          {f < b(T.s4) + 30 ? <Lobby f={f} /> : null}
          {f < b(T.s4) + 30 ? <MarkScreen f={f} /> : null}
          <VoteBoard f={f} />
        </TvFrame>
        <Office f={f} />
        <Beams f={f} />
        {CAST.map((_, i) => <Dots key={i} f={f} i={i} />)}
        <Phones f={f} />
        <Clues f={f} />
        <TeaLine f={f} />
        <Votes f={f} />
        <Stamp f={f} />
        <Crew f={f} />
        <Pill f={f} />
      </div>
      <Flash f={f} />
      {CAPS.map((c, i) => (
        <AdCaption key={i} f={f} text={c.text} y={c.y} size={c.size} start={c.start} end={c.end} step={b(0.12)} accent={i === 1 || i === 7 ? C.primary : C.accent} />
      ))}
      <BgFlood f={f} start={END} x={PILL.x} y={PILL.y} />
    </div>
  );
};

// ---------------------------------------------------------------- sound (≤ 1 SFX per beat)
export const M7_HITS: Hit[] = [
  {at: 2, sfx: 'bass_hit', vol: 0.6, max: 50},
  ...[1, 2, 3].map((k): Hit => ({at: b(k), sfx: 'tick', vol: 0.4, max: 18})),
  {at: b(T.laptop) + 6, sfx: 'click', vol: 0.6},
  {at: b(T.browser) + 6, sfx: 'swoosh_short', vol: 0.35, max: 40},
  {at: b(T.type) + 4, sfx: 'typing', vol: 0.5, max: Math.round(b(1))},
  {at: b(T.enter), sfx: 'pop_hard', vol: 0.5},
  {at: b(T.join[0]), sfx: 'pop_a'},
  {at: b(T.join[2]), sfx: 'pop_b'},
  {at: b(T.join[4]), sfx: 'pop_a'},
  {at: b(T.press), sfx: 'click', vol: 0.8},
  {at: b(T.s3 + 0.75), sfx: 'whoosh_fast', vol: 0.4},
  {at: b(T.flip[0]), sfx: 'pop_b'},
  {at: b(T.flip[2]), sfx: 'pop_a'},
  {at: b(T.moleFlip), sfx: 'wrong', vol: 0.55, max: 60},
  {at: b(T.s4 + 0.6), sfx: 'whoosh_fast', vol: 0.35},
  {at: b(T.clue[0]), sfx: 'pop_a'},
  {at: b(T.clue[2]), sfx: 'pop_b'},
  {at: b(T.clue[4]), sfx: 'pop_hard'},
  {at: b(T.vote[4]), sfx: 'bass_hit', vol: 0.55, max: 35},
  {at: b(T.stamp), sfx: 'stamp', vol: 1},
  {at: b(T.reveal), sfx: 'pop_hard', vol: 0.45},
  {at: b(T.tea), sfx: 'pop_a'},
  {at: b(T.close) + 4, sfx: 'swoosh_short', vol: 0.35, max: 50},
  {at: b(T.pill), sfx: 'sparkle', vol: 0.6},
  {at: b(T.hops[1]), sfx: 'pop_b', vol: 0.4},
  {at: END + 18, sfx: 'swoosh_short', vol: 0.35, max: 50},
];
