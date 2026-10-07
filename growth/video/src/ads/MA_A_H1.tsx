import React from 'react';
import {AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import {C, Player} from '../brand';
import {At, Avatar, Bubble, FONT, PhoneFrame, Rise, WordFace} from '../parts';
import {easeIn, easeInOut, easeOut, FPS, lerp, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AdCaption, BgFlood, Hit, holdFrames, SAFE, SAFE_CX, VoLine} from './common';
import {Tile, Tv} from './m1-parts';

/**
 * MA_A_H1 "IT WAS YOU?!" — real-people cold open (Veo 3.1 footage, public/ai/, 1080×1920 @ 24 fps, 8 s, with audio)
 * + the real game UI (phones, OUT stamp, Mole card) in Remotion. VEO-PROMPTS.md §3.0–3.1, adapted to the v2 reading
 * rule (body 18.7 s + the 5.9 s end card).
 *
 * Clip picks (word times: faster-whisper small.en on trimmed segments + an RMS envelope; frames: 2 fps contact
 * sheets + gridded stills). "in/out" = source seconds.
 *
 * | clip            | video in–out      | audio in–out          | reason |
 * |-----------------|-------------------|-----------------------|--------|
 * | A_H1_shot01     | 2.15–3.95         | 0.00–1.10 + 3.25–3.95 | Her line "It was YOU?!" is spoken at 0.00–1.05 while she still sits deadpan (grey screen edge at the bottom); the lunge at the lens (2.15–3.7) is laughter. Opening on the lunge = a mid-motion first frame; her own line is re-timed onto it so "YOU" (0.38–1.04) lands on the wide-open mouth (2.5–3.2), then her real laugh. After 4 s she turns sideways / covers her face. |
 * | A_H1_shot02     | 0.00–1.00         | 0.00–0.95             | "Mish ana" = 0.00–0.52 (whisper: "Mishana"). Laptop edge bottom-left until ~1.3 s → 1.72× crop anchored top-right (visible x 42–100 %, y 0–58 %), never shows it. Cut before "Oh, come on" (1.04). |
 * | A_H1_shot02     | 1.00→0.00 (scrub, 1.1 s) | —                     | The "2 minutes earlier" rewind, same crop. |
 * | BODY_shot01     | 0.40–2.00         | 0.40–2.00             | Omar raises the phone to the TV, "I'm in." ≈1.1–1.3. At 4 s the camera jumps wide. |
 * | BODY_shot02     | 3.35–4.45         | 2.85–4.45 (J-cut)     | "Cheese" = 2.97–3.53 but a shoulder blur crosses 1.0–3.4: the video starts at 3.35 with a 1.4× crop anchored right, the word leads in under the phone grid. |
 * | BODY_shot03     | 3.00–4.10         | 3.00–4.10             | Second "Oven." = 3.22–3.86 (eyes wide). Grey bar on the bottom ~25 % → 1.4× crop anchored top. Pull-back at 5.5 s. |
 * | BODY_shot04     | 2.55–3.70         | 2.55–3.70             | "Fork" = 2.80–3.30 with the surprised look (Veo says "Fork," not "…Fork?": the bubble keeps the game's "…Fork?"). Hand blur only at 0–0.5. |
 * | BODY_shot05     | 3.90–5.80         | 3.90–5.80             | Lina: "It's Sami." = 4.02–5.02; Maya starts pointing ~5.8. "Obviously." (6.2–7.0) cut for length. |
 * | BODY_shot06     | 1.95–2.85         | 1.95–2.85             | Eruption after the orange light (1.0–1.7); "Woohoo!" from 2.56. Lina's floaty leap (2.5–4) kept short. Grey TV bar at the bottom → 1.15× crop anchored top. |
 * | A_H1_shot02     | 4.10–6.50 @ 0.8×  | 4.10–6.50 @ 1×        | PASTA payoff plate: Sami's guilty laugh, same living room (head-back at 6.5 cut). |
 * | A_H1_shot03     | — (not used)      | 1.20–3.40 @ 0.5 vol   | Video rejected: different room (flat pink studio wall, everyone standing, cool Lite light, a giant cushion). Its "No, no…" groan is used as the group's off-screen groan under the payoff. |
 */

// ---- timeline (body frames, 60 fps) ----
const S1 = 0; // Lina
const S2 = 108; // Sami "Mish ana!"
const RW = 168; // rewind
const SCAN = 234; // Omar scans the TV
const GRID = 330; // the 2×2 phone grid
const CLUE = [444, 510, 576]; // Lina / Omar / Sami
const VOTE = 645;
const UI = 759; // OUT → Mole card
const STAMP = UI + 9;
const FLIP = UI + 42;
const BOOM = 885; // the room explodes
const PAY = 939; // PASTA plate
export const MA_A_H1_BODY_FRAMES = 1124;
const FLOOD = MA_A_H1_BODY_FRAMES - 22;

// ---- cast (v2 colours: Sami is lilac) ----
const P = (name: string, color: string, shape: Player['shape'], word: string): Player => ({name, color, shape, cream: false, word, clue: ''});
const LINA = P('Lina', '#FFF04D', 'star', 'PIZZA');
const OMAR = P('Omar', '#5A9BFF', 'square', 'PIZZA');
const MAYA = P('Maya', '#FF3355', 'circle', 'PIZZA');
const SAMI = P('Sami', '#C9BFFF', 'hexagon', 'PASTA');
const MOLE_ORANGE = '#FF8A3D'; // web-client tokens.css --color-undercover

const ai = (n: string) => staticFile(`ai/${n}.mp4`);

/** One AI shot: muted video (the dialogue plays in MA_A_H1Audio, outside the motion blur), cover + per-clip crop. */
type Shot = {src: string; at: number; dur: number; from: number; scale: number; ox: number; oy: number; push?: number; rate?: number; filter?: string};
const SHOTS: Shot[] = [
  {src: 'A_H1_shot01', at: S1, dur: S2 - S1, from: 2.15, scale: 1.04, ox: 50, oy: 30, push: 0.08},
  {src: 'A_H1_shot02', at: S2, dur: RW - S2, from: 0, scale: 1.72, ox: 100, oy: 0, push: 0.04},
  {src: 'BODY_shot01', at: SCAN, dur: GRID - SCAN, from: 0.4, scale: 1.04, ox: 50, oy: 20, push: 0.04},
  {src: 'BODY_shot02', at: CLUE[0], dur: CLUE[1] - CLUE[0], from: 3.35, scale: 1.4, ox: 85, oy: 0, push: 0.04},
  {src: 'BODY_shot03', at: CLUE[1], dur: CLUE[2] - CLUE[1], from: 3.0, scale: 1.4, ox: 50, oy: 0, push: 0.04},
  {src: 'BODY_shot04', at: CLUE[2], dur: VOTE - CLUE[2], from: 2.55, scale: 1.02, ox: 50, oy: 30, push: 0.06},
  {src: 'BODY_shot05', at: VOTE, dur: UI - VOTE, from: 3.9, scale: 1.04, ox: 50, oy: 30, push: 0.05},
  {src: 'BODY_shot06', at: BOOM, dur: PAY - BOOM, from: 1.95, scale: 1.15, ox: 50, oy: 0, push: 0.03},
  {src: 'A_H1_shot02', at: PAY, dur: MA_A_H1_BODY_FRAMES - PAY, from: 4.1, scale: 1.15, ox: 62, oy: 18, push: 0.05, rate: 0.8},
];

const ShotView: React.FC<{s: Shot}> = ({s}) => {
  const f = useCurrentFrame(); // local to the shot's Sequence
  const z = s.scale * (1 + (s.push ?? 0) * prog(f, 0, s.dur, easeOut));
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: C.bgDeep}}>
      <OffthreadVideo src={ai(s.src)} muted delayRenderTimeoutInMilliseconds={180000} trimBefore={Math.round(s.from * FPS)} playbackRate={s.rate ?? 1}
        style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z})`, transformOrigin: `${s.ox}% ${s.oy}%`, filter: s.filter}} />
    </AbsoluteFill>
  );
};

/** "2 minutes earlier": shot02 scrubbed backwards 1.0 s → 0 s (same crop), desaturated with a tape wobble. */
const Rewind: React.FC = () => {
  const f = useCurrentFrame();
  const D = SCAN - RW;
  const src = Math.round(lerp(FPS * 1.0, 0, easeIn(prog(f, 0, D, (v) => v))));
  const jitter = (f % 3) - 1;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: C.bgDeep}}>
      <Freeze frame={src}>
        <OffthreadVideo src={ai('A_H1_shot02')} muted delayRenderTimeoutInMilliseconds={180000}
          style={{width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${jitter * 6}px) scale(1.76)`, transformOrigin: '100% 0%',
            filter: 'saturate(0.45) contrast(1.08) brightness(1.04)'}} />
      </Freeze>
      {/* tape lines rolling upwards */}
      <AbsoluteFill style={{background: 'repeating-linear-gradient(0deg, rgba(255,247,236,0.07) 0 3px, transparent 3px 9px)', transform: `translateY(${-(f * 23) % 9}px)`}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: ((f * 97) % 2200) - 140, height: 90, background: 'linear-gradient(rgba(255,247,236,0), rgba(255,247,236,0.18), rgba(255,247,236,0))'}} />
    </AbsoluteFill>
  );
};

