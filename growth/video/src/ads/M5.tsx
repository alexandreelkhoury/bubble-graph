import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C} from '../brand';
import {At, Avatar, FONT, Rise} from '../parts';
import {b, clamp, easeIn, easeInOut, lerp, POP, prog, SNAPPY, spr, TEXT} from '../time';
import {AD_H, AD_W, AdCaption, BgFlood, Hit, SAFE_CX, VoLine} from './common';
import {CAST, FF1, FLOOD, HomeScreen, LookScreen, Lobby, out, SC, ScreenFlood, STAMP_L, T, TV_A, tvAt, TvFrame, tvPt, VoteBoard} from './m5-tv';
import {Clues, Phones, Votes} from './m5-phones';

/**
 * MA_D_M5 "Nothing to do tonight?" (angle D, boredom), v2: fewer, bigger beats, one continuous take, ad beat 0 = drop.
 * 1 hook (pre-settled on frame 0): a bright streaming home sliding on every beat + a group chat at 52 px:
 *   "what are we watching?" "idk" "idk" -> Sami: "I've got a game."
 * 2 Sami's message flies into the TV and floods it magenta -> the lobby (QR, JQPU). "Put a game on the TV."
 * 3 five phones rise and scan; tiles fill on the TV. "Everyone scans. No app."
 * 4 TV: "Check your phones!"; four big phones flip PIZZA. 5 Sami's phone rises big: PASTA (amber ring outside).
 * 6 TV: "Who's not one of us?"; five phones in a row, 56 px clues. 7 votes from the phones, OUT, "Sami was the Mole".
 * 8 the stamp floods amber (the one full-screen flash) and contracts into the "Saturday, sorted." plate.
 * Captions = the VO script in review-v2/uiux.md §3.3, word for word.
 */
export const M5_BODY_FRAMES = Math.round(b(35.75));
const END = M5_BODY_FRAMES - 22;
const farthest = (x: number, y: number) => Math.hypot(Math.max(x, AD_W - x), Math.max(y, AD_H - y)) * 1.05;

// ---------------------------------------------------------------- 1. the group chat (relatable hook, readable)
const PANEL = {x: SAFE_CX, y: 1292, w: 900, h: 560};
const ROW_Y = [1182, 1286, 1390, 1500];
const AV = 76;
const AX_L = PANEL.x - PANEL.w / 2 + 64;
const AX_R = PANEL.x + PANEL.w / 2 - 64;
const MSG = ['what are we watching?', 'idk', 'idk', 'I’ve got a game.'];
const WHO = [0, 1, 2, 4]; // cast index: Maya, Karim, Lea, Sami
const FOLD0 = b(T.fly) + 6;
const FOLD1 = b(T.fly + 0.7);
const FS = 52;

const bubbleStyle = (me: boolean): React.CSSProperties => ({
  position: 'absolute', height: 92, padding: '0 34px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontFamily: FONT,
  fontWeight: me ? 900 : 700, fontSize: FS, background: me ? C.primary : C.elevated, color: me ? C.ink : C.text,
  borderRadius: me ? '46px 46px 12px 46px' : '46px 46px 46px 12px', boxShadow: '0 8px 22px rgba(10,4,20,0.3)',
});

const Typing: React.FC<{f: number}> = ({f}) => {
  const a = b(T.samiType), z = b(T.chat[3]);
  const k = spr(f, a, POP) - out(f, z - 5);
  if (k <= 0.001 || f >= z + 4) return null;
  return (
    <div style={{...bubbleStyle(true), top: ROW_Y[3] - 46, right: AD_W - (AX_R - AV / 2 - 18), width: 150, padding: 0, justifyContent: 'center', gap: 14,
      transformOrigin: '100% 50%', transform: `scale(${k})`, zIndex: 9}}>
      {[0, 1, 2].map((d) => (
        <div key={d} style={{width: 16, height: 16, borderRadius: 99, background: C.ink, transform: `translateY(${-8 * Math.max(0, Math.sin((f - d * 5) / 5))}px)`}} />
      ))}
    </div>
  );
};

