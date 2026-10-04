import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, PLAYERS, ROOM_CODE} from '../brand';
import {At, Avatar, FONT, Rise} from '../parts';
import {b, clamp, easeIn, easeInOut, easeOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AdCaption, BgFlood, Hit, SAFE_CX} from './common';
import {CheckMark, ControllerIcon, CrossMark, PassIcon, PhoneDownIcon, TvPhoneIcon} from './m2-icons';
import {Beams, JoinPhones, JOINERS, Lobby, PRESS, Rect, rectLerp, START_LOCAL, TV, TV_S, tvPt} from './m2-tv';

/**
 * MA_E_M2 "Game-night checklist" (SCRIPTS.md §4). One continuous take, ad beat 0 = the song's drop.
 * Checklist (pre-settled on frame 0) -> strikes b1-b3 -> amber answer row b4 -> the row grows into the TV b5.25
 * -> four phones scan in b7-b8.5 -> Start b10 floods magenta -> the flood splits into four dark phones whose word cards
 * flip on the beat (PIZZA x3, then PASTA; the Mole's phone looks the same, an amber ring outside it points him out)
 * -> the phones squash into four claim chips -> background floods back for the end card.
 */
export const M2_BODY_FRAMES = Math.round(b(22.75));

// ---------------------------------------------------------------- timing (beats)
const STRIKE = [1, 2, 3];
const ANSWER = 4;
const COLLAPSE = 4.75;
const GROW = 5.25; // answer row -> TV
const TV_ON = 6;
const FLOOD_FULL = PRESS + 21;
const SPLIT = 11; // full-frame magenta -> four phones
const WORD_AT = [12, 12.5, 13, 14]; // PIZZA x3, then PASTA
const TILT = 15;
const TO_CHIPS = 16;
const CHIP_AT = [17, 18, 19, 20];
const PUSH = 20.5;
const END_FLOOD = M2_BODY_FRAMES - 22;

// ---------------------------------------------------------------- checklist geometry
const ROW_W = 870;
const ROW_H = 148;
const ROW_R = 34;
const ROW_Y = [775, 955, 1135, 1315];
const ROWS = [
  {label: 'Controllers', Icon: ControllerIcon},
  {label: 'An app on every phone', Icon: PhoneDownIcon},
  {label: 'Passing one phone around', Icon: PassIcon},
];
const TILE = 108;
const BOX = 60;
const LABEL = 51;

/** Row interior: icon tile, label, check box. `ghost` renders the same layout invisibly (for the strike overlay). */
const RowLayout: React.FC<{tile: React.ReactNode; label: React.ReactNode; box: React.ReactNode}> = ({tile, label, box}) => (
  <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 24px 0 20px', gap: 26, boxSizing: 'border-box'}}>
    <div style={{width: TILE, height: TILE, flexShrink: 0, position: 'relative'}}>{tile}</div>
    <div style={{flex: 1, fontFamily: FONT, fontSize: LABEL, fontWeight: 800, lineHeight: 1.1, whiteSpace: 'nowrap', position: 'relative'}}>{label}</div>
    <div style={{width: BOX, height: BOX, flexShrink: 0, position: 'relative'}}>{box}</div>
  </div>
);