// ---- audio: the clips' own dialogue + room tone, placed per line (outside the motion blur, see Ads.tsx) ----
type Line = {src: string; at: number; from: number; dur: number; vol?: number};
const LINES: Line[] = [
  {src: 'A_H1_shot01', at: 0, from: 0.0, dur: 1.1}, // "It was YOU?!" (re-timed onto the lunge)
  {src: 'A_H1_shot01', at: 66, from: 3.25, dur: 0.7, vol: 0.8}, // her laugh, in sync
  {src: 'A_H1_shot02', at: S2, from: 0.0, dur: 0.95}, // "Mish ana!"
  {src: 'BODY_shot01', at: SCAN, from: 0.4, dur: 1.6}, // "I'm in."
  {src: 'BODY_shot02', at: CLUE[0] - Math.round(0.5 * FPS), from: 2.85, dur: 1.6}, // "Cheese." (J-cut)
  {src: 'BODY_shot03', at: CLUE[1], from: 3.0, dur: 1.1}, // "Oven."
  {src: 'BODY_shot04', at: CLUE[2], from: 2.55, dur: 1.15}, // "Fork"
  {src: 'BODY_shot05', at: VOTE, from: 3.9, dur: 1.9}, // "It's Sami."
  {src: 'BODY_shot06', at: BOOM, from: 1.95, dur: 0.9}, // eruption, "Woohoo!"
  {src: 'A_H1_shot02', at: PAY, from: 4.1, dur: 2.4, vol: 0.85}, // Sami laughing
  {src: 'A_H1_shot03', at: PAY + 6, from: 1.2, dur: 2.2, vol: 0.5}, // the group's "No, no…" groan
];

