import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, PLAYERS} from '../brand';
import {At, Avatar, Bubble, FONT, PhoneFrame, Rise, WordFace} from '../parts';
import {b, easeIn, easeInOut, easeOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AdCaption, BgFlood, Hit, SAFE_CX} from './common';

// MA_A_M1 "Everyone's word is PIZZA" — 22.75 beats (11 s) + the 4 s end card.
export const M1_BODY_FRAMES = Math.round(b(22.75));

// Five players: Maya, Karim, Lea, Joe, Sami (Sami is the Mole: PASTA).
const CAST = [0, 1, 2, 3, 5].map((i) => PLAYERS[i]);
const MOLE = 4;
const CLUES = ['Cheese', 'Oven', 'Slice', 'Delivery', '…Fork?'];
// frame 0 is the thumbnail: phone 1 is already PIZZA, the others flood on the half-beats
const FLOOD_AT = [-0.6, 0.5, 1, 1.5, 2.25];
const CLUE_AT = [6, 7.25, 8.5, 9.75, 11];
const VOTE_LAND = [13.75, 14.5, 15.25, 16]; // voters 0..3 land on Sami
const STAMP = 18.5;
const FLOOD_OUT = M1_BODY_FRAMES - 22;

type R = {x: number; y: number; w: number; h: number};
const PH = 470, PW = PH * 0.48;
// 3 + 2 fan
const PHONES: R[] = [
  {x: SAFE_CX - 268, y: 760, w: PW, h: PH}, {x: SAFE_CX, y: 735, w: PW, h: PH}, {x: SAFE_CX + 268, y: 760, w: PW, h: PH},
  {x: SAFE_CX - 140, y: 1270, w: PW, h: PH}, {x: SAFE_CX + 140, y: 1270, w: PW, h: PH},
];
// the phones shrink in place into player tiles (same centres, no travel)
const SPOTS = [
  {x: SAFE_CX - 285, y: 790}, {x: SAFE_CX, y: 760}, {x: SAFE_CX + 285, y: 790},
  {x: SAFE_CX - 150, y: 1250}, {x: SAFE_CX + 150, y: 1250},
];
const AV = 240; // tile size

export const M1_HITS: Hit[] = [
  ...FLOOD_AT.slice(1, 4).map((t) => ({at: b(t), sfx: 'whoosh_fast' as const, vol: 0.32})),
  {at: 2, sfx: 'pop_b', vol: 0.5},
  {at: b(2.4), sfx: 'wrong', vol: 0.45, max: 50},
  {at: b(2.5), sfx: 'bass_hit', vol: 0.75, max: 40},
  {at: b(4.85), sfx: 'swoosh_short', vol: 0.5},
  ...CLUE_AT.slice(0, 4).map((t, i) => ({at: b(t), sfx: (i % 2 ? 'pop_b' : 'pop_a') as 'pop_a' | 'pop_b', vol: 0.65})),
  {at: b(11), sfx: 'pop_hard', vol: 0.6},
  {at: b(11.15), sfx: 'wrong', vol: 0.4, max: 50},
  ...VOTE_LAND.map((t) => ({at: b(t), sfx: 'bass_hit' as const, vol: 0.7, max: 40})),
  {at: b(16.4), sfx: 'drumroll', vol: 0.35, max: Math.round(b(2.1))},
  {at: b(STAMP), sfx: 'stamp', vol: 1},
  {at: b(STAMP), sfx: 'impact_drop', vol: 0.45, max: 120},
  {at: b(19.1), sfx: 'pop_hard', vol: 0.5},
  {at: FLOOD_OUT + 10, sfx: 'whoosh_fast', vol: 0.35},
];

/** Where card i is and what it is (phone -> tile), plus its look. */
const card = (f: number, i: number) => {
  const pop = spr(f, -40 + i * 3, SNAPPY); // already settled on frame 0
  const m = prog(f, b(4.75) + i * 2, b(5.5) + i * 2, easeInOut);
  const p = PHONES[i], s = SPOTS[i];
  const rect: R = {x: lerp(p.x, s.x, m), y: lerp(p.y, s.y, m), w: lerp(p.w, AV, m), h: lerp(p.h, AV * 1.12, m)};
  return {rect, pop, m};
};

