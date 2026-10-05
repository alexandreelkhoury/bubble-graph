import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C} from '../brand';
import {At, WordFace} from '../parts';
import {b, clamp, easeIn, easeInOut, lerp, POP, prog, SOFT, spr} from '../time';
import {AD_H, AD_W, AdCaption, BgFlood, Hit, VoLine} from './common';
import {BODY_BEATS, BODY_FRAMES, CAP, CAST, END, FAN, FL, FLOOD, MOLE, Rect, ROW, SLOT, T, tileWorld} from './m4-grid';
import {Hook, hookToScreen, hookZ, LAND} from './m4-hook';
import {Clues, RoleLine, Stamp, tapTime, Tv, VoteFace, voteTarget, Votes} from './m4-tv';

/**
 * MA_B_M4 "Stop passing the phone" v2 (angle B, motion only, 32.9 beats ≈ 15.95 s + end card). Ad beat 0 = the drop.
 * Hook (pre-settled on frame 0, TV on the wall): five friends round a lit table pass ONE grey phone (b0.75–2.25), Joe
 * reads his word, Sami leans in and peeks (b3.1), Joe slams it face-down and shoves it into the middle (b4–5.25) ->
 * the ad's one magenta flood bursts out of it (b5.75, ≤ 10 f of full colour) and five phones of their own fly out of
 * it, already showing their player-colour word cards (no dark frames) -> PIZZA ×4 on the beat, then Sami's PASTA
 * (b10.5, pointed out only from outside: amber ring + caption) -> the phones drop into a row and a magenta line opens
 * into a 1:1 TV (b15.5) -> clues at 56 px, vote on the phones, votes fly to Sami's tile, OUT (b23.75), "Sami was the
 * Mole" at 78 px -> every phone shows its own word again: "Every player. Their own phone." -> flood into the end card.
 * Layout and beat grid: m4-grid.tsx; hook: m4-hook.tsx; TV, votes, stamp: m4-tv.tsx.
 */
export const M4_BODY_FRAMES = BODY_FRAMES;

const rl = (a: Rect, c: Rect, t: number): Rect => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});
const farthest = (x: number, y: number) => Math.hypot(Math.max(x, AD_W - x), Math.max(y, AD_H - y)) * 1.05;
const ORIGIN = hookToScreen(LAND, hookZ(FL));
const flipAt = (i: number) => b(T.flips[i]) + (i === 1 || i === 3 ? 4 : 0) - 6; // card face shows on the beat
const voteIn = (i: number) => b(T.vote) + SLOT[i] * 2;
const backIn = (i: number) => b(T.back) + SLOT[i] * 3;

/** The one full-frame colour beat: magenta bursts out of the dropped phone, holds ≤ 10 f, then a soft-edged hole opens. */
const Burst: React.FC<{f: number}> = ({f}) => {
  if (f < FL) return null;
  const R = farthest(ORIGIN.x, ORIGIN.y);
  const r = R * prog(f, FL, FL + FLOOD, easeIn);
  const H0 = b(T.hole);
  const hole = R * 1.08 * prog(f, H0, H0 + b(0.6), easeIn);
  if (hole >= R * 1.07) return null;
  const mask = hole > 0 ? `radial-gradient(circle at ${ORIGIN.x}px ${ORIGIN.y}px, transparent ${hole}px, black ${hole + 10}px)` : undefined;
  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 40, clipPath: `circle(${r}px at ${ORIGIN.x}px ${ORIGIN.y}px)`, background: C.primary,
      WebkitMaskImage: mask, maskImage: mask}} />
  );
};