export const MA_A_H1Audio: React.FC = () => (
  <>
    {LINES.map((l, i) => {
      const len = Math.round(l.dur * FPS);
      return (
        <Sequence key={i} from={l.at} durationInFrames={len} layout="none">
          <Audio src={ai(l.src)} trimBefore={Math.round(l.from * FPS)}
            volume={(f) => (l.vol ?? 1) * Math.min(1, (f + 1) / 3, (len - f) / 5)} />
        </Sequence>
      );
    })}
  </>
);

/** Music ducks under every on-camera line (the windows of LINES; no src = duck only). */
export const MA_A_H1_DUCK: VoLine[] = LINES.filter((l) => l.src !== 'A_H1_shot03').map((l) => ({at: Math.max(0, l.at), dur: Math.round(l.dur * FPS)}));
/** No separate VO: the story is carried by the actors' lines + captions. */
export const MA_A_H1_VO: VoLine[] = [];

export const MA_A_H1_HITS: Hit[] = [
  {at: 3, sfx: 'bass_hit', vol: 0.55, max: 50}, // first-frame hit (impact_drop's peak sits 0.55 s in, too late)
  {at: RW + 4, sfx: 'whoosh_fast', vol: 0.4}, // the rewind
  {at: GRID + 2, sfx: 'swoosh_short', vol: 0.35}, // cut to the phones
  {at: CLUE[0] + 6, sfx: 'pop_a', vol: 0.4},
  {at: CLUE[1] + 14, sfx: 'pop_b', vol: 0.4},
  {at: CLUE[2] + 16, sfx: 'pop_hard', vol: 0.4},
  {at: STAMP, sfx: 'stamp', vol: 1},
  {at: FLIP + 12, sfx: 'sparkle', vol: 0.4},
  {at: PAY + 8, sfx: 'wrong', vol: 0.4, max: 60},
];

