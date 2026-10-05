import React from 'react';
import {C, Shape} from '../brand';
import {At, Avatar, FONT, Mark, Rise} from '../parts';
import {QR, QR_N} from '../qr';
import {b, clamp, easeIn, easeInOut, lerp, POP, prog, SNAPPY, spr} from '../time';
import {SAFE_CX} from './common';

/**
 * MA_G_M7 "Team party / office" helpers: the beat grid, the cast, the one meeting-room screen (it moves A -> B -> C)
 * and what it shows: the calendar ("Team event · Agenda: ???") -> the laptop's browser typing the URL -> the lobby ->
 * the Mish Ana! mark while words are out -> the vote board. Screen content is in TV design units (1040 x 585).
 * Word pair: Coffee / Tea = pair p001 of word-packs/packs/en/en-everyday-01.json.
 */

// ---------------------------------------------------------------- beat grid (ad beats; beat 0 = the drop)
export const T = {
  clock: 2, // 4:58 -> 4:59
  laptop: 4.6, // lid opens
  cable: 5, // HDMI cable draws to the screen
  browser: 5.75, // the screen switches to the laptop's browser (wipe from the top)
  type: 6.1, // URL types out...
  enter: 7.25, // ...enter: the lobby slides up
  join: [9.5, 10, 10.5, 11, 11.5],
  start: 12,
  press: 12.5,
  s3: 12.75, // camera: table slides away, the scan phones grow into the word screens, the TV rises
  flip: [14, 14.5, 15, 15.5], // COFFEE x4
  focus: 16.9, // the boss's phone comes forward...
  moleFlip: 17.25, // ...TEA
  s4: 20.5, // TV comes back big (vote board), phones drop into a row
  clue: [21.25, 21.75, 22.25, 22.75, 23.25],
  voteUi: 23.4,
  vote: [23.75, 24, 24.25, 24.5, 24.75],
  clueOut: 24.9,
  stamp: 25.75,
  reveal: 26.75,
  tea: 28, // "I had TEA"
  laugh: 28.5,
  close: 30.75,
  crew: 31,
  pill: 32,
  hops: [33, 34],
};

export type CastMember = {name: string; color: string; shape: Shape; cream: boolean; word: string; clue: string};
export const CAST: CastMember[] = [
  {name: 'Priya', color: '#FF3355', shape: 'circle', cream: false, word: 'COFFEE', clue: 'Mug'},
  {name: 'Marcus', color: '#5A9BFF', shape: 'square', cream: false, word: 'COFFEE', clue: 'Beans'},
  {name: 'Ines', color: '#FFF04D', shape: 'star', cream: false, word: 'COFFEE', clue: 'Latte'},
  {name: 'Kenji', color: '#2BC49F', shape: 'triangle', cream: false, word: 'COFFEE', clue: 'Morning'},
  {name: 'Dana', color: '#9A6BFF', shape: 'diamond', cream: true, word: 'TEA', clue: 'Kettle'},
];
export const BOSS = 4;

export const out = (f: number, at: number) => spr(f, at, {damping: 26, stiffness: 300});

// ---------------------------------------------------------------- the screen
export type Rect = {x: number; y: number; w: number; h: number};
export const rectLerp = (a: Rect, c: Rect, t: number): Rect => ({x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), w: lerp(a.w, c.w, t), h: lerp(a.h, c.h, t)});
export const TV_A: Rect = {x: SAFE_CX, y: 740, w: 900, h: 506.25};
export const TV_B: Rect = {x: SAFE_CX, y: 410, w: 460, h: 258.75};
export const TV_C: Rect = {x: SAFE_CX, y: 770, w: 940, h: 528.75};
export const tvAt = (f: number): Rect => {
  const r = rectLerp(TV_A, TV_B, prog(f, b(T.s3), b(T.s3 + 0.75), easeInOut));
  return rectLerp(r, TV_C, prog(f, b(T.s4), b(T.s4 + 0.75), easeInOut));
};
export const tvPt = (r: Rect, lx: number, ly: number) => {
  const s = r.w / 1040;
  return {x: r.x - r.w / 2 + lx * s, y: r.y - r.h / 2 + ly * s};
};