const StruckRow: React.FC<{f: number; i: number}> = ({f, i}) => {
  const {label, Icon} = ROWS[i];
  const sb = b(STRIKE[i]);
  const draw = prog(f, sb - 3, sb + 7, easeOut); // magenta strike, ~10 frames, lands on the beat
  const hit = prog(f, sb, sb + 6);
  const cross = prog(f, sb + 1, sb + 10, easeOut);
  const shake = f > sb && f < sb + 16 ? Math.sin((f - sb) * 1.3) * 7 * (1 - (f - sb) / 16) : 0;
  // exit: the row squashes into its strike line, then the line retracts
  const c0 = b(COLLAPSE) + i * 2;
  const squash = prog(f, c0, c0 + 9, easeIn);
  const retract = prog(f, c0 + 7, c0 + 17, easeInOut);
  if (retract >= 1) return null;
  const y = ROW_Y[i];
  const pre = -b(1.2) + i * 4; // pre-settled before frame 0 (the thumbnail is the full checklist)
  const rise = spr(f, pre, SNAPPY);
  const ink = mix(C.text, C.muted, hit);
  return (
    <div style={{position: 'absolute', left: SAFE_CX - ROW_W / 2 + shake, top: y - ROW_H / 2, width: ROW_W, height: ROW_H, zIndex: 10}}>
      {/* card (squashes toward the strike line) */}
      <div style={{position: 'absolute', inset: 0, borderRadius: ROW_R, overflow: 'hidden', transform: `scaleY(${1 - squash})`}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: ROW_R, background: C.surface, boxShadow: `inset 0 0 0 2px ${C.outline}`,
          transform: `translateY(${(1 - rise) * 105}%)`}}>
          <RowLayout
            tile={
              <div style={{position: 'absolute', inset: 0, borderRadius: 28, background: C.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `inset 0 0 0 2px ${mix(C.outline, C.primary, hit)}`}}>
                <Icon size={62} color={ink} />
              </div>
            }
            label={<span style={{color: ink}}><Rise f={f} start={pre + 3}>{label}</Rise></span>}
            box={
              <div style={{position: 'absolute', inset: 0, borderRadius: 16, boxShadow: `inset 0 0 0 3px ${mix(C.outline, C.primary, hit)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                {cross > 0 ? <CrossMark size={36} color={C.primary} draw={cross} width={3.6} /> : null}
              </div>
            }
          />
        </div>
      </div>
      {/* strike overlay: same layout, invisible label, so the line spans exactly the words */}
      {draw > 0 ? (
        <RowLayout
          tile={null}
          box={null}
          label={
            <span style={{position: 'relative', display: 'inline-block', color: 'transparent'}}>
              {label}
              <span style={{position: 'absolute', left: -14, right: -14, top: '52%', height: 9, marginTop: -4.5, borderRadius: 9, background: C.primary,
                transformOrigin: retract > 0 ? '100% 50%' : '0% 50%', transform: `rotate(-1.5deg) scaleX(${retract > 0 ? 1 - retract : draw})`}} />
            </span>
          }
        />
      ) : null}
    </div>
  );
};

/** The amber answer row. On GROW it becomes the TV: same object, new shape. */
const AnswerTv: React.FC<{f: number}> = ({f}) => {
  if (f >= FLOOD_FULL) return null;
  const y0 = ROW_Y[3];
  const placeholder = f < b(ANSWER) + 4;
  const pop = spr(f, b(ANSWER), POP);
  const m = prog(f, b(GROW), b(GROW + 0.8), easeInOut);
  const w = lerp(ROW_W, TV.w, easeInOut(clamp(m * 1.35)));
  const h = lerp(ROW_H, TV.h, easeInOut(clamp((m - 0.12) / 0.88)));
  const y = lerp(y0, TV.y, m);
  const r = lerp(ROW_R, 22 * TV_S, m);
  const iris = prog(f, b(GROW + 0.15), b(GROW + 0.75), easeInOut);
  const bezel = 12 * TV_S * prog(f, b(GROW + 0.6), b(GROW + 0.95), easeOut);
  const stand = spr(f, b(GROW + 0.75), SOFT);
  const out = spr(f, b(GROW) - 2, {damping: 26, stiffness: 300});
  const check = prog(f, b(ANSWER) + 5, b(ANSWER) + 14, easeOut);
  // dashed empty slot on frame 0 ("what's left?"), replaced by the amber card on the beat
  const slot = (
    <div style={{position: 'absolute', left: SAFE_CX - ROW_W / 2, top: y0 - ROW_H / 2, width: ROW_W, height: ROW_H, borderRadius: ROW_R,
      border: `3px dashed ${C.outline}`, boxSizing: 'border-box', zIndex: 9}} />
  );
  if (f < b(ANSWER)) return slot;
  return (
    <>
      {placeholder ? slot : null}
      <At x={SAFE_CX} y={y} z={12}>
        {stand > 0.01 ? (
          <div style={{position: 'absolute', left: -110 * TV_S, top: h / 2 + bezel, width: 220 * TV_S, height: 26 * TV_S * stand,
            background: '#05030A', borderRadius: `0 0 ${14 * TV_S}px ${14 * TV_S}px`}} />
        ) : null}
        <div style={{position: 'absolute', left: -w / 2 - bezel, top: -h / 2 - bezel, width: w + 2 * bezel, height: h + 2 * bezel, borderRadius: r + bezel,
          background: bezel > 0.3 ? '#05030A' : 'transparent', transform: `scale(${m > 0 ? 1 : 0.8 + 0.2 * pop})`,
          boxShadow: bezel > 0.3 ? `0 ${30 * TV_S}px ${80 * TV_S}px rgba(0,0,0,0.55)` : undefined}}>
          <div style={{position: 'absolute', left: bezel, top: bezel, width: w, height: h, borderRadius: r, overflow: 'hidden',
            background: C.accent}}>
            {/* the screen switches on: a dark iris opens from the centre while the amber card stretches */}
            {iris > 0 ? (
              <div style={{position: 'absolute', left: (w - (w + 4) * iris) / 2, top: (h - (h + 4) * iris) / 2, width: (w + 4) * iris, height: (h + 4) * iris,
                borderRadius: r * iris, background: `radial-gradient(120% 90% at 30% 0%, #2A1240 0%, ${C.bg} 60%)`}} />
            ) : null}
            {out < 0.995 ? (
              <div style={{position: 'absolute', left: 0, top: 0, width: ROW_W, height: ROW_H}}>
                <RowLayout
                  tile={
                    <div style={{position: 'absolute', inset: 0, borderRadius: 28, background: 'rgba(18,10,31,0.12)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', transform: `scale(${(1 - out) * spr(f, b(ANSWER) + 2, POP)})`}}>
                      <TvPhoneIcon size={64} color={C.ink} bg={mix(C.accent, '#E8AF35', 0.6)} />
                    </div>
                  }
                  label={<span style={{color: C.ink}}><Rise f={f} start={b(ANSWER) + 2} end={b(GROW) - 4}>Your TV + your phones</Rise></span>}
                  box={
                    <div style={{position: 'absolute', inset: 0, borderRadius: 16, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transform: `scale(${(1 - out) * spr(f, b(ANSWER) + 3, POP)})`}}>
                      <CheckMark size={40} color={C.accent} draw={check} width={3.8} />
                    </div>
                  }
                />
              </div>
            ) : null}
            {f >= b(TV_ON) - 6 ? (
              <div style={{position: 'absolute', left: 0, top: 0, width: TV.w, height: TV.h, transform: `translate(${(w - TV.w) / 2}px, ${(h - TV.h) / 2}px)`}}>
                <Lobby f={f} t0={b(TV_ON) - 4} />
              </div>
            ) : null}
          </div>
        </div>
      </At>
    </>
  );
};

// ---------------------------------------------------------------- magenta flood from Start, then four phones

const START_W = (() => {
  const p = tvPt(START_LOCAL.x, START_LOCAL.y);
  return {x: p.x, y: p.y, w: START_LOCAL.w * TV_S, h: START_LOCAL.h * TV_S};
})();

const Flood: React.FC<{f: number}> = ({f}) => {
  if (f < PRESS || f >= b(SPLIT)) return null;
  const s = START_W;
  const R = Math.hypot(Math.max(s.x, 1080 - s.x), Math.max(s.y, 1920 - s.y)) * 1.08;
  const e = clamp(prog(f, PRESS, FLOOD_FULL, easeIn) * 1.12);
  if (e >= 1) return <div style={{position: 'absolute', inset: 0, background: C.primary, zIndex: 40}} />;
  const w = lerp(s.w, 2 * R, e), h = lerp(s.h, 2 * R, e);
  return (
    <At x={s.x} y={s.y} z={40}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: lerp(s.h / 2, R, e), background: C.primary}} />
    </At>
  );
};