// ---- captions (every end − start ≥ holdFrames) ----
const NB = ' ';
const CAPS: Array<{text: string; start: number; end: number; size: 84 | 96; y: number; accent?: string}> = [
  {text: `IT WAS *YOU?!*`, start: -40, end: S2 - 6, size: 96, y: 390, accent: C.primary},
  {text: `“Mish${NB}ana!” = *not${NB}me*`, start: S2 - 2, end: S2 - 2 + holdFrames(4, true), size: 96, y: 390},
  {text: 'One word is *different.*', start: GRID + 6, end: GRID + 6 + holdFrames(4), size: 84, y: 340},
  {text: 'Vote on your *phone.*', start: VOTE + 4, end: VOTE + 4 + holdFrames(4), size: 84, y: 360},
  {text: '…the Mole! *Nice catch.*', start: FLIP + 18, end: FLIP + 18 + holdFrames(5, true), size: 84, y: 1470},
  {text: 'Everyone had PIZZA. He had *PASTA.*', start: PAY + 4, end: PAY + 4 + holdFrames(7, true), size: 96, y: 430},
];

export const MA_A_H1Body: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {SHOTS.map((s, i) => (
        <Sequence key={i} from={s.at} durationInFrames={s.dur} layout="none"><ShotView s={s} /></Sequence>
      ))}
      <Sequence from={RW} durationInFrames={SCAN - RW} layout="none"><Rewind /></Sequence>

      {f >= RW - 2 && f < SCAN + 80 ? <RewindChip f={f} /> : null}
      {f >= SCAN && f < GRID ? <Joined f={f} /> : null}
      {f >= GRID - 2 && f < CLUE[0] ? <Grid f={f} /> : null}
      {f >= CLUE[0] && f < VOTE ? <Clues f={f} /> : null}
      {f >= VOTE && f < UI ? <VoteBubble f={f} /> : null}
      {f >= UI && f < BOOM ? <Reveal f={f} /> : null}
      {f >= PAY ? <PastaPhone f={f} /> : null}

      {CAPS.map((c, i) => (
        <AdCaption key={i} f={f} text={c.text} y={c.y} start={c.start} end={c.end} size={c.size} step={5} accent={c.accent} />
      ))}
      <Disclosure />
      <BgFlood f={f} start={FLOOD} x={SAFE_CX} y={1330} />
    </div>
  );
};

/** VEO-PROMPTS §5: small, legible, always on during the body. */
const Disclosure: React.FC = () => (
  <div style={{position: 'absolute', left: SAFE.left, top: SAFE.top + 76, zIndex: 94, fontFamily: FONT, fontWeight: 700, fontSize: 23, color: C.text,
    background: 'rgba(20,9,40,0.5)', padding: '3px 14px', borderRadius: 999, letterSpacing: '0.01em'}}>
    Dramatized · AI-generated scenes · game screens are real
  </div>
);

const RewindChip: React.FC<{f: number}> = ({f}) => {
  const k = spr(f, RW, POP) - spr(f, SCAN + 62, {damping: 30, stiffness: 260});
  if (k <= 0.01) return null;
  return (
    <At x={SAFE_CX} y={960} z={92}>
      <div style={{position: 'absolute', left: 0, top: 0, transform: `translate(-50%, -50%) scale(${k}) rotate(-2deg)`, display: 'flex', alignItems: 'center', gap: 18,
        background: C.accent, color: C.ink, fontFamily: FONT, fontWeight: 900, fontSize: 64, padding: '10px 36px 14px', borderRadius: 999, whiteSpace: 'nowrap',
        boxShadow: '0 12px 30px rgba(14,6,28,0.45)'}}>
        <svg width={64} height={44} viewBox="0 0 64 44"><path d="M30 2v40L2 22zM62 2v40L34 22z" fill={C.ink} /></svg>
        2 minutes earlier
      </div>
    </At>
  );
};