/** Five phones of their own: fly out of the flood into a 3 + 2 fan, then drop into a row under the TV. */
const Phones: React.FC<{f: number}> = ({f}) => {
  if (f < b(T.pop) - 1) return null;
  const P = b(T.flips[MOLE]);
  return (
    <>
      {CAST.map((p, i) => {
        const mole = i === MOLE;
        const s = spr(f, b(T.pop) + i * 3, POP);
        if (s < 0.005) return null;
        const m = prog(f, b(T.shrink) + SLOT[i] * 2, b(T.shrink + 0.8) + SLOT[i] * 2, easeInOut);
        const r = rl(FAN[i], ROW[i], m);
        const x = lerp(ORIGIN.x, r.x, Math.min(1, s)), y = lerp(ORIGIN.y, r.y, Math.min(1, s));
        // little life: hop on the clue, kick on the vote tap, lean towards Sami after "Boiled?"
        const tap = tapTime(i);
        const kick = f > tap && f < tap + 12 ? 16 * Math.sin(Math.PI * ((f - tap) / 12)) : 0;
        const bk = backIn(i);
        const hop = f > bk && f < bk + 14 ? 18 * Math.sin(Math.PI * ((f - bk) / 14)) : 0;
        const lean = !mole ? (SLOT[i] < 2 ? 5 : -5) * (spr(f, b(T.glance), SOFT) - spr(f, b(T.vote), SOFT)) : 0;
        const wob = mole ? 6 * (spr(f, P, POP) - spr(f, P + 8, POP)) : 0;
        const ring = mole ? clamp(spr(f, P, POP) - spr(f, b(T.shrink) - 4, {damping: 26, stiffness: 300}) + spr(f, b(T.back) + 6, POP)) : 0;
        const bez = Math.max(4, r.w * 0.035);
        const gap = lerp(34, 16, m);
        const ow = r.w + 2 * bez, oh = r.h + 2 * bez, rad = r.w * 0.14;
        return (
          <At key={p.name} x={x} y={y - kick - hop} z={mole ? 31 : 30}>
            <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${s}) rotate(${wob + lean}deg)`}}>
              {/* colour glow behind each phone: keeps the frame lit */}
              <div style={{position: 'absolute', left: -r.h * 0.75, top: -r.h * 0.75, width: r.h * 1.5, height: r.h * 1.5, borderRadius: '50%',
                background: `radial-gradient(closest-side, ${p.color}55 0%, ${p.color}22 50%, ${p.color}00 100%)`}} />
              {ring > 0.01 ? (
                <div style={{position: 'absolute', left: -ow / 2 - gap * ring, top: -oh / 2 - gap * ring, width: ow + 2 * gap * ring, height: oh + 2 * gap * ring,
                  borderRadius: rad + bez + gap, boxShadow: `inset 0 0 0 ${lerp(8, 6, m)}px ${C.accent}, 0 0 40px rgba(255,201,77,${0.45 * ring})`, opacity: clamp(ring * 1.5)}} />
              ) : null}
              <div style={{position: 'absolute', left: -ow / 2, top: -oh / 2, width: ow, height: oh, borderRadius: rad + bez, background: '#0C0716',
                boxShadow: `0 ${r.w * 0.06}px ${r.w * 0.16}px rgba(0,0,0,0.35)`}}>
                <div style={{position: 'absolute', left: bez, top: bez, width: r.w, height: r.h, borderRadius: rad, overflow: 'hidden', background: C.bg}}>
                  <WordFace f={f} w={r.w} h={r.h} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={mole ? 'PASTA' : 'PIZZA'}
                    flipAt={flipAt(i)} out={voteIn(i)} />
                  <VoteFace f={f} w={r.w} h={r.h} self={i} target={voteTarget(i)} inAt={voteIn(i) + 3} tapAt={tap} outAt={bk} />
                  {f >= bk ? (
                    <WordFace f={f} w={r.w} h={r.h} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={mole ? 'PASTA' : 'PIZZA'}
                      flipAt={-999} contentIn={bk + 4} />
                  ) : null}
                  <div style={{position: 'absolute', left: '50%', top: r.h * 0.022, width: r.w * 0.3, height: r.w * 0.085, marginLeft: -r.w * 0.15,
                    borderRadius: 999, background: '#0C0716'}} />
                </div>
              </div>
            </div>
          </At>
        );
      })}
    </>
  );
};

/** Camera: one slow 5 % push in the last segment (from the verdict to the end card). */
const PUSH_O = {x: 510, y: 620};
const pushZ = (f: number) => 1 + 0.05 * prog(f, b(T.push), BODY_FRAMES, easeInOut);
const STAMP_W = tileWorld(MOLE);
const LAST = {x: PUSH_O.x + (STAMP_W.x - PUSH_O.x) * pushZ(END), y: PUSH_O.y + (STAMP_W.y - PUSH_O.y) * pushZ(END)};

const shake = (f: number) => {
  const k = Math.round(f - b(T.stamp));
  const j = Math.round(f - b(T.slide[1]));
  if (k >= 0 && k < 2) return [[6, -4], [-4, 3]][k];
  if (j >= 0 && j < 2) return [[0, 6], [0, -3]][j];
  return [0, 0];
};

export const M4Body: React.FC = () => {
  const f = useCurrentFrame();
  const [sx, sy] = shake(f);
  const z = pushZ(f);
  const cap = (k: keyof typeof CAP) => ({start: b(CAP[k][0]), end: CAP[k][1] >= BODY_BEATS ? undefined : b(CAP[k][1])});
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px)`}}>
        <Hook f={f} />
        <Burst f={f} />
        <div style={{position: 'absolute', inset: 0, zIndex: 45, transformOrigin: `${PUSH_O.x}px ${PUSH_O.y}px`, transform: `scale(${z})`}}>
          <Tv f={f} />
          <Phones f={f} />
          <Clues f={f} />
          <Votes f={f} />
          <Stamp f={f} />
          <RoleLine f={f} />
        </div>
      </div>

      {/* frame 0 = the thumbnail: the hook line is already up */}
      <AdCaption f={f} text="Still passing *one* phone?" y={360} {...cap("hook")} step={b(0.15)} size={96} accent={C.primary} />
      <AdCaption f={f} text="Someone *always* peeks." y={340} {...cap('peeks')} step={b(0.15)} size={84} />
      <AdCaption f={f} text="Your phone. *Your* *word.*" y={340} {...cap('own')} step={b(0.15)} size={84} accent={C.primary} />
      <AdCaption f={f} text="Sami’s is *PASTA.*" y={300} {...cap('pasta')} step={b(0.15)} size={84} />
      <AdCaption f={f} text="He doesn’t *know.*" y={400} {...cap('know')} step={b(0.15)} size={84} accent={C.primary} />
      <AdCaption f={f} text="The *TV* runs the game." y={340} {...cap('tv')} step={b(0.15)} size={84} accent={C.primary} />
      <AdCaption f={f} text="Vote on your *phones.*" y={340} {...cap('vote')} step={b(0.15)} size={84} />
      <AdCaption f={f} text="Every player. *Their* *own* phone." y={350} {...cap("pay")} step={b(0.15)} size={96} accent={C.primary} />
      <BgFlood f={f} start={END} x={LAST.x} y={LAST.y} />
    </div>
  );
};

// ---------------------------------------------------------------- voiceover (review-v2/uiux.md §3.2, = captions word for word)
export const M4_VO: VoLine[] = [
  {at: 6, dur: 102, src: 'vo/m4-en-01.mp3'}, // Still passing one phone?
  {at: Math.round(b(CAP.peeks[0])), dur: 80, src: 'vo/m4-en-02.mp3'}, // Someone always peeks.
  {at: Math.round(b(CAP.own[0])), dur: 102, src: 'vo/m4-en-03.mp3'}, // Your phone. Your word.
  {at: Math.round(b(CAP.pasta[0])), dur: 144, src: 'vo/m4-en-04.mp3'}, // Sami's is PASTA. He doesn't know.
  {at: Math.round(b(CAP.tv[0])), dur: 120, src: 'vo/m4-en-05.mp3'}, // The TV runs the game.
  {at: Math.round(b(CAP.vote[0])), dur: 102, src: 'vo/m4-en-06.mp3'}, // Vote on your phones.
  {at: Math.round(b(CAP.pay[0])), dur: 126, src: 'vo/m4-en-07.mp3'}, // Every player. Their own phone.
];

// ---------------------------------------------------------------- sound (≤ 1 SFX per beat)
export const M4_HITS: Hit[] = [
  {at: 2, sfx: 'bass_hit', vol: 0.6, max: 40},
  {at: b(T.pass[0]), sfx: 'whoosh_fast', vol: 0.32},
  {at: b(T.pass[2]), sfx: 'whoosh_fast', vol: 0.32},
  {at: b(T.peek), sfx: 'tick', vol: 0.5, max: 20},
  {at: b(T.slam), sfx: 'wrong', vol: 0.45, max: 60},
  {at: b(T.slide[1]), sfx: 'bass_hit', vol: 0.6, max: 40},
  {at: FL + FLOOD, sfx: 'whoosh_impact', vol: 0.5, max: 110},
  {at: b(T.flips[0]), sfx: 'pop_a'},
  {at: b(T.flips[2]), sfx: 'pop_b'},
  {at: b(T.flips[MOLE]), sfx: 'wrong', vol: 0.45, max: 60},
  {at: b(T.shrink + 0.4), sfx: 'whoosh_fast', vol: 0.3},
  {at: b(T.tvOn), sfx: 'click', vol: 0.7},
  {at: b(T.clues[0]), sfx: 'pop_a'},
  {at: b(T.clues[1]), sfx: 'pop_b'},
  {at: b(T.clues[2]), sfx: 'pop_hard'},
  {at: b(T.votes[0]), sfx: 'bass_hit', vol: 0.55, max: 40},
  {at: b(T.votes[2]), sfx: 'bass_hit', vol: 0.55, max: 40},
  // drumroll from b22.4, cut 2 frames before the stamp (its file peak is 3 s in, so `at` is shifted by it)
  {at: b(T.stamp - 1.45) + Math.round(3.006 * 60), sfx: 'drumroll', vol: 0.3, max: Math.round(b(T.stamp) - b(T.stamp - 1.45)) - 2},
  {at: b(T.stamp), sfx: 'stamp', vol: 1},
  {at: b(T.back), sfx: 'swoosh_short', vol: 0.35, max: 50},
  {at: b(CAP.pay[0]), sfx: 'pop_a'},
  {at: END + 14, sfx: 'whoosh_fast', vol: 0.32},
];