const PW = 280, PH = 583;
const GRID: Rect[] = [
  {x: SAFE_CX - 170, y: 672, w: PW, h: PH}, {x: SAFE_CX + 170, y: 672, w: PW, h: PH},
  {x: SAFE_CX - 170, y: 1292, w: PW, h: PH}, {x: SAFE_CX + 170, y: 1292, w: PW, h: PH},
];
const QUAD: Rect[] = [
  // full-frame quadrants, overlapping by 2 px so no seam shows while the flood is still whole
  {x: 270, y: 480, w: 542, h: 962}, {x: 810, y: 480, w: 542, h: 962},
  {x: 270, y: 1440, w: 542, h: 962}, {x: 810, y: 1440, w: 542, h: 962},
];
const CHIP_W = 840, CHIP_H = 136;
const CHIP_Y = [633, 801, 969, 1137];
const CHIP_L = SAFE_CX - CHIP_W / 2;
/** Phones contract into discs at the chips' left ends; on its beat each disc stretches into its chip. */
const DISC: Rect[] = CHIP_Y.map((y) => ({x: CHIP_L + CHIP_H / 2, y, w: CHIP_H, h: CHIP_H}));
const CHIP_TEXT = ['Free to play', '3–12 players', 'English · Français · عربي', 'No controllers'];
const MOLE_CARD = 3; // Sami, bottom right. His phone looks like everyone else's: only the word differs.