/** Omar's scan lands: his phone's real "You're in!" screen, then his tile drops into the TV lobby. */
const Joined: React.FC<{f: number}> = ({f}) => {
  const J = SCAN + 20; // the scan lands
  const ph = spr(f, J - 8, SNAPPY) - spr(f, SCAN + 62, SNAPPY);
  const w = 270, h = w / 0.48;
  const fill = prog(f, J - 4, J + 4, easeIn);
  const tvIn = spr(f, SCAN + 52, SNAPPY);
  const drop = spr(f, SCAN + 62, POP);
  const tz = 0.42, tcx = SAFE_CX, tcy = 1360;
  const tw = 170, th = 188;
  const lobby = [LINA, MAYA, SAMI, OMAR];
  return (
    <>
      {ph > 0.01 ? (
        <At x={290} y={1190 + (1 - ph) * 900} z={60}>
          <div style={{position: 'absolute', left: 0, top: 0, transform: 'rotate(-6deg)'}}>
            <PhoneFrame w={w} h={h} screen={C.bg}>
              <div style={{position: 'absolute', inset: 0, clipPath: `circle(${fill * 420}px at 50% 50%)`, background: OMAR.color, fontFamily: FONT, color: C.ink, textAlign: 'center'}}>
                <At x={w / 2} y={h * 0.38}><Avatar shape={OMAR.shape} color={C.text} size={130} initial="O" style={{transform: `scale(${spr(f, J, POP)})`}} /></At>
                <div style={{position: 'absolute', left: 0, right: 0, top: h * 0.38 + 80, fontSize: 34, fontWeight: 900}}>Omar</div>
                <div style={{position: 'absolute', left: 22, right: 22, bottom: 56, height: 62, borderRadius: 999, background: C.ink, color: C.text, fontSize: 30, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${spr(f, J + 5, POP)})`}}>You’re in!</div>
              </div>
            </PhoneFrame>
          </div>
        </At>
      ) : null}
      {tvIn > 0.01 ? (
        <div style={{position: 'absolute', inset: 0, zIndex: 58, transform: `translateY(${(1 - tvIn) * 700}px)`}}>
          <Tv cx={tcx} cy={tcy} z={tz} />
          {lobby.map((p, i) => {
            const x = tcx + (i - 1.5) * (tw + 18);
            const last = i === 3;
            const y = tcy + (last ? (1 - drop) * -260 : 0);
            return (
              <At key={i} x={x} y={y} z={59}>
                <Tile f={f} p={p} w={tw} h={th} inAt={last ? SCAN + 62 : -60} ring={last ? 1 - prog(f, SCAN + 80, SCAN + 96) : 0} />
              </At>
            );
          })}
        </div>
      ) : null}
    </>
  );
};

/** 2×2 phones, the real word screen: PIZZA ×3 / PASTA, the amber ring outside Sami's phone. */
const GW = 286, GH = GW / 0.48;
const GRID_POS = [{x: SAFE_CX - 165, y: 760, r: -4}, {x: SAFE_CX + 165, y: 744, r: 3}, {x: SAFE_CX - 165, y: 1380, r: 3}, {x: SAFE_CX + 165, y: 1364, r: -4}];
const Grid: React.FC<{f: number}> = ({f}) => {
  const cast = [LINA, OMAR, MAYA, SAMI];
  return (
    <AbsoluteFill style={{zIndex: 50}}>
      <AbsoluteFill style={{background: `radial-gradient(80% 60% at 50% 45%, ${C.surface} 0%, ${C.bg} 60%, ${C.bgDeep} 100%)`}} />
      {cast.map((p, i) => {
        const g = GRID_POS[i];
        const k = spr(f, GRID + i * 3, SNAPPY);
        const mole = i === 3;
        const flipAt = GRID + 14 + i * 5 + (mole ? 14 : 0);
        const ring = mole ? spr(f, flipAt + 12, POP) : 0;
        return (
          <At key={i} x={g.x} y={g.y + (1 - k) * 260} z={mole ? 12 : 10}>
            <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${g.r}deg) scale(${0.9 + 0.1 * k})`}}>
              {ring > 0.01 ? (
                <div style={{position: 'absolute', left: -GW / 2 - 30, top: -GH / 2 - 30, width: GW + 60, height: GH + 60, borderRadius: GW * 0.14 + 30,
                  border: `9px solid ${C.accent}`, transform: `scale(${0.92 + 0.08 * ring})`, opacity: Math.min(1, ring),
                  boxShadow: '0 0 60px rgba(255,201,77,0.6), inset 0 0 30px rgba(255,201,77,0.3)'}} />
              ) : null}
              <PhoneFrame w={GW} h={GH} screen="#0F0820">
                <WordFace f={f} w={GW} h={GH} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={p.word} flipAt={flipAt} />
              </PhoneFrame>
            </div>
          </At>
        );
      })}
    </AbsoluteFill>
  );
};

