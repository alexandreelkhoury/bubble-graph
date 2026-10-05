import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, PLAYERS} from '../brand';
import {At, FONT, PhoneFrame, Rise, WordFace} from '../parts';
import {b, easeIn, easeInOut, easeOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AdCaption, BgFlood, Hit, SAFE_CX, VoLine} from './common';
import {Clue, Tile, Tv, VoteFace} from './m1-parts';

/**
 * MA_A_M1 "Everyone's word is PIZZA" (angle A, the reveal) — v2: 31 beats (15.0 s) + the 5.9 s end card.
 * Story, one idea per card: everyone has PIZZA (TV + phones in frame 0) → except his (Sami, aqua, ringed from
 * outside his phone) → he doesn't know → the phones drop into the TV as tiles → one clue each → "…Fork?" →
 * vote on your phones → OUT + one magenta flash → "IT WAS YOU?!" / "Sami was the Mole".
 */
export const M1_BODY_FRAMES = Math.round(b(31));

// Five players: Maya, Karim, Lea, Joe, Sami (Sami is the Mole: PASTA).
const CAST = [0, 1, 2, 3, 5].map((i) => PLAYERS[i]);
const MOLE = 4;
const CLUES = ['Cheese', 'Oven', 'Slice', 'Delivery', '…Fork?'];

// ---- timeline (beats; 1 beat = 0.485 s) ----
const FLIP = 3.85; // Sami's card turns over: PASTA
const KNOW = 7.75; // "And he doesn't know."
const MORPH = 11.3; // phones drop into the TV as tiles (TV zooms to fill the frame)
const CLUE_AT = [12.7, 13.95, 15.2, 16.45, 17.9];
const CLUE_OUT = 21.0;
const PHONE_IN = 21.2, TAP = 22.2, PHONE_OUT = 25.0;
const VOTE_LAND = [23.2, 23.7, 24.2, 24.7]; // Maya (from her phone), Karim, Lea, Joe
const STAMP = 25.7;
const LINE = 26.5; // "Sami was the Mole"
const FLOOD_OUT = M1_BODY_FRAMES - 22;
const S = b(STAMP);

// ---- layout ----
type Ph = {x: number; y: number; rot: number; s: number};
const PW = 260, PH = PW / 0.48;
// fanned 3 + 2, the Mole's phone in front (1.18×)
const PHONES: Ph[] = [
  {x: SAFE_CX - 292, y: 912, rot: -8, s: 1}, {x: SAFE_CX, y: 884, rot: 0, s: 1}, {x: SAFE_CX + 292, y: 912, rot: 8, s: 1},
  {x: SAFE_CX - 160, y: 1300, rot: -5, s: 1}, {x: SAFE_CX + 160, y: 1282, rot: 6, s: 1.18},
];
const Z_ORDER = [10, 11, 10, 12, 14];
// TV: small behind the phones in the hook, then the stage (zoom 1: screen overflows the frame left/right)
const TV_HOOK = {cx: SAFE_CX, cy: 545, z: 0.48};
const TV_STAGE = {cx: SAFE_CX, cy: 975, z: 1};
// tiles in TV coordinates (offset from the screen centre at zoom 1 = screen px on the stage)
const TW = 280, TH = 310;
const TILE_OFF = [{x: -300, y: -185}, {x: 0, y: -185}, {x: 300, y: -185}, {x: -150, y: 185}, {x: 150, y: 185}];

const tvAt = (f: number) => {
  const t = prog(f, b(MORPH), b(MORPH + 1.0) + 8, easeInOut);
  return {cx: lerp(TV_HOOK.cx, TV_STAGE.cx, t), cy: lerp(TV_HOOK.cy, TV_STAGE.cy, t), z: lerp(TV_HOOK.z, TV_STAGE.z, t)};
};
const tileAt = (f: number, i: number) => {
  const tv = tvAt(f);
  return {x: tv.cx + TILE_OFF[i].x * tv.z, y: tv.cy + TILE_OFF[i].y * tv.z, w: TW * tv.z, h: TH * tv.z};
};
const SAMI_T = {x: TV_STAGE.cx + TILE_OFF[MOLE].x, y: TV_STAGE.cy + TILE_OFF[MOLE].y};