/** The real app's role-reveal screen (DESIGN.md 6.2 A): dark phone, room chip, avatar + name, "Your secret word", a card that flips. */
const PhoneFace: React.FC<{f: number; i: number; w: number; h: number}> = ({f, i, w, h}) => {
  const p = PLAYERS[JOINERS[i]];
  const u = w / 300;
  const s0 = b(SPLIT + 0.55) + i * 2;
  const out = b(TO_CHIPS) - 8;
  const F = b(WORD_AT[i]);
  // 2D flip: squash to 0 just before the beat, open on the face on the beat
  const squash = f < F ? 1 - prog(f, F - 5, F, easeIn) : prog(f, F, F + 7, easeOut);
  const face = f >= F;
  const cardIn = spr(f, s0 + 4, POP) - spr(f, out + 3, {damping: 26, stiffness: 300});
  const cw = 240 * u, ch = 300 * u;
  const word = 64 * u;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT, color: C.text, textAlign: 'center'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 46 * u, display: 'flex', justifyContent: 'center'}}>
        <div style={{transform: `scale(${spr(f, s0, POP) - spr(f, out, {damping: 26, stiffness: 300})})`, background: C.surface, borderRadius: 999,
          padding: `${3 * u}px ${12 * u}px`, fontSize: 14 * u, fontWeight: 900, letterSpacing: '0.14em', color: C.accent, boxShadow: `inset 0 0 0 ${1.5 * u}px ${C.outline}`}}>
          {ROOM_CODE}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 86 * u, height: 48 * u, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 * u}}>
        <div style={{position: 'relative', width: 44 * u, height: 44 * u}}>
          <At x={22 * u} y={22 * u}>
            <Avatar shape={p.shape} color={p.color} size={44 * u} initial={p.name[0]} cream={p.cream}
              style={{transform: `scale(${spr(f, s0 + 1, POP) - spr(f, out, SNAPPY)})`}} />
          </At>
        </div>
        <div style={{fontSize: 24 * u, fontWeight: 800}}><Rise f={f} start={s0 + 3} end={out}>{p.name}</Rise></div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 158 * u, fontSize: 18 * u, fontWeight: 700, color: C.text2}}>
        <Rise f={f} start={s0 + 5} end={out}>Your secret word</Rise>
      </div>
      {cardIn > 0.001 ? (
        <div style={{position: 'absolute', left: (w - cw) / 2, top: 204 * u, width: cw, height: ch, borderRadius: 22 * u, overflow: 'hidden',
          transform: `scale(${cardIn}) scaleX(${Math.max(0.001, squash)})`, transformOrigin: '50% 0%',
          background: face ? p.color : `repeating-linear-gradient(45deg, rgba(255,255,255,0.045) 0 ${8 * u}px, transparent ${8 * u}px ${18 * u}px), ${mix(C.surface, p.color, 0.18)}`,
          boxShadow: face ? `0 ${8 * u}px ${22 * u}px rgba(0,0,0,0.35)` : `inset 0 0 0 ${1.5 * u}px ${mix(C.outline, p.color, 0.35)}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
          {face ? (
            <div style={{fontSize: word, fontWeight: 900, color: C.ink, lineHeight: 1, letterSpacing: '0.01em'}}>{p.word}</div>
          ) : (
            <>
              <div style={{width: 54 * u, height: 54 * u, borderRadius: 99, border: `${2.5 * u}px solid ${mix(C.text2, p.color, 0.4)}`, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <div style={{width: 18 * u, height: 18 * u, borderRadius: 99, background: mix(C.text2, p.color, 0.4)}} />
              </div>
              <div style={{marginTop: 18 * u, padding: `0 ${22 * u}px`, fontSize: 16 * u, fontWeight: 700, lineHeight: 1.3, color: C.text2}}>
                Press and hold to see your word
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};

const ChipFace: React.FC<{f: number; i: number}> = ({f, i}) => {
  const at = b(CHIP_AT[i]);
  const amber = i === MOLE_CARD;
  const disc = spr(f, at, POP);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: CHIP_W, height: CHIP_H, display: 'flex', alignItems: 'center', gap: 28, padding: '0 0 0 28px',
      boxSizing: 'border-box', fontFamily: FONT}}>
      <div style={{width: 80, height: 80, flexShrink: 0, borderRadius: 99, background: amber ? C.ink : C.accent, transform: `scale(${disc})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        {f >= at + 4 ? <CheckMark size={46} color={amber ? C.accent : C.ink} draw={prog(f, at + 4, at + 12, easeOut)} width={3.6} /> : null}
      </div>
      <div style={{fontSize: 54, fontWeight: 800, color: amber ? C.ink : C.text, whiteSpace: 'nowrap', lineHeight: 1.1}}>
        <Rise f={f} start={at + 1} cfg={amber ? POP : SNAPPY}>{CHIP_TEXT[i]}</Rise>
      </div>
    </div>
  );
};

const Cards: React.FC<{f: number}> = ({f}) => {
  if (f < b(SPLIT)) return null;
  const push = 1 + 0.035 * prog(f, b(PUSH), M2_BODY_FRAMES, easeInOut);
  const pushY = 885;
  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 30, transformOrigin: `${SAFE_CX}px ${pushY}px`, transform: `scale(${push})`}}>
      {[0, 1, 2, 3].map((i) => {
        const mole = i === MOLE_CARD;
        const split = prog(f, b(SPLIT), b(SPLIT + 0.75), easeInOut);
        const c0 = b(TO_CHIPS) + i * 3;
        const chip = prog(f, c0, c0 + b(0.7), easeInOut);
        let rect = rectLerp(QUAD[i], GRID[i], split);
        rect = rectLerp(rect, DISC[i], chip);
        const stretch = spr(f, b(CHIP_AT[i]) - 3, {damping: 24, stiffness: 210, mass: 1});
        if (stretch > 0) {
          const w = lerp(CHIP_H, CHIP_W, stretch);
          rect = {...rect, x: CHIP_L + w / 2, w};
        }
        const radius = lerp(lerp(0, PW * 0.14, split), CHIP_H / 2, chip);
        const bezel = 9 * prog(f, b(SPLIT + 0.45), b(SPLIT + 0.85), easeOut) * (1 - prog(f, c0, c0 + 12));
        const island = split > 0.9 && chip < 0.2 ? 1 - prog(f, c0 - 4, c0 + 4) : 0;
        // the flood's magenta becomes a dark screen: an iris opens from the centre as the quadrant contracts
        const iris = prog(f, b(SPLIT + 0.2), b(SPLIT + 0.8), easeIn);
        const irisR = Math.hypot(rect.w, rect.h) / 2 * 1.03;
        const dark = iris >= 1;
        const screen = dark ? mix(C.bg, C.surface, chip) : C.primary;
        // the Mole's disc fills amber from its centre (an iris, not a colour blend)
        const fill = mole ? prog(f, c0 + b(0.3), c0 + b(0.7), easeIn) : 0;
        const screenFinal = fill >= 1 ? C.accent : screen;
        // the Mole is pointed out OUTSIDE the phone: amber ring + 6 degree wobble on the PASTA beat
        const P = b(WORD_AT[3]);
        const wob = mole ? 6 * (spr(f, P, POP) - spr(f, P + 7, POP)) : 0;
        const ring = mole && chip < 1 ? spr(f, P, POP) : 0;
        const lean = spr(f, b(TILT), SOFT) - spr(f, c0 - 6, SNAPPY);
        const dir = mole || i === 1 ? 0 : 1;
        const rot = wob + dir * 5 * lean;
        const dy = !mole && i === 1 ? 14 * lean : 0;
        const scale = mole ? 1 + 0.06 * lean : 1;
        const ringGap = lerp(44, 16, ring) * (1 - chip);
        return (
          <At key={i} x={rect.x} y={rect.y + dy} z={mole ? 31 : 30}>
            <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${rot}deg) scale(${scale})`}}>
              {ring > 0.01 ? (
                <div style={{position: 'absolute', left: -rect.w / 2 - bezel - ringGap, top: -rect.h / 2 - bezel - ringGap,
                  width: rect.w + 2 * (bezel + ringGap), height: rect.h + 2 * (bezel + ringGap), borderRadius: radius + bezel + ringGap,
                  boxShadow: `inset 0 0 0 7px ${C.accent}`}} />
              ) : null}
              <div style={{position: 'absolute', left: -rect.w / 2 - bezel, top: -rect.h / 2 - bezel, width: rect.w + 2 * bezel, height: rect.h + 2 * bezel,
                borderRadius: radius + bezel, background: bezel > 0.3 ? '#05030A' : 'transparent',
                boxShadow: bezel > 0.3 ? `0 ${rect.w * 0.06}px ${rect.w * 0.16}px rgba(0,0,0,0.4)` : undefined}}>
                <div style={{position: 'absolute', left: bezel, top: bezel, width: rect.w, height: rect.h, borderRadius: radius, overflow: 'hidden', background: screenFinal,
                  boxShadow: !mole && chip > 0.5 ? `inset 0 0 0 2px ${mix(C.surface, C.outline, (chip - 0.5) * 2)}` : undefined}}>
                  {iris > 0 && !dark ? (
                    <div style={{position: 'absolute', left: (rect.w - (rect.w + 4) * iris) / 2, top: (rect.h - (rect.h + 4) * iris) / 2, width: (rect.w + 4) * iris,
                      height: (rect.h + 4) * iris, borderRadius: radius * iris, background: C.bg}} />
                  ) : null}
                  {fill > 0 ? (
                    <div style={{position: 'absolute', left: rect.w / 2 - irisR * fill, top: rect.h / 2 - irisR * fill, width: 2 * irisR * fill,
                      height: 2 * irisR * fill, borderRadius: 9999, background: C.accent}} />
                  ) : null}
                  {chip < 0.5 && split > 0.5 ? <PhoneFace f={f} i={i} w={rect.w} h={rect.h} /> : null}
                  {f >= b(CHIP_AT[i]) - 2 ? <ChipFace f={f} i={i} /> : null}
                  {island > 0.01 ? (
                    <div style={{position: 'absolute', left: '50%', top: rect.h * 0.022, width: rect.w * 0.3, height: rect.w * 0.085, marginLeft: -rect.w * 0.15,
                      borderRadius: 999, background: '#05030A', transform: `scale(${island})`}} />
                  ) : null}
                </div>
              </div>
            </div>
          </At>
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
      {/* hook title is on screen from frame 0 */}
      <AdCaption f={f} text="GAME NIGHT CHECKLIST" y={488} size={112} start={-b(1.4)} step={3} end={b(COLLAPSE)} />
      {f < FLOOD_FULL ? [0, 1, 2].map((i) => <StruckRow key={i} f={f} i={i} />) : null}
      <AnswerTv f={f} />
      {f < FLOOD_FULL ? <JoinPhones f={f} /> : null}
      {f < FLOOD_FULL ? <Beams f={f} /> : null}
      <Flood f={f} />
      <Cards f={f} />

      <AdCaption f={f} text="Scan. *You're* *in.*" y={238} size={80} start={b(TV_ON)} end={b(9.8)} accent={C.primary} />
      <AdCaption f={f} text="Everyone gets a" y={196} size={80} start={b(SPLIT + 0.25)} step={b(0.15)} end={b(13.85)} />
      <AdCaption f={f} text="*secret* *word.*" y={284} size={80} start={b(SPLIT + 0.7)} step={b(0.15)} end={b(13.9)} />
      <AdCaption f={f} text="One is *different.*" y={236} size={80} start={b(14.05)} end={b(15.85)} />

      <AdCaption f={f} text="Game night, *sorted.*" y={420} size={88} start={b(CHIP_AT[0]) - 4} step={b(0.15)} />
      <BgFlood f={f} start={END_FLOOD} x={SAFE_CX} y={885} />
    </div>
  );
};

export const M2_HITS: Hit[] = [
  {at: 2, sfx: 'bass_hit', vol: 0.75, max: 50},
  ...STRIKE.map((s): Hit => ({at: b(s), sfx: 'wrong', vol: 0.3, max: 50})),
  {at: b(ANSWER), sfx: 'correct', vol: 0.7, max: 70},
  {at: b(COLLAPSE) + 6, sfx: 'swoosh_short', vol: 0.35, max: 50},
  {at: b(GROW + 0.8), sfx: 'whoosh_fast', vol: 0.45},
  {at: b(TV_ON), sfx: 'pop_a', vol: 0.45},
  ...[7, 7.5, 8, 8.5].map((j): Hit => ({at: b(j), sfx: 'pop_b', vol: 0.7})),
  {at: b(9), sfx: 'pop_a', vol: 0.5},
  {at: PRESS, sfx: 'click', vol: 0.8},
  {at: FLOOD_FULL, sfx: 'whoosh_impact', vol: 0.55, max: 110},
  {at: b(SPLIT + 0.7), sfx: 'swoosh_short', vol: 0.35, max: 50},
  {at: b(12), sfx: 'pop_a', vol: 0.5},
  {at: b(12.5), sfx: 'pop_b', vol: 0.55},
  {at: b(13), sfx: 'pop_a', vol: 0.5},
  {at: b(14), sfx: 'wrong', vol: 0.35, max: 60},
  {at: b(14), sfx: 'bass_hit', vol: 0.6, max: 50},
  {at: b(TILT), sfx: 'tick', vol: 0.4, max: 20},
  {at: b(TO_CHIPS + 0.7), sfx: 'whoosh_fast', vol: 0.4},
  ...[17, 18, 19].map((c): Hit => ({at: b(c), sfx: 'pop_a', vol: 0.6})),
  {at: b(20), sfx: 'pop_hard', vol: 0.55, max: 50},
  {at: END_FLOOD + 18, sfx: 'swoosh_short', vol: 0.35, max: 50},
];
