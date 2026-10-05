import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C} from '../brand';
import {FONT} from '../parts';
import {b, mix, POP, spr} from '../time';
import {AdCaption, BgFlood, Hit, SAFE, SAFE_CX, VoLine} from './common';
import {Beams, Clues, Couch, Flash, Phones, Stamp, T, Tv, Votes, WhereChips} from './m2-stage';

/**
 * MA-E-M2 "How it works in 15 seconds" (review-v2/uiux.md change 13 + §3.4, DECISIONS.md #12). VO-first explainer that
 * teaches the game to someone who has never played it, in order, one step per caption:
 *   hook (friends in front of the TV, an amber ring hops between them) -> 1 open it on the TV (lobby, browser now /
 *   Google TV soon) -> 2 everyone scans, no app -> 3 secret word: the camera tilts down to five phones, PIZZA x4 then
 *   PASTA, the Mole pointed out outside his phone -> 4 one-word clues on the beat -> 5 vote on the phones -> the TV
 *   stamps OUT, "Sami was the Mole" -> background floods into the end card.
 * Captions = VO lines word for word (VO_ENABLED is off for now; captions carry the story).
 */
export const M2_BODY_FRAMES = Math.round(b(41.5));

const CAP_Y = 400;

// [text, start beat, end beat, size, key]
type Cap = {text: string; vo: string; s: number; e?: number; size: 84 | 96};
const CAPS: Cap[] = [
  {text: 'One of you is *lying.*', vo: 'One of you is lying.', s: -1.2, e: 4.25, size: 96},
  {text: 'Open the game on your *TV.*', vo: 'Open the game on your TV.', s: 4.5, e: 9.5, size: 84},
  {text: 'Everyone scans with their phone. *No* *app.*', vo: 'Everyone scans with their phone. No app.', s: 9.75, e: 15.75, size: 84},
  {text: 'Everyone gets a *secret* *word.*', vo: 'Everyone gets a secret word.', s: 16, e: 20.25, size: 84},
  {text: 'The Mole’s is different. *He* *doesn’t* *know.*', vo: 'The Mole’s is different. He doesn’t know.', s: 20.5, e: 26.5, size: 84},
  {text: 'Everyone gives a *one-word* *clue.*', vo: 'Everyone gives a one-word clue.', s: 26.75, e: 32.25, size: 84},
  {text: 'Vote on your *phones.*', vo: 'Vote on your phones.', s: 32.5, e: 36.05, size: 84},
  {text: 'Sami was the *Mole.*', vo: 'Sami was the Mole.', s: 37.5, size: 96},
];

/** VO: one file per caption line, starting 4 frames after the caption, ≤ 2.5 words/s ("one-word" is spoken as 2). */
const words = (s: string) => s.replace(/-/g, ' ').split(/\s+/).filter(Boolean).length;
export const M2_VO: VoLine[] = CAPS.map((c, i) => ({
  at: Math.max(4, Math.round(b(c.s)) + 4),
  dur: Math.round((words(c.vo) / 2.5) * 60),
  src: `vo/m2-en-${String(i + 1).padStart(2, '0')}.mp3`,
}));

// ---------------------------------------------------------------- step rail (top right, on the brand chip's row)
const STEPS = [T.lobby, 9.75, 16, 26.75, 32.5];
const StepRail: React.FC<{f: number}> = ({f}) => {
  const k = spr(f, b(T.lobby) - 4, POP);
  if (k <= 0.001) return null;
  const done = f >= b(T.stamp);
  const active = STEPS.filter((s) => f >= b(s)).length - 1;
  const D = 40, G = 12;
  return (
    <div style={{position: 'absolute', right: 1080 - SAFE.right, top: SAFE.top + 14, display: 'flex', gap: G, zIndex: 96, transform: `scale(${k})`, transformOrigin: '100% 50%'}}>
      {STEPS.map((s, i) => {
        const on = i === active && !done;
        const past = i < active || done;
        const pop = on ? 1 + 0.18 * (spr(f, b(s), POP) - spr(f, b(s) + 8, POP)) : 1;
        return (
          <div key={i} style={{width: D, height: D, borderRadius: 99, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT, fontWeight: 900, fontSize: 24, lineHeight: 1, transform: `scale(${pop})`,
            background: on ? C.accent : past ? mix(C.text, C.accent, 0.15) : 'rgba(20,9,40,0.55)',
            color: on || past ? C.ink : C.text2, boxShadow: on || past ? '0 4px 14px rgba(10,4,20,0.35)' : 'inset 0 0 0 2px rgba(255,247,236,0.28)'}}>
            {i + 1}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- body

export const M2Body: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <Tv f={f} />
      <WhereChips f={f} />
      <Couch f={f} />
      <Beams f={f} />
      <Phones f={f} />
      <Clues f={f} />
      <Votes f={f} />
      {CAPS.map((c, i) => (
        <AdCaption key={i} f={f} text={c.text} y={CAP_Y} size={c.size} start={b(c.s)} end={c.e === undefined ? undefined : b(c.e)} step={b(0.08)} />
      ))}
      <StepRail f={f} />
      <Flash f={f} />
      <Stamp f={f} />
      <BgFlood f={f} start={M2_BODY_FRAMES - 22} x={SAFE_CX} y={1640} />
    </div>
  );
};

// ---------------------------------------------------------------- sound (≤ 1 SFX per beat)
export const M2_HITS: Hit[] = [
  ...T.hop.map((h): Hit => ({at: b(h), sfx: 'tick', vol: 0.35, max: 20})),
  {at: b(T.lobby), sfx: 'swoosh_short', vol: 0.35, max: 50},
  {at: b(T.chips[0]), sfx: 'pop_a'},
  {at: b(T.chips[1]), sfx: 'pop_b'},
  {at: b(T.code) + 4, sfx: 'pop_a'},
  {at: b(T.toRoom) + 10, sfx: 'swoosh_short', vol: 0.3, max: 50},
  ...T.join.map((j): Hit => ({at: b(j), sfx: 'pop_b', vol: 0.45})),
  {at: b(T.toGrid + 0.85), sfx: 'whoosh_fast', vol: 0.35},
  ...[T.flip[0], T.flip[1], T.flip[3], T.flip[4]].map((x): Hit => ({at: b(x), sfx: 'pop_a'})),
  {at: b(T.pasta), sfx: 'bass_hit', vol: 0.6, max: 50},
  {at: b(T.tag), sfx: 'pop_hard', vol: 0.45, max: 50},
  {at: b(T.toRoom2 + 0.85), sfx: 'whoosh_fast', vol: 0.3},
  ...[0, 1, 3, 4].map((i): Hit => ({at: b(T.clue[i]), sfx: i % 2 ? 'pop_b' : 'pop_a'})),
  {at: b(T.clue[2]), sfx: 'pop_hard', vol: 0.45, max: 50},
  {at: b(T.tap[0]), sfx: 'click', vol: 0.6},
  {at: b(T.tap[3]), sfx: 'click', vol: 0.6},
  {at: b(T.tap[2]), sfx: 'click', vol: 0.6},
  {at: b(T.stamp), sfx: 'stamp', vol: 0.85},
  {at: b(T.result), sfx: 'sparkle', vol: 0.5},
  {at: M2_BODY_FRAMES - 4, sfx: 'swoosh_short', vol: 0.3, max: 50},
];