/** Clue round: the chip for the whole round + one bubble per speaker (on the spoken word). */
const Clues: React.FC<{f: number}> = ({f}) => {
  const chip = spr(f, CLUE[0] + 2, SNAPPY) - spr(f, VOTE - 8, {damping: 30, stiffness: 260});
  const B = [
    {at: CLUE[0] + 4, end: CLUE[1], x: 470, y: 560, text: 'Cheese.', amber: false},
    {at: CLUE[1] + 12, end: CLUE[2], x: 640, y: 560, text: 'Oven.', amber: false},
    {at: CLUE[2] + 14, end: VOTE, x: 690, y: 520, text: '…Fork?', amber: true},
  ];
  return (
    <>
      <At x={SAFE_CX} y={340} z={91}>
        <div style={{position: 'absolute', left: 0, top: 0, transform: `translate(-50%, -50%) scale(${Math.max(0, chip)})`, background: 'rgba(20,9,40,0.72)',
          border: `3px solid ${C.accent}`, color: C.text, fontFamily: FONT, fontWeight: 900, fontSize: 60, padding: '6px 34px 10px', borderRadius: 999, whiteSpace: 'nowrap'}}>
          1 clue each, <span style={{color: C.accent}}>out loud</span>
        </div>
      </At>
      {B.map((b, i) => {
        const s = spr(f, b.at, POP) - spr(f, b.end - 4, {damping: 30, stiffness: 300});
        return f >= b.at && f < b.end ? (
          <At key={i} x={b.x} y={b.y} z={80}>
            <Bubble text={b.text} s={Math.max(0, s)} size={b.amber ? 76 : 68} tone={b.amber ? 'amber' : 'cream'} />
          </At>
        ) : null;
      })}
    </>
  );
};

const VoteBubble: React.FC<{f: number}> = ({f}) => {
  const at = VOTE + 8;
  const s = spr(f, at, POP) - spr(f, UI - 6, {damping: 30, stiffness: 300});
  return (
    <At x={700} y={640} z={80}>
      <Bubble text="It’s Sami." s={Math.max(0, s)} size={64} />
    </At>
  );
};

/** The real TV result: Sami's tile → OUT (−8°, amber) + the one magenta flash → his card flips to the orange Mole card. */
const Reveal: React.FC<{f: number}> = ({f}) => {
  const tvz = 0.5, cx = SAFE_CX, cy = 820;
  const tw = 300, th = 330;
  const flip = Math.abs(Math.cos(Math.PI * Math.min(1, Math.max(0, (f - FLIP) / 14))));
  const face = f >= FLIP + 7;
  const grow = 1 + 0.12 * spr(f, FLIP, SOFT);
  const name = spr(f, FLIP + 10, SNAPPY);
  return (
    <AbsoluteFill style={{zIndex: 50}}>
      <AbsoluteFill style={{background: face ? `radial-gradient(70% 50% at 50% 42%, rgba(255,138,61,0.55) 0%, ${C.bg} 70%, ${C.bgDeep} 100%)`
        : `radial-gradient(80% 60% at 50% 45%, ${C.surface} 0%, ${C.bg} 60%, ${C.bgDeep} 100%)`}} />
      <Tv cx={cx} cy={cy} z={tvz} />
      <At x={cx} y={cy} z={10}>
        <div style={{position: 'absolute', left: 0, top: 0, transform: `scaleX(${flip}) scale(${face ? grow : 1})`}}>
          {!face ? (
            <Tile f={f} p={SAMI} w={tw} h={th} inAt={-60} ring={1} />
          ) : (
            <div style={{position: 'absolute', left: -150, top: -195, width: 300, height: 390, borderRadius: 30, background: MOLE_ORANGE,
              backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 6px, transparent 6px 12px)', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.7)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: C.ink, fontFamily: FONT}}>
              <MoleEmblem size={148} color={C.ink} />
              <div style={{fontSize: 64, fontWeight: 900, letterSpacing: '0.02em'}}>MOLE</div>
            </div>
          )}
        </div>
      </At>
      {/* "Sami is out!" in screen space (≥ 76 px) */}
      {f >= FLIP + 10 ? (
        <div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: 1220, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22,
          fontFamily: FONT, fontWeight: 900, fontSize: 80, color: C.text, transform: `scale(${name})`, textShadow: '0 4px 18px rgba(14,6,28,0.7)'}}>
          <div style={{position: 'relative', width: 76, height: 76}}><At x={38} y={38}><Avatar shape={SAMI.shape} color={SAMI.color} size={76} initial="S" /></At></div>
          Sami is out!
        </div>
      ) : null}
      <Flash f={f} x={cx} y={cy} />
      {/* OUT stamp: lands on STAMP, leaves as the card flips */}
      {f >= STAMP - 6 && f < FLIP ? (
        <At x={cx + 20} y={cy + 70} z={80}>
          <div style={{position: 'absolute', left: -230, top: -84, width: 460, height: 168, borderRadius: 30, background: C.accent, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 116, color: C.ink, letterSpacing: '0.04em', border: `5px solid ${C.ink}`, boxSizing: 'border-box',
            boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
            transform: `rotate(-8deg) scale(${f < STAMP ? lerp(1.8, 1, easeIn(prog(f, STAMP - 6, STAMP, (v) => v))) : (1 + 0.08 * (1 - spr(f, STAMP, POP))) * (1 - prog(f, FLIP - 6, FLIP, easeInOut))})`}}>
            OUT
          </div>
        </At>
      ) : null}
    </AbsoluteFill>
  );
};