const Chat: React.FC<{f: number}> = ({f}) => {
  const fold = prog(f, FOLD0, FOLD1, easeIn);
  if (fold >= 1) return null;
  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 8, transformOrigin: `${PANEL.x}px ${PANEL.y}px`, transform: `scaleY(${1 - fold})`}}>
      <div style={{position: 'absolute', left: PANEL.x - PANEL.w / 2, top: PANEL.y - PANEL.h / 2, width: PANEL.w, height: PANEL.h, borderRadius: 48,
        background: C.surface, boxShadow: `inset 0 0 0 3px ${C.outline}, 0 30px 70px rgba(10,4,20,0.4)`, fontFamily: FONT}}>
        <div style={{position: 'absolute', left: 44, top: 22, display: 'flex', alignItems: 'baseline', gap: 18}}>
          <span style={{fontSize: 42, fontWeight: 900, color: C.text}}>Saturday night</span>
          <span style={{fontSize: 32, fontWeight: 700, color: C.text2}}>· 5 friends</span>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 92, height: 3, background: C.outline}} />
      </div>
      <Typing f={f} />
      {MSG.map((m, j) => {
        const at = b(T.chat[j]);
        const me = j === 3;
        const s = spr(f, at, POP);
        if (s <= 0.001) return null;
        if (me && f >= b(T.fly)) return null; // Sami's bubble is flying (drawn by SamiFly)
        const p = CAST[WHO[j]];
        const y = ROW_Y[j];
        return (
          <React.Fragment key={j}>
            <At x={me ? AX_R : AX_L} y={y}>
              <Avatar shape={p.shape} color={p.color} size={AV * s} initial={p.name[0]} cream={p.cream} />
            </At>
            <div style={{...bubbleStyle(me), top: y - 46, left: me ? undefined : AX_L + AV / 2 + 18, right: me ? AD_W - (AX_R - AV / 2 - 18) : undefined,
              transformOrigin: me ? '100% 50%' : '0% 50%', transform: `scale(${s})`}}>{m}</div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Sami's "I've got a game." leaves the chat and dives into the middle of the TV screen. */
const SamiFly: React.FC<{f: number}> = ({f}) => {
  const a = b(T.fly), z = b(T.flood);
  if (f < a || f >= z) return null;
  const t = prog(f, a, z, easeInOut);
  const w0 = 470; // approx. bubble width
  const x0 = AX_R - AV / 2 - 18 - w0 / 2, y0 = ROW_Y[3];
  const tv = tvAt(f);
  const x = lerp(x0, tv.x, t), y = lerp(y0, tv.y, t) - Math.sin(Math.PI * t) * 120;
  const s = lerp(1, 0.25, easeIn(t));
  return (
    <At x={x} y={y} z={40}>
      <div style={{...bubbleStyle(true), left: -w0 / 2, top: -46, width: w0, padding: 0, justifyContent: 'center', transform: `scale(${s})`}}>{MSG[3]}</div>
    </At>
  );
};

// ---------------------------------------------------------------- 2. OUT stamp -> amber flood -> "Saturday, sorted." plate
const SP = tvPt(TV_A, STAMP_L.x, STAMP_L.y);
const PF = b(T.pFlood);
const FF2 = Math.round(PF) + FLOOD;
const PLATE = {x: SAFE_CX, y: 900, w: 820, h: 330};

const Stamp: React.FC<{f: number}> = ({f}) => {
  const t0 = b(T.stamp);
  if (f < t0 - 6 || f >= FF2 + 2) return null;
  const w0 = STAMP_L.w * SC, h0 = STAMP_L.h * SC;
  const slam = f < t0 ? lerp(1.8, 1, easeIn(prog(f, t0 - 6, t0, (x) => x))) : 1 + 0.06 * (1 - spr(f, t0, POP));
  const e = prog(f, PF, FF2, easeIn);
  const R = farthest(SP.x, SP.y);
  const w = lerp(w0, 2 * R, e), h = lerp(h0, 2 * R, e);
  const textS = 1 - e;
  return (
    <At x={SP.x} y={SP.y} z={60}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: lerp(h0 * 0.22, R, e), background: C.accent,
        transform: `rotate(${lerp(-8, 0, e)}deg) scale(${slam})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        border: e < 0.6 ? `${h0 * 0.07 * (1 - e / 0.6)}px solid ${C.ink}` : undefined,
        boxShadow: e < 0.1 ? `0 ${h0 * 0.15}px ${h0 * 0.4}px rgba(10,4,20,0.45)` : undefined}}>
        {textS > 0.02 ? (
          <span style={{fontFamily: FONT, fontWeight: 900, fontSize: h0 * 0.72 * textS + 0.01, lineHeight: 1, color: C.ink, letterSpacing: '0.06em'}}>OUT</span>
        ) : null}
      </div>
    </At>
  );
};

const Payoff: React.FC<{f: number}> = ({f}) => {
  if (f < FF2) return null;
  // full amber holds 2 frames, then contracts into the plate (corners clear within ~6 frames: flash <= 10 frames)
  const c = spr(f, FF2 + 2, {damping: 18, stiffness: 150});
  const R = farthest(PLATE.x, PLATE.y);
  const w = lerp(2 * R, PLATE.w, c), h = lerp(2 * R, PLATE.h, c);
  const bumpAt = b(T.crew + 1.5);
  const bump = f >= bumpAt ? 1 + 0.05 * Math.sin(Math.PI * clamp((f - bumpAt) / 14)) : 1;
  return (
    <>
      <At x={PLATE.x} y={PLATE.y} z={70}>
        <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: lerp(R, 48, c), background: C.accent,
          transform: `rotate(${-3 * clamp(c)}deg) scale(${bump})`, boxShadow: c > 0.5 ? '0 24px 60px rgba(10,4,20,0.4)' : undefined,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT, fontWeight: 900, fontSize: 112, lineHeight: 1.12, color: C.ink, letterSpacing: '-0.01em'}}>
          <Rise f={f} start={b(T.sat)} cfg={TEXT} pad={0.1}>Saturday,</Rise>
          <Rise f={f} start={b(T.sat) + 5} cfg={TEXT} pad={0.1}>sorted.</Rise>
        </div>
      </At>
      {CAST.map((p, i) => {
        const at = b(T.crew) + i * 3;
        const s = spr(f, at, POP);
        if (s <= 0.001) return null;
        const hopT = bumpAt + i * 2;
        const hop = f > hopT && f < hopT + 16 ? 30 * Math.sin(Math.PI * ((f - hopT) / 16)) : 0;
        return (
          <At key={i} x={SAFE_CX + (i - 2) * 168} y={1250 - hop} z={71}>
            <Avatar shape={p.shape} color={p.color} size={120} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${s})`}} />
          </At>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- body
/** 2-frame, 6 px shake when the stamp lands. */
const shake = (f: number) => {
  const k = Math.round(f - b(T.stamp));
  return k === 0 ? [6, -4] : k === 1 ? [-4, 3] : [0, 0];
};

const CAP_Y = 322;
type Cap = {text: string; vo: string; start: number; end: number; size?: 84 | 96; accent?: string; voDur: number};
/** Captions = VO lines, word for word (uiux.md §3.3). Holds checked against holdFrames() (see M5_CAPTION_HOLDS). */
const CAPS: Cap[] = [
  {text: 'Nothing to do *tonight?*', vo: 'Nothing to do tonight?', start: -b(1.5), end: b(4.0), size: 96, voDur: 108},
  {text: 'Put a game on the *TV.*', vo: 'Put a game on the TV.', start: b(4.1), end: b(8.9), voDur: 138},
  {text: 'Everyone scans. *No\u00A0app.*', vo: 'Everyone scans. No app.', start: b(9.0), end: b(13.0), accent: C.primary, voDur: 100},
  {text: 'Everyone’s word is *PIZZA…*', vo: 'Everyone’s word is pizza…', start: b(13.25), end: b(16.9), voDur: 100},
  {text: '…except *Sami’s.*', vo: '…except Sami’s.', start: b(17.1), end: b(20.9), size: 96, voDur: 72},
  {text: 'One clue each. *Who’s\u00A0off?*', vo: 'One clue each. Who’s off?', start: b(21.1), end: b(25.3), voDur: 120},
  {text: 'Vote. *Caught* him.', vo: 'Vote. Caught him.', start: b(26.25), end: b(30.0), size: 96, voDur: 96},
];

export const M5Body: React.FC = () => {
  const f = useCurrentFrame();
  const [sx, sy] = shake(f);
  const scene = f < FF2;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {scene ? (
        <div style={{position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px)`}}>
          <TvFrame r={tvAt(f)}>
            <HomeScreen f={f} />
            <ScreenFlood f={f} />
            <Lobby f={f} />
            <LookScreen f={f} />
            <VoteBoard f={f} />
          </TvFrame>
          <Chat f={f} />
          <SamiFly f={f} />
          <Phones f={f} />
          <Clues f={f} />
          <Votes f={f} />
        </div>
      ) : null}
      <Stamp f={f} />
      <Payoff f={f} />
      {CAPS.map((c, i) => (
        <AdCaption key={i} f={f} text={c.text} y={CAP_Y} size={c.size ?? 84} start={c.start} end={c.end} step={b(0.08)} accent={c.accent} />
      ))}
      <BgFlood f={f} start={END} x={PLATE.x} y={PLATE.y} />
    </div>
  );
};

// ---------------------------------------------------------------- VO (uiux.md §3.3; the end-card line is not part of the body)
export const M5_VO: VoLine[] = [
  ...CAPS.map((c, i): VoLine => ({at: Math.max(0, Math.round(c.start)), dur: c.voDur, src: `vo/m5-en-${String(i + 1).padStart(2, '0')}.mp3`})),
  {at: Math.round(b(T.sat)), dur: 66, src: 'vo/m5-en-08.mp3'}, // "Saturday, sorted."
];

/** On-screen seconds per caption (from frame 0 for the pre-settled hook), for the hold check. */
export const M5_CAPTION_HOLDS = [
  ...CAPS.map((c) => ({text: c.vo, s: +((c.end - Math.max(0, c.start)) / 60).toFixed(2)})),
  {text: 'Saturday, sorted.', s: +((END - b(T.sat)) / 60).toFixed(2)},
];

// ---------------------------------------------------------------- sound (<= 1 SFX moment per beat)
export const M5_HITS: Hit[] = [
  {at: 2, sfx: 'bass_hit', vol: 0.7, max: 50},
  {at: b(T.chat[2]), sfx: 'pop_a', vol: 0.6},
  {at: b(T.chat[3]), sfx: 'pop_hard', vol: 0.55},
  {at: b(T.flood) + 10, sfx: 'whoosh_fast', vol: 0.45},
  {at: FF1 + 16, sfx: 'pop_b', vol: 0.5},
  {at: b(T.code), sfx: 'tick', vol: 0.4, max: 20},
  {at: b(T.rise + 0.6), sfx: 'swoosh_short', vol: 0.4, max: 50},
  {at: b(T.join[0]), sfx: 'pop_a', vol: 0.6},
  {at: b(T.join[2]), sfx: 'pop_b', vol: 0.6},
  {at: b(T.join[4]), sfx: 'pop_a', vol: 0.6},
  {at: b(T.grow + 0.5), sfx: 'whoosh_fast', vol: 0.35},
  {at: b(T.flip[0]), sfx: 'pop_b', vol: 0.55},
  {at: b(T.hero + 0.6), sfx: 'swoosh_short', vol: 0.4, max: 50},
  {at: b(T.moleFlip), sfx: 'wrong', vol: 0.45, max: 60},
  {at: b(T.moleFlip), sfx: 'bass_hit', vol: 0.6, max: 45},
  {at: b(T.row + 0.4), sfx: 'whoosh_fast', vol: 0.35},
  {at: b(T.clue[0]), sfx: 'pop_a', vol: 0.6},
  {at: b(T.clue[2]), sfx: 'pop_b', vol: 0.6},
  {at: b(T.clue[4]), sfx: 'pop_hard', vol: 0.55},
  {at: b(T.vote), sfx: 'click', vol: 0.7},
  {at: b(T.land), sfx: 'bass_hit', vol: 0.55, max: 35},
  {at: b(T.stamp), sfx: 'stamp', vol: 1},
  {at: b(T.stamp), sfx: 'impact_drop', vol: 0.45, max: 110},
  {at: PF + 14, sfx: 'whoosh_fast', vol: 0.4},
  {at: b(T.sat), sfx: 'sparkle', vol: 0.65},
  {at: b(T.crew + 1.5), sfx: 'pop_b', vol: 0.4},
  {at: END + 18, sfx: 'swoosh_short', vol: 0.35, max: 50},
];