/** The real phone screen: the card in the player's colour flips to the word. The Mole's looks identical. */
const PhoneFace: React.FC<{f: number; i: number; w: number; h: number}> = ({f, i, w, h}) => {
  const p = CAST[i];
  return <WordFace f={f} w={w} h={h} name={p.name} shape={p.shape} color={p.color} cream={p.cream} word={p.word} flipAt={b(FLOOD_AT[i])} out={b(4.7)} />;
};

const TileFace: React.FC<{f: number; i: number; w: number; h: number}> = ({f, i, w, h}) => {
  const p = CAST[i];
  const a = spr(f, b(5.35) + i * 2, POP);
  return (
    <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, fontFamily: FONT}}>
      <At x={w / 2} y={h * 0.42}>
        <Avatar shape={p.shape} color={p.color} size={w * 0.5} initial={p.name[0]} cream={p.cream} style={{transform: `scale(${a})`}} />
      </At>
      <div style={{position: 'absolute', left: 0, right: 0, top: h * 0.73, textAlign: 'center', fontSize: w * 0.15, fontWeight: 800, color: C.text}}>
        <Rise f={f} start={b(5.5) + i * 2}>{p.name}</Rise>
      </div>
    </div>
  );
};

export const M1Body: React.FC = () => {
  const f = useCurrentFrame();
  const sami = SPOTS[MOLE];
  // slow push towards Sami once the stamp lands (one camera move)
  const push = prog(f, b(STAMP + 0.3), b(22.4), easeInOut);
  const cz = 1 + 0.09 * push;
  const cx = lerp(SAFE_CX, sami.x, push * 0.35), cy = lerp(960, sami.y, push * 0.35);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${SAFE_CX}px, 960px) scale(${cz}) translate(${-cx}px, ${-cy}px)`}}>
        {CAST.map((p, i) => {
          const {rect, pop, m} = card(f, i);
          const mole = i === MOLE;
          const wob = mole ? Math.sin((f - b(2.5)) * 0.5) * 6 * Math.exp(-(f - b(2.5)) / 14) * (f > b(2.5) ? 1 : 0) : 0;
          const lift = mole ? spr(f, b(2.5), POP) * (1 - m) : 0;
          const dim = !mole ? 1 - 0.55 * prog(f, b(13.2), b(14)) : 1;
          const grow = mole ? 1 + 0.14 * spr(f, b(13.3), SOFT) : 1;
          const shake = mole && f > b(16.6) && f < b(STAMP) ? Math.sin(f * 1.8) * 4 * prog(f, b(16.6), b(17.6)) : 0;
          const tiltTo = Math.sign(sami.x - rect.x) || 1;
          const tilt = !mole ? tiltTo * 8 * (spr(f, b(11.4), SOFT) - spr(f, b(12.6), SOFT)) : 0;
          const tileCol = mix(C.bg, C.surface, m);
          const ring = mole ? prog(f, b(2.5), b(2.5) + 9, easeOut) * (1 - m) : 0;
          const glitch = mole && f >= b(2.38) && f < b(2.38) + 5;
          return (
            <At key={i} x={rect.x} y={rect.y - lift * 26} z={mole ? 12 : 10} style={{opacity: dim}}>
              <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${pop * grow * (1 + lift * 0.05)}) rotate(${wob + shake + tilt}deg)`}}>
                {m < 1 ? (
                  <>
                    {ring > 0 || glitch ? (
                      <div style={{position: 'absolute', left: -rect.w / 2 - 18, top: -rect.h / 2 - 18, width: rect.w + 36, height: rect.h + 36,
                        borderRadius: rect.w * 0.14 + 18, border: `6px solid ${C.accent}`, opacity: glitch ? 1 : ring,
                        transform: glitch ? `translateX(${f % 2 ? 9 : -9}px)` : `scale(${0.9 + 0.1 * ring})`,
                        boxShadow: glitch ? `-10px 0 0 rgba(0,255,255,0.5), 10px 0 0 rgba(255,0,90,0.5)` : `0 0 46px rgba(255,194,61,${0.5 * ring})`}} />
                    ) : null}
                    <PhoneFrame w={rect.w} h={rect.h} bezel={1 - prog(f, b(4.75) + i * 2, b(5.1) + i * 2)} screen={tileCol} island={m < 0.2}>
                      {m < 0.3 ? <PhoneFace f={f} i={i} w={rect.w} h={rect.h} /> : null}
                    </PhoneFrame>
                  </>
                ) : (
                  <div style={{position: 'absolute', left: -rect.w / 2, top: -rect.h / 2, width: rect.w, height: rect.h, borderRadius: 30, background: C.surface,
                    boxShadow: mole && f > b(13.3) ? `0 0 0 5px ${C.accent}` : undefined}} />
                )}
                {m > 0.6 ? <TileFace f={f} i={i} w={rect.w} h={rect.h} /> : null}
              </div>
            </At>
          );
        })}
        {/* clue bubbles */}
        {CAST.map((p, i) => {
          const s = spr(f, b(CLUE_AT[i]), POP) - spr(f, b(12.6) + i * 1.5, {damping: 26, stiffness: 300});
          const spot = SPOTS[i];
          return s > 0.001 ? (
            <At key={`c${i}`} x={spot.x} y={spot.y - AV * 0.56 - 16} z={20}>
              <Bubble text={CLUES[i]} s={Math.max(0, s)} size={44} tone={i === MOLE ? 'amber' : 'cream'} />
            </At>
          ) : null;
        })}
        {/* votes */}
        {VOTE_LAND.map((land, i) => {
          const t1 = b(land), t0 = t1 - b(0.6);
          if (f < t0) return null;
          const from = SPOTS[i];
          const g = 1 + 0.14 * spr(f, b(13.3), SOFT);
          const to = {x: sami.x + (i - 1.5) * 46 * g, y: sami.y - (AV * 1.12 * g) / 2 + 30};
          const t = prog(f, t0, t1, easeInOut);
          const x = lerp(from.x, to.x, t), y = lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * 220;
          const k = f >= t1 ? 1 + 0.35 * (1 - spr(f, t1, POP)) : 1;
          return (
            <At key={`v${i}`} x={x} y={y} z={25}>
              <div style={{position: 'absolute', left: -22, top: -22, width: 44, height: 44, borderRadius: 99, background: CAST[i].color,
                border: `4px solid ${C.text}`, boxSizing: 'border-box', transform: `scale(${k})`}} />
            </At>
          );
        })}
        {/* MOLE! stamp + the word underneath */}
        {f >= b(STAMP) - 7 ? (
          <At x={sami.x} y={sami.y + 10} z={30}>
            <div style={{position: 'absolute', left: -175, top: -60, width: 350, height: 120, borderRadius: 24, background: C.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 76, color: C.ink, letterSpacing: '0.04em',
              boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
              transform: `rotate(-8deg) scale(${f < b(STAMP) ? lerp(2.6, 1, easeIn(prog(f, b(STAMP) - 7, b(STAMP), (x) => x))) : 1 + 0.1 * (1 - spr(f, b(STAMP), POP))})`}}>
              OUT
            </div>
          </At>
        ) : null}
        <At x={sami.x} y={sami.y + AV * 0.62 + 46} z={30}>
          <div style={{position: 'absolute', left: -220, width: 440, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 48, color: C.accent,
            WebkitTextStroke: `3px ${C.bg}`, paintOrder: 'stroke fill'}}>
            <Rise f={f} start={b(19.1)} cfg={POP}>Sami was the Mole</Rise>
          </div>
        </At>
      </div>

      <AdCaption f={f} text="Everyone’s word is *PIZZA.*" y={300} start={-b(1)} step={b(0.1)} end={b(2.3)} accent={C.primary} size={80} />
      <AdCaption f={f} text="Except *his.*" y={300} start={b(2.5)} step={b(0.2)} end={b(4.7)} size={92} />
      <AdCaption f={f} text="Clue *time.*" y={300} start={b(5.25)} step={b(0.25)} end={b(10.8)} size={84} />
      <AdCaption f={f} text="Wait… *fork?*" y={300} start={b(11.2)} step={b(0.3)} end={b(12.9)} size={92} />
      <AdCaption f={f} text="Vote out the *liar.*" y={300} start={b(13.1)} step={b(0.2)} end={b(18.2)} size={84} />
      <AdCaption f={f} text="IT WAS *YOU?!*" y={300} start={b(STAMP + 0.25)} step={b(0.3)} size={112} />
      <BgFlood f={f} start={FLOOD_OUT} x={sami.x} y={sami.y} />
    </div>
  );
};