/** The ad's one full-screen colour flash (DECISIONS #7): magenta, full for 6 frames from the stamp, then irises into the tile. */
const Flash: React.FC<{f: number; x: number; y: number}> = ({f, x, y}) => {
  if (f < STAMP || f > STAMP + 16) return null;
  const R = Math.hypot(Math.max(x, 1080 - x), Math.max(y, 1920 - y)) + 20;
  const r = f < STAMP + 6 ? R : R * (1 - prog(f, STAMP + 6, STAMP + 16, easeOut));
  return <div style={{position: 'absolute', inset: 0, zIndex: 70, background: C.primary, clipPath: `circle(${r}px at ${x}px ${y}px)`}} />;
};

/** Payoff: Sami's real phone (the same word screen, card already showing PASTA) floats up; amber ring outside it. */
const PastaPhone: React.FC<{f: number}> = ({f}) => {
  const k = spr(f, PAY + 2, SNAPPY);
  const w = 300, h = w / 0.48;
  const ring = spr(f, PAY + 16, POP);
  const bob = Math.sin((f - PAY) * 0.06) * 6;
  return (
    <At x={680} y={1262 + (1 - k) * 800 + bob} z={60}>
      <div style={{position: 'absolute', left: 0, top: 0, transform: 'rotate(-5deg)'}}>
        <div style={{position: 'absolute', left: -w / 2 - 34, top: -h / 2 - 34, width: w + 68, height: h + 68, borderRadius: w * 0.14 + 34, border: `10px solid ${C.accent}`,
          opacity: Math.min(1, ring), transform: `scale(${0.92 + 0.08 * ring})`, boxShadow: '0 0 70px rgba(255,201,77,0.65), inset 0 0 30px rgba(255,201,77,0.3)'}} />
        <PhoneFrame w={w} h={h} screen="#0F0820">
          <WordFace f={f} w={w} h={h} name={SAMI.name} shape={SAMI.shape} color={SAMI.color} cream={false} word="PASTA" flipAt={PAY + 8} />
        </PhoneFrame>
      </div>
    </At>
  );
};

/** web-client Role.tsx UNDERCOVER emblem (the mask). */
const MoleEmblem: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg viewBox="0 0 48 48" width={size} height={size}>
    <path fill={color} fillRule="evenodd"
      d="M3 19.5C3 14.8 7.5 12 13 12c4.8 0 7.6 2.6 11 2.6S30.2 12 35 12c5.5 0 10 2.8 10 7.5C45 28 39.8 35 33.5 35c-4.6 0-6.2-4.6-9.5-4.6S19.1 35 14.5 35C8.2 35 3 28 3 19.5zM9.5 22.2c1.9-3.6 8-3.9 10.4-.4-2.1 3.6-8.4 3.8-10.4.4zM28.1 21.8c2.4-3.5 8.5-3.2 10.4.4-2 3.4-8.3 3.2-10.4-.4z" />
  </svg>
);