/** A wall-mounted meeting-room screen (no stand). */
export const TvFrame: React.FC<{r: Rect; children: React.ReactNode}> = ({r, children}) => {
  const s = r.w / 1040;
  const bezel = 12 * s;
  return (
    <At x={r.x} y={r.y} z={5}>
      <div style={{position: 'absolute', left: -r.w / 2 - bezel, top: -r.h / 2 - bezel, width: r.w + 2 * bezel, height: r.h + 2 * bezel,
        borderRadius: 18 * s + bezel, background: '#05030A', boxShadow: `0 ${30 * s}px ${80 * s}px rgba(0,0,0,0.5)`}}>
        <div style={{position: 'absolute', left: bezel, top: bezel, width: r.w, height: r.h, borderRadius: 18 * s, overflow: 'hidden', background: C.bg}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: 1040, height: 585, transformOrigin: '0 0', transform: `scale(${s})`, fontFamily: FONT}}>
            {children}
          </div>
        </div>
      </div>
    </At>
  );
};

// ---------------------------------------------------------------- 1. the calendar (light, like every work calendar)
export const CalendarScreen: React.FC<{f: number}> = ({f}) => {
  const tick = b(T.clock);
  return (
    <div style={{position: 'absolute', inset: 0, background: C.text, color: C.ink}}>
      <div style={{position: 'absolute', left: 56, top: 26, fontSize: 32, fontWeight: 900}}>Today</div>
      <div style={{position: 'absolute', left: 168, top: 32, fontSize: 24, fontWeight: 700, color: '#6B5A86'}}>Friday</div>
      <div style={{position: 'absolute', right: 56, top: 22, fontSize: 38, fontWeight: 900, display: 'flex'}}>
        <span>4:5</span>
        <span style={{position: 'relative', display: 'inline-block', width: '0.6em'}}>
          {f < tick + 14 ? <span style={{position: 'absolute', left: 0}}><Rise f={f} start={-999} end={tick}>8</Rise></span> : null}
          <span style={{position: 'absolute', left: 0}}><Rise f={f} start={tick}>9</Rise></span>
          &nbsp;
        </span>
        <span>&nbsp;PM</span>
      </div>
      {/* the event: pink block, big title, the empty agenda */}
      <div style={{position: 'absolute', left: 56, top: 96, width: 928, height: 318, borderRadius: 30, background: C.primary,
        boxShadow: '0 14px 30px rgba(120,20,70,0.25)'}}>
        <div style={{position: 'absolute', left: 48, top: 30, fontSize: 108, fontWeight: 900, lineHeight: 1}}>Team event</div>
        <div style={{position: 'absolute', left: 50, top: 156, fontSize: 42, fontWeight: 800, color: '#4A0A2C'}}>5:00 PM · Room Atlas</div>
        <div style={{position: 'absolute', left: 48, top: 228, display: 'flex', alignItems: 'center', gap: 16, fontSize: 48, fontWeight: 900}}>
          Agenda:
          <span style={{background: C.text, borderRadius: 14, padding: '0 18px', transform: 'rotate(-2deg)', display: 'inline-block'}}>???</span>
        </div>
        <div style={{position: 'absolute', right: 40, top: 38, background: C.ink, color: C.text, borderRadius: 999, padding: '6px 22px', fontSize: 30, fontWeight: 800}}>
          in 2 min
        </div>
      </div>
      {[0, 1].map((k) => (
        <div key={k} style={{position: 'absolute', left: 56, top: 446 + k * 62, width: 928, height: 46, borderRadius: 14, background: '#EDE3EF', display: 'flex',
          alignItems: 'center', gap: 22, paddingLeft: 24}}>
          <span style={{fontSize: 24, fontWeight: 800, color: '#7A6A94'}}>{k ? '6:00 PM' : '5:30 PM'}</span>
          <span style={{width: k ? 180 : 260, height: 12, borderRadius: 6, background: '#D6C8DE'}} />
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- 2. the laptop's browser (mirrored on the screen)
export const URL_TEXT = 'play.mishana.workers.dev/tv';
export const typedChars = (f: number) => Math.round(clamp((f - b(T.type)) / (b(T.enter) - 8 - b(T.type))) * URL_TEXT.length);

export const BrowserScreen: React.FC<{f: number}> = ({f}) => {
  const a = b(T.browser);
  if (f < a) return null;
  const k = prog(f, a, a + 12, easeInOut);
  const n = typedChars(f);
  const caret = n < URL_TEXT.length || Math.floor(f / 14) % 2 === 0;
  const press = f >= b(T.enter) - 4 ? 1 - 0.04 * Math.sin(Math.PI * clamp((f - b(T.enter) + 4) / 10)) : 1;
  return (
    <div style={{position: 'absolute', inset: 0, background: '#FBF6F0', clipPath: `inset(0 0 ${(1 - k) * 100}% 0)`}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 120, background: '#EAE1EE'}}>
        {[0, 1, 2].map((d) => <div key={d} style={{position: 'absolute', left: 30 + d * 30, top: 22, width: 18, height: 18, borderRadius: 99, background: ['#FF6B6B', '#FFC94D', '#3DDC97'][d]}} />)}
        <div style={{position: 'absolute', left: 36, right: 36, top: 52, height: 56, borderRadius: 999, background: '#FFFFFF', boxShadow: `inset 0 0 0 3px ${C.primary}`,
          display: 'flex', alignItems: 'center', paddingLeft: 30, fontSize: 36, fontWeight: 800, color: C.ink, transform: `scale(${press})`}}>
          <svg width={22} height={26} viewBox="0 0 22 26" style={{marginRight: 16}}>
            <rect x="2" y="11" width="18" height="14" rx="3" fill="#6B5A86" />
            <path d="M6 11V8a5 5 0 0 1 10 0v3" stroke="#6B5A86" strokeWidth="3" fill="none" />
          </svg>
          {URL_TEXT.slice(0, n)}
          <span style={{display: 'inline-block', width: 4, height: 40, marginLeft: 3, background: caret ? C.primary : 'transparent'}} />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 3. the lobby
export const QR_C = {x: 165, y: 222, w: 250};
export const SLOT = (i: number) => ({x: 465 + (i % 3) * 190, y: 200 + Math.floor(i / 3) * 172});
const START = {x: 865, y: 530, w: 250, h: 72};

export const Lobby: React.FC<{f: number}> = ({f}) => {
  const a = b(T.enter);
  if (f < a) return null;
  const k = spr(f, a, SNAPPY);
  const landed = T.join.filter((t) => f >= b(t)).length;
  const qr = spr(f, a + 8, POP);
  const startIn = spr(f, b(T.start), POP);
  const press = f >= b(T.press) - 5 ? 0.12 * Math.sin(Math.PI * clamp((f - b(T.press) + 5) / 12)) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 30% 0%, #3A1C5E 0%, ${C.bg} 60%)`,
      transform: `translateY(${(1 - k) * 585}px)`}}>
      <div style={{position: 'absolute', left: 40, top: 46, width: 250, textAlign: 'center', fontSize: 26, fontWeight: 800, color: C.text2, letterSpacing: '0.06em'}}>
        Scan to join
      </div>
      <div style={{position: 'absolute', left: QR_C.x - QR_C.w / 2, top: QR_C.y - QR_C.w / 2, width: QR_C.w, height: QR_C.w, borderRadius: 24, background: C.text,
        transform: `scale(${qr})`, padding: 10, boxSizing: 'border-box'}}>
        <svg viewBox={`-1 -1 ${QR_N + 2} ${QR_N + 2}`} width="100%" height="100%">
          {QR.flatMap((row, r) => row.map((on, cc) => (on ? <rect key={`${r}-${cc}`} x={cc} y={r} width={1.02} height={1.02} fill={C.ink} /> : null)))}
        </svg>
      </div>
      <div style={{position: 'absolute', left: 30, top: 372, width: 270, display: 'flex', justifyContent: 'space-between', fontSize: 96, fontWeight: 900,
        color: C.accent, lineHeight: 1}}>
        {'JQPU'.split('').map((ch, i) => <Rise key={i} f={f} start={a + 10 + i * 3} cfg={POP}>{ch}</Rise>)}
      </div>
      <div style={{position: 'absolute', left: 30, top: 494, width: 270, textAlign: 'center', fontSize: 19, fontWeight: 700, color: C.muted}}>
        play.mishana.workers.dev
      </div>
      <div style={{position: 'absolute', left: 382, top: 46, fontSize: 32, fontWeight: 900, color: C.text, display: 'flex', gap: 10}}>
        Players
        <Rise key={landed} f={f} start={landed ? b(T.join[landed - 1]) : a} cfg={POP}>
          <span style={{color: landed ? C.accent : C.text}}>{landed}</span>/12
        </Rise>
      </div>
      {Array.from({length: 6}, (_, i) => {
        const sl = SLOT(i);
        const slot = spr(f, a + 6 + i * 2, SNAPPY);
        const J = i < 5 ? b(T.join[i]) : 1e9;
        const lit = f >= J;
        const p = CAST[i] ?? CAST[0];
        return (
          <div key={i} style={{position: 'absolute', left: sl.x - 85, top: sl.y - 76, width: 170, height: 152, transform: `scale(${Math.max(0, slot)})`}}>
            {!lit ? <div style={{position: 'absolute', inset: 0, borderRadius: 24, border: `3px dashed ${C.outline}`}} /> : (
              <div style={{position: 'absolute', inset: 0, borderRadius: 24, background: C.surface, transform: `scale(${spr(f, J, POP)})`}}>
                <At x={85} y={62}><Avatar shape={p.shape} color={p.color} size={76} initial={p.name[0]} cream={p.cream} /></At>
                <div style={{position: 'absolute', left: 0, right: 0, top: 106, textAlign: 'center', fontSize: 28, fontWeight: 800, color: C.text}}>{p.name}</div>
              </div>
            )}
          </div>
        );
      })}
      {startIn > 0.001 ? (
        <div style={{position: 'absolute', left: START.x - START.w / 2, top: START.y - START.h / 2, width: START.w, height: START.h, borderRadius: 999,
          background: C.primary, transform: `scale(${startIn * (1 - press)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          color: C.ink, fontSize: 32, fontWeight: 900, boxShadow: '0 0 40px rgba(255,79,154,0.45)'}}>
          <svg width={22} height={24} viewBox="0 0 22 24"><path d="M2 2l18 10L2 22z" fill={C.ink} /></svg>
          Start
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- 4. while the words are out: the mark (no text in a small TV)
export const MarkScreen: React.FC<{f: number}> = ({f}) => {
  const a = b(T.press) + 2;
  if (f < a) return null;
  const R = Math.hypot(START.x, START.y) * 1.05;
  const r = lerp(30, R, prog(f, a, a + 18, easeIn));
  const k = spr(f, a + 14, POP);
  const pulse = 1 + 0.04 * Math.sin((f - a) / 9);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: START.x - r, top: START.y - r, width: 2 * r, height: 2 * r, borderRadius: 999,
        background: `radial-gradient(circle, #4A2580 0%, ${C.bg} 70%)`}} />
      <At x={520} y={292}><Mark size={300 * k * pulse} bubble={1} stroke={1} /></At>
    </div>
  );
};

// ---------------------------------------------------------------- 5. the vote board (the TV stamps OUT)
export const VT = (i: number) => ({x: 520 + (i - 2) * 190, y: 270});
export const STAMP_L = {x: 900, y: 326, w: 220, h: 86};

export const VoteBoard: React.FC<{f: number}> = ({f}) => {
  const a = b(T.s4);
  if (f < a) return null;
  const k = spr(f, a, SNAPPY);
  const votesOn = (j: number) => T.vote.filter((t, i) => f >= b(t) && (i === BOSS ? 1 : BOSS) === j).length;
  const st = b(T.stamp);
  return (
    <div style={{position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 30% 0%, #3A1C5E 0%, ${C.bg} 60%)`,
      transform: `translateY(${(1 - k) * 585}px)`}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 44, textAlign: 'center', fontSize: 50, fontWeight: 900, color: C.text}}>
        <Rise f={f} start={a + 6}>Who’s not <span style={{color: C.accent}}>one of us?</span></Rise>
      </div>
      {CAST.map((p, i) => {
        const c = VT(i);
        const pop = spr(f, a + 8 + i * 2, POP);
        const mole = i === BOSS;
        const n = votesOn(i);
        const sat = mole ? 1 : 1 - 0.7 * prog(f, st, st + 10);
        const hit = n > 0 ? 1 + 0.06 * (1 - spr(f, b(T.vote[T.vote.length - 1]), POP)) : 1;
        return (
          <div key={i} style={{position: 'absolute', left: c.x - 85, top: c.y - 100, width: 170, height: 200, borderRadius: 26, background: C.surface,
            transform: `scale(${pop * (mole ? hit : 1)})`, filter: `saturate(${sat})`,
            boxShadow: mole && n > 0 ? `inset 0 0 0 5px ${C.accent}` : `inset 0 0 0 2px ${C.outline}`}}>
            <At x={85} y={80}><Avatar shape={p.shape} color={p.color} size={96} initial={p.name[0]} cream={p.cream} /></At>
            <div style={{position: 'absolute', left: 0, right: 0, top: 142, textAlign: 'center', fontSize: 30, fontWeight: 800, color: C.text}}>{p.name}</div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 418, textAlign: 'center', fontSize: 88, fontWeight: 900, color: C.accent, lineHeight: 1.1}}>
        <Rise f={f} start={b(T.reveal)} cfg={POP}>Dana was the Mole</Rise>
      </div>
    </div>
  );
};