export const M1_HITS: Hit[] = [
  {at: b(FLIP + 0.05), sfx: 'wrong', vol: 0.45, max: 50},
  {at: b(KNOW), sfx: 'swoosh_short', vol: 0.35},
  {at: b(MORPH + 0.3), sfx: 'whoosh_fast', vol: 0.35},
  ...CLUE_AT.slice(0, 4).map((t, i) => ({at: b(t), sfx: (i % 2 ? 'pop_b' : 'pop_a') as 'pop_a' | 'pop_b', vol: 0.45})),
  {at: b(CLUE_AT[4]), sfx: 'pop_hard', vol: 0.45},
  {at: b(PHONE_IN + 0.15), sfx: 'swoosh_short', vol: 0.4},
  {at: b(TAP), sfx: 'click', vol: 0.6},
  {at: b(VOTE_LAND[0]), sfx: 'bass_hit', vol: 0.6, max: 40},
  {at: b(VOTE_LAND[3]), sfx: 'bass_hit', vol: 0.6, max: 40},
  {at: S, sfx: 'stamp', vol: 1},
  {at: b(LINE + 0.4), sfx: 'sparkle', vol: 0.45},
];

/** VO (review-v2/uiux.md §3.1), each line also a caption with the same words. Off while VO_ENABLED = false. */
export const M1_VO: VoLine[] = [
  {at: 8, dur: 96, src: 'vo/m1-en-01.mp3'}, // Everyone's word is pizza.
  {at: Math.round(b(FLIP + 0.1)), dur: 54, src: 'vo/m1-en-02.mp3'}, // Except his.
  {at: Math.round(b(KNOW + 0.1)), dur: 100, src: 'vo/m1-en-03.mp3'}, // And he doesn't know.
  {at: Math.round(b(MORPH + 0.5)), dur: 76, src: 'vo/m1-en-04.mp3'}, // One clue each.
  {at: Math.round(b(CLUE_AT[4] + 0.15)), dur: 66, src: 'vo/m1-en-05.mp3'}, // Wait… fork?
  {at: Math.round(b(PHONE_IN + 0.5)), dur: 100, src: 'vo/m1-en-06.mp3'}, // Vote on your phones.
  {at: Math.round(S + 14), dur: 72, src: 'vo/m1-en-07.mp3'}, // It was you?!
];

/** Captions: [text, start, end, size, y]. Every end − start respects holdFrames() (checked in the report). */
const CAPS: Array<{text: string; start: number; end?: number; size: 84 | 96; y: number; accent?: string}> = [
  {text: 'Everyone’s word is *PIZZA.*', start: -b(1), end: b(3.8), size: 96, y: 420, accent: C.primary},
  {text: 'Except *his.*', start: b(3.95), end: b(7.7), size: 96, y: 420},
  {text: 'And he *doesn’t know.*', start: b(7.8), end: b(11.55), size: 96, y: 420},
  {text: 'One clue *each.*', start: b(11.75), end: b(17.6), size: 84, y: 300},
  {text: 'Wait… *fork?*', start: b(18.0), end: b(21.4), size: 96, y: 300},
  {text: 'Vote on your *phones.*', start: b(21.6), end: b(25.3), size: 84, y: 300},
  {text: 'IT WAS *YOU?!*', start: S + 10, size: 96, y: 300},
];

/** One phone → tile: rect, rotation, morph progress. */
const card = (f: number, i: number) => {
  const p = PHONES[i];
  const m = prog(f, b(MORPH) + i * 2, b(MORPH + 0.95) + i * 2, easeInOut);
  const t = tileAt(f, i);
  const w = lerp(PW * p.s, t.w, m), h = lerp(PH * p.s, t.h, m);
  return {x: lerp(p.x, t.x, m), y: lerp(p.y, t.y, m), w, h, rot: lerp(p.rot, 0, m), m};
};

export const M1Body: React.FC = () => {
  const f = useCurrentFrame();
  const tv = tvAt(f);

  // camera: a punch on "…Fork?", a 6 px shake on the stamp, then one slow push towards Sami
  const punch = 0.035 * (spr(f, b(CLUE_AT[4]), POP) - spr(f, b(CLUE_AT[4]) + 14, SOFT));
  const push = prog(f, b(STAMP + 0.6), FLOOD_OUT, easeInOut);
  const cz = 1 + punch + 0.06 * push;
  const focus = 0.35 * push + punch * 6;
  const cx = lerp(SAFE_CX, SAMI_T.x, focus), cy = lerp(960, SAMI_T.y, focus);
  const shake = f >= S && f < S + 3 ? (f - S === 1 ? -6 : 6) : 0;

  // the reveal
  const grow = 1 + 0.12 * spr(f, b(STAMP - 0.4), SOFT);
  const desat = prog(f, b(STAMP - 0.4), b(STAMP + 0.2));
  const tileRing = prog(f, b(VOTE_LAND[0]), b(VOTE_LAND[0]) + 8, easeOut);

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0',
        transform: `translate(${SAFE_CX + shake}px, 960px) scale(${cz}) translate(${-cx}px, ${-cy}px)`}}>
        <Tv cx={tv.cx} cy={tv.cy} z={tv.z} />

        {CAST.map((pl, i) => {
          const {x, y, w, h, rot, m} = card(f, i);
          const mole = i === MOLE;
          // hook: Sami's card turns, ring around his phone (outside it), wobble; the others lean towards him
          const ring = mole ? prog(f, b(FLIP + 0.1), b(FLIP + 0.1) + 10, easeOut) * (1 - m) : 0;
          const since = f - b(FLIP + 0.1);
          const wob = mole && since > 0 ? Math.sin(since * 0.45) * 5 * Math.exp(-since / 16) : 0;
          const bob = mole ? Math.sin((f - b(KNOW)) * 0.11) * 3 * prog(f, b(KNOW), b(KNOW + 1)) * (1 - m) : 0;
          const lean = !mole ? (Math.sign(PHONES[MOLE].x - PHONES[i].x) || 1) * 5 * spr(f, b(KNOW), SOFT) * (1 - m) : 0;
          // clue round: everyone turns to Sami on "…Fork?"
          const look = !mole && m >= 1 ? (Math.sign(SAMI_T.x - (TV_STAGE.cx + TILE_OFF[i].x)) || 1) * 7 * (spr(f, b(CLUE_AT[4] + 0.3), SOFT) - spr(f, b(CLUE_OUT), SOFT)) : 0;
          const scl = mole && m >= 1 ? grow : 1;
          const sat = !mole ? 1 - 0.55 * desat : 1;
          const t = Math.max(3, w * 0.035) * (1 - prog(f, b(MORPH) + i * 2, b(MORPH + 0.4) + i * 2));
          return (
            <At key={i} x={x} y={y + bob} z={Z_ORDER[i] + (mole ? 10 : 0) * (m >= 1 ? 1 : 0)}
              style={{opacity: !mole ? 1 - 0.15 * desat : 1}}>
              <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${rot + wob + lean + look}deg) scale(${scl})`}}>
                {m < 1 ? (
                  <>
                    {ring > 0 ? (
                      <div style={{position: 'absolute', left: -w / 2 - t - 16, top: -h / 2 - t - 16, width: w + 2 * t + 32, height: h + 2 * t + 32,
                        borderRadius: w * 0.14 + t + 16, border: `8px solid ${C.accent}`, opacity: ring, transform: `scale(${0.94 + 0.06 * ring})`,
                        boxShadow: `0 0 60px rgba(255,201,77,${0.6 * ring}), inset 0 0 30px rgba(255,201,77,${0.3 * ring})`}} />
                    ) : null}
                    <PhoneFrame w={w} h={h} bezel={t / Math.max(3, w * 0.035)} screen={mix('#0F0820', '#4A2E7A', m)} island={m < 0.2}>
                      {m < 0.4 ? (
                        <WordFace f={f} w={w} h={h} name={pl.name} shape={pl.shape} color={pl.color} cream={pl.cream} word={pl.word}
                          flipAt={mole ? b(FLIP) : -60 - i * 6} out={b(MORPH) + 9} />
                      ) : null}
                      {m > 0.3 ? <div style={{position: 'absolute', left: w / 2, top: h / 2}}><Tile f={f} p={pl} w={w} h={h} inAt={b(MORPH) + 4 + i * 2} /></div> : null}
                    </PhoneFrame>
                    {/* rim light so the phones separate from the TV and the background */}
                    <div style={{position: 'absolute', left: -w / 2 - t, top: -h / 2 - t, width: w + 2 * t, height: h + 2 * t, borderRadius: w * 0.14 + t,
                      boxShadow: `0 0 0 2px rgba(255,247,236,${0.28 * (1 - m)})`}} />
                  </>
                ) : (
                  <Tile f={f} p={pl} w={w} h={h} inAt={b(MORPH) + 4 + i * 2} ring={mole ? tileRing : 0} sat={sat} />
                )}
              </div>
            </At>
          );
        })}

        {/* clue bubbles (screen space, 56 px; the Mole's is amber and bigger) */}
        {CAST.map((pl, i) => {
          const s = spr(f, b(CLUE_AT[i]), POP) - spr(f, b(CLUE_OUT) + i * 2, {damping: 26, stiffness: 300});
          const down = TILE_OFF[i].y > 0;
          const ty = TV_STAGE.cy + TILE_OFF[i].y + (down ? TH / 2 + 12 : -TH / 2 - 12);
          return s > 0.001 ? (
            <At key={`c${i}`} x={TV_STAGE.cx + TILE_OFF[i].x} y={ty} z={40}>
              <Clue text={CLUES[i]} s={Math.max(0, s)} size={i === MOLE ? 62 : 56} amber={i === MOLE} down={down} />
            </At>
          ) : null;
        })}

        {/* votes: Maya's from her phone, the others from their tiles; they land on Sami's tile */}
        {VOTE_LAND.map((land, i) => {
          const t1 = b(land), t0 = t1 - b(0.65);
          if (f < t0 || f > S + 4) return null;
          const from = i === 0 ? {x: PHONE.x + 70, y: PHONE.y - 150} : {x: TV_STAGE.cx + TILE_OFF[i].x, y: TV_STAGE.cy + TILE_OFF[i].y - 40};
          const to = {x: SAMI_T.x + (i - 1.5) * 62, y: SAMI_T.y - TH / 2 + 8};
          const t = prog(f, t0, t1, easeInOut);
          const x = lerp(from.x, to.x, t), y = lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * 200;
          const k = f >= t1 ? 1 + 0.35 * (1 - spr(f, t1, POP)) : 1;
          return (
            <At key={`v${i}`} x={x} y={y} z={45}>
              <div style={{position: 'absolute', left: -28, top: -28, width: 56, height: 56, borderRadius: 99, background: CAST[i].color,
                border: `5px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${k})`, boxShadow: '0 6px 16px rgba(14,6,28,0.45)'}} />
            </At>
          );
        })}

        {/* the vote phone (Maya's): voting happens on phones */}
        <VotePhone f={f} />

        {/* "Sami was the Mole" on the TV, screen-space 80 px */}
        <div style={{position: 'absolute', left: 60, width: 900, top: 1352, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 80, color: C.accent,
          lineHeight: 1.1, zIndex: 50, textShadow: '0 4px 18px rgba(14,6,28,0.7)', letterSpacing: '-0.01em'}}>
          <Rise f={f} start={b(LINE)}>Sami was the Mole</Rise>
        </div>

        {/* the one full-screen colour flash: magenta, full for 6 frames, then irises into Sami's tile (under the stamp) */}
        <Flash f={f} />

        {/* OUT stamp: 1.6× the tile width, −8°, above everything */}
        {f >= S - 6 ? (
          <At x={SAMI_T.x + 36} y={SAMI_T.y + 92} z={80}>
            <div style={{position: 'absolute', left: -TW * 0.8, top: -84, width: TW * 1.6, height: 168, borderRadius: 30, background: C.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 116, color: C.ink, letterSpacing: '0.04em',
              boxShadow: '0 12px 30px rgba(0,0,0,0.4)', border: `5px solid ${C.ink}`, boxSizing: 'border-box',
              transform: `rotate(-8deg) scale(${f < S ? lerp(1.8, 1, easeIn(prog(f, S - 6, S, (v) => v))) : 1 + 0.08 * (1 - spr(f, S, POP))})`}}>
              OUT
            </div>
          </At>
        ) : null}
      </div>

      {CAPS.map((c, i) => (
        <AdCaption key={i} f={f} text={c.text} y={c.y} start={c.start} end={c.end} size={c.size} step={b(0.08)} accent={c.accent} />
      ))}
      <BgFlood f={f} start={FLOOD_OUT} x={SAMI_T.x} y={SAMI_T.y} />
    </div>
  );
};

const PHONE = {x: 236, y: 1690, w: 330};

const VotePhone: React.FC<{f: number}> = ({f}) => {
  if (f < b(PHONE_IN) || f > b(PHONE_OUT) + 30) return null;
  const k = spr(f, b(PHONE_IN), SNAPPY) - spr(f, b(PHONE_OUT), SNAPPY);
  const h = PHONE.w / 0.48;
  const tap = prog(f, b(TAP), b(TAP) + 8, easeOut);
  const cast = [CAST[1], CAST[4], CAST[2], CAST[3]]; // Karim, Sami, Lea, Joe (Maya can't vote for herself)
  return (
    <At x={PHONE.x} y={PHONE.y + (1 - k) * 760} z={60}>
      <div style={{position: 'absolute', left: 0, top: 0, transform: 'rotate(-7deg)'}}>
        <PhoneFrame w={PHONE.w} h={h} screen={C.bg}>
          <VoteFace w={PHONE.w} h={h} cast={cast} pick={1} tap={tap} />
        </PhoneFrame>
        <div style={{position: 'absolute', left: -PHONE.w / 2 - 12, top: -h / 2 - 12, width: PHONE.w + 24, height: h + 24, borderRadius: PHONE.w * 0.14 + 12,
          boxShadow: '0 0 0 2px rgba(255,247,236,0.28)'}} />
      </div>
    </At>
  );
};

const Flash: React.FC<{f: number}> = ({f}) => {
  if (f < S || f > S + 20) return null;
  // start exactly at the farthest corner and ease out, so the frame is full-bleed for 6 frames only (DECISIONS #7)
  const R = Math.hypot(Math.max(SAMI_T.x, 1080 - SAMI_T.x), Math.max(SAMI_T.y, 1920 - SAMI_T.y)) + 20;
  const r = f < S + 6 ? R : R * (1 - prog(f, S + 6, S + 20, easeOut));
  return <div style={{position: 'absolute', left: -200, top: -200, width: 1480, height: 2320, zIndex: 75, background: C.primary, clipPath: `circle(${r}px at ${SAMI_T.x + 200}px ${SAMI_T.y + 200}px)`}} />;
};
