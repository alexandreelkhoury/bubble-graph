// M4 v2 hook: five friends round a lit table pass ONE generic grey phone; Joe reads, Sami peeks. A small TV on the
// wall (unused) says "TV game" from frame 0.
import React from 'react';
import {C, Player} from '../brand';
import {At, Avatar, FONT, Mark, PhoneFrame, Rise} from '../parts';
import {b, clamp, easeInOut, easeOut, lerp, mix, POP, prog, SNAPPY, SOFT, spr} from '../time';
import {AD_H, AD_W} from './common';
import {CAST, FL, FLOOD, MOLE, T} from './m4-grid';

export const RING = {x: 510, y: 1175, r: 360};
const AV = 172;
const OW = 204, OH = 418; // the old shared phone
const seat = (i: number) => {
  const a = (i * 72 * Math.PI) / 180;
  return {x: RING.x + RING.r * Math.sin(a), y: RING.y - RING.r * Math.cos(a)};
};
/** The phone rides just inside whoever holds it. */
const orbit = (th: number) => RING.r - (AV / 2 + 16 + (OH / 2) * Math.abs(Math.cos(th)) + (OW / 2) * Math.abs(Math.sin(th)));
export const LAND = {x: RING.x + 4, y: RING.y + 6};

/** Camera: a slow 4 % push on the table during the hook. */
export const hookZ = (f: number) => 1 + 0.04 * prog(f, 0, FL, easeInOut);
export const hookToScreen = (p: {x: number; y: number}, z: number) => ({x: RING.x + (p.x - RING.x) * z, y: RING.y + (p.y - RING.y) * z});

const holder = (f: number) => T.pass.reduce((a, t) => a + spr(f, b(t) - 6, {damping: 17, stiffness: 240, mass: 0.9}), 0);

/** Where the shared phone is, how it is turned, and which side shows. */
const oldPhone = (f: number) => {
  const h = holder(f);
  const th = (h * 72 * Math.PI) / 180;
  let x = RING.x + orbit(th) * Math.sin(th);
  let y = RING.y - orbit(th) * Math.cos(th);
  const frac = h - Math.floor(h);
  let rot = 9 * Math.sin(th) + 7 * Math.sin(Math.PI * clamp(frac));
  let s = 1 + 0.07 * Math.sin(Math.PI * clamp(frac));
  // Joe shoves it face-down into the middle of the table
  const t = spr(f, b(T.slide[0]), {damping: 18, stiffness: 160, mass: 1});
  if (t > 0) {
    x = lerp(x, LAND.x, t);
    y = lerp(y, LAND.y, t);
    rot = lerp(rot, -12, t);
    s = s * (1 + 0.06 * Math.sin(Math.PI * clamp(t)));
  }
  const tf = prog(f, b(T.slam) - 5, b(T.slam) + 5, easeInOut);
  return {x, y, rot, s, sx: Math.max(0.02, Math.abs(Math.cos(Math.PI * tf))), back: tf >= 0.5};
};

/** Avatar with eyes that track a point (the shared phone). */
const Peeker: React.FC<{p: Player; size: number; look: {x: number; y: number}; from: {x: number; y: number}; wide?: number}> = ({p, size, look, from, wide = 0}) => {
  const dx = look.x - from.x, dy = look.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const reach = size * (0.045 + 0.025 * wide);
  const px = (dx / d) * reach, py = (dy / d) * reach;
  const ey = p.shape === 'triangle' ? size * 0.14 : p.shape === 'star' ? size * 0.02 : -size * 0.03;
  const ew = size * (0.16 + 0.03 * wide), eh = size * (0.2 + 0.04 * wide);
  const eye = (sx: number) => (
    <div key={sx} style={{position: 'absolute', left: sx * size * 0.15 - ew / 2, top: ey - eh / 2, width: ew, height: eh, borderRadius: '50%',
      background: C.text, boxShadow: `0 0 0 ${size * 0.022}px ${C.ink}`}}>
      <div style={{position: 'absolute', left: ew / 2 - size * 0.045 + px, top: eh / 2 - size * 0.045 + py, width: size * 0.09, height: size * 0.09,
        borderRadius: 99, background: C.ink}} />
    </div>
  );
  return (
    <>
      <Avatar shape={p.shape} color={p.color} size={size} style={{filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.25))'}} />
      {eye(-1)}
      {eye(1)}
    </>
  );
};

/** The generic grey screen of "pass one phone around" games (deliberately not our UI), bright and big. */
const OldScreen: React.FC<{f: number}> = ({f}) => {
  const k = T.pass.filter((t) => f >= b(t) - 2).length;
  const reading = f >= b(T.read);
  const next = CAST[Math.min(k + 1, 4)].name.toUpperCase();
  const box: React.CSSProperties = {position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: FONT, color: '#2B2733'};
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {!reading ? (
        <>
          <div style={{...box, top: 110, fontSize: 22, fontWeight: 800, letterSpacing: '0.16em', color: '#6E6878'}}>PASS TO</div>
          <div style={{...box, top: 142, fontSize: 54, fontWeight: 900, lineHeight: 1.1}}>
            <Rise key={k} f={f} start={k === 0 ? -40 : b(T.pass[k - 1]) - 2} cfg={POP}>{next}</Rise>
          </div>
          <div style={{...box, top: 250, fontSize: 18, fontWeight: 700, color: '#6E6878', lineHeight: 1.3}}>Don’t let anyone<br />see the screen!</div>
        </>
      ) : (
        <>
          <div style={{...box, top: 104, fontSize: 21, fontWeight: 800, color: '#6E6878'}}>Joe, your word:</div>
          <div style={{position: 'absolute', left: 20, right: 20, top: 146, height: 110, borderRadius: 16, background: '#FFFFFF', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transform: `scale(${spr(f, b(T.read), POP)})`, boxShadow: '0 4px 12px rgba(0,0,0,0.12)'}}>
            <span style={{fontFamily: FONT, fontSize: 50, fontWeight: 900, color: '#2B2733'}}>PIZZA</span>
          </div>
          <div style={{...box, top: 278, fontSize: 18, fontWeight: 700, color: '#6E6878'}}>Then pass it on</div>
        </>
      )}
      <div style={{position: 'absolute', left: 44, right: 44, bottom: 24, height: 7, borderRadius: 9, background: '#A8A2B2'}} />
    </div>
  );
};

const PhoneBack: React.FC = () => (
  <div style={{position: 'absolute', left: -OW / 2 - 7, top: -OH / 2 - 7, width: OW + 14, height: OH + 14, borderRadius: OW * 0.14 + 7,
    background: 'linear-gradient(160deg, #8C8598 0%, #5E576B 100%)', boxShadow: '0 14px 34px rgba(0,0,0,0.4)'}}>
    <div style={{position: 'absolute', left: 20, top: 20, width: 70, height: 70, borderRadius: 20, background: '#3C3646'}}>
      <div style={{position: 'absolute', left: 10, top: 10, width: 22, height: 22, borderRadius: 99, background: '#100D16', boxShadow: '0 0 0 3px #77708A'}} />
      <div style={{position: 'absolute', left: 38, top: 38, width: 22, height: 22, borderRadius: 99, background: '#100D16', boxShadow: '0 0 0 3px #77708A'}} />
    </div>
  </div>
);

/** Arcs between the seats, pointing clockwise: the way the phone goes round. Each one lights on its pass. */
const ARC_R = 292;
const PassArrows: React.FC<{f: number}> = ({f}) => {
  const gone = spr(f, b(T.slam), {damping: 26, stiffness: 300});
  return (
    <svg width={AD_W} height={AD_H} style={{position: 'absolute', left: 0, top: 0, zIndex: 9, overflow: 'visible'}}>
      {CAST.slice(0, 3).map((_, i) => {
        const a0 = ((i * 72 + 24) * Math.PI) / 180, a1 = ((i * 72 + 48) * Math.PI) / 180;
        const draw = spr(f, -50 + i * 4, SNAPPY) * (1 - gone);
        if (draw < 0.01) return null;
        const pt = (a: number) => ({x: RING.x + ARC_R * Math.sin(a), y: RING.y - ARC_R * Math.cos(a)});
        const tip = lerp(a0, a1, draw);
        const p0 = pt(a0), p1 = pt(tip);
        const lit = f > b(T.pass[i]) - 8 ? Math.min(1, (f - b(T.pass[i]) + 8) / 8) : 0;
        const col = mix('#8A74C0', C.primary, lit);
        const head = 24;
        const tx = Math.cos(tip), ty = Math.sin(tip); // clockwise tangent
        const nx = -ty, ny = tx;
        return (
          <g key={i}>
            <path d={`M${p0.x} ${p0.y} A${ARC_R} ${ARC_R} 0 0 1 ${p1.x} ${p1.y}`} fill="none" stroke={col} strokeWidth={10} strokeLinecap="round" />
            <path d={`M${p1.x + tx * head * 0.7} ${p1.y + ty * head * 0.7} L${p1.x - tx * head * 0.4 + nx * head * 0.65} ${p1.y - ty * head * 0.4 + ny * head * 0.65} L${p1.x - tx * head * 0.4 - nx * head * 0.65} ${p1.y - ty * head * 0.4 - ny * head * 0.65}Z`}
              fill={col} />
          </g>
        );
      })}
    </svg>
  );
};

/** The TV on the wall: lit, idle, nobody uses it (yet). No readable text inside. */
const WallTv: React.FC<{f: number}> = ({f}) => {
  const k = spr(f, -40, SOFT);
  const W = 340, H = 190;
  return (
    <At x={RING.x} y={606} z={5}>
      <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${k})`}}>
        <div style={{position: 'absolute', left: -70, top: H / 2 + 6, width: 140, height: 16, borderRadius: '0 0 10px 10px', background: '#120A20'}} />
        <div style={{position: 'absolute', left: -W / 2 - 10, top: -H / 2 - 10, width: W + 20, height: H + 20, borderRadius: 22, background: '#120A20',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35), 0 0 70px rgba(140,90,240,0.35)'}}>
          <div style={{position: 'absolute', left: 10, top: 10, width: W, height: H, borderRadius: 14, overflow: 'hidden',
            background: `radial-gradient(110% 120% at 30% 10%, #6A42B0 0%, ${C.surface} 70%)`}}>
            <At x={W / 2} y={H / 2}><Mark size={110} bubble={1} stroke={1} /></At>
            <div style={{position: 'absolute', left: -60, top: -40, width: 120, height: 320, transform: 'rotate(28deg)', background: 'rgba(255,255,255,0.08)'}} />
          </div>
        </div>
      </div>
    </At>
  );
};

export const Hook: React.FC<{f: number}> = ({f}) => {
  if (f >= FL + FLOOD) return null;
  const z = hookZ(f);
  const ph = oldPhone(f);
  const lean = spr(f, b(T.peek), POP) - spr(f, b(T.slam) + 2, SNAPPY);
  const flinch = f > b(T.slam) && f < b(T.slam) + 14 ? Math.sin(((f - b(T.slam)) / 14) * Math.PI) : 0;
  const k = Math.round(holder(f));
  const sight = prog(f, b(T.peek) + 2, b(T.peek) + 10, easeOut) * (f < b(T.slam) ? 1 : 0);
  const landT = b(T.slide[1]);
  return (
    <div style={{position: 'absolute', inset: 0, transformOrigin: `${RING.x}px ${RING.y}px`, transform: `scale(${z})`}}>
      <WallTv f={f} />
      {/* warm lamp light over the table */}
      <div style={{position: 'absolute', left: RING.x - 560, top: RING.y - 560, width: 1120, height: 1120, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(255,201,77,0.30) 0%, rgba(255,140,90,0.12) 55%, rgba(255,140,90,0) 100%)'}} />
      {/* the table */}
      <At x={RING.x} y={RING.y}>
        <div style={{position: 'absolute', left: -250, top: -250, width: 500, height: 500, borderRadius: 999,
          background: `radial-gradient(80% 80% at 40% 30%, #6E4BB0 0%, ${C.elevated} 60%, ${C.surface} 100%)`,
          boxShadow: `inset 0 0 0 4px rgba(255,201,77,0.45), 0 30px 80px rgba(0,0,0,0.3)`, transform: `scale(${spr(f, -60, SOFT)})`}} />
      </At>
      <PassArrows f={f} />
      {CAST.map((p, i) => {
        const s0 = seat(i);
        const peeker = i === MOLE;
        const dir = {x: ph.x - s0.x, y: ph.y - s0.y};
        const dl = Math.hypot(dir.x, dir.y) || 1;
        const reach = peeker ? 100 * lean - 22 * flinch : 0;
        const t0 = i >= 1 && i <= T.pass.length ? b(T.pass[i - 1]) : -999;
        const hop = f > t0 - 4 && f < t0 + 12 ? 18 * Math.sin(Math.PI * ((f - t0 + 4) / 16)) : 0;
        const land = f > landT && f < landT + 14 ? 12 * Math.sin(Math.PI * ((f - landT) / 14)) : 0;
        const x = s0.x + (dir.x / dl) * reach, y = s0.y + (dir.y / dl) * reach - hop - land;
        const holds = k === i && f < b(T.slide[0]);
        const nameStyle: React.CSSProperties = i === 0
          ? {left: s0.x + AV / 2 + 14, top: s0.y - 20, textAlign: 'left'}
          : {left: s0.x - 120, width: 240, top: s0.y + AV / 2 + 8, textAlign: 'center'};
        return (
          <React.Fragment key={p.name}>
            <At x={x} y={y} z={peeker ? 14 : 10}>
              <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${spr(f, -50 - i * 3, POP) * (1 + 0.1 * lean * (peeker ? 1 : 0))}) rotate(${peeker ? 10 * lean : 0}deg)`}}>
                <Peeker p={p} size={AV} look={ph} from={{x, y}} wide={peeker ? lean : land / 12} />
              </div>
            </At>
            <div style={{position: 'absolute', ...nameStyle, fontFamily: FONT, fontWeight: 800, fontSize: 38, lineHeight: 1,
              color: holds || (peeker && lean > 0.3) ? C.text : C.text2, zIndex: 15}}>
              <Rise f={f} start={-40}>{p.name}</Rise>
            </div>
          </React.Fragment>
        );
      })}
      {/* Sami's sight line onto Joe's screen */}
      {sight > 0 ? (() => {
        const s0 = seat(MOLE);
        const dir = {x: ph.x - s0.x, y: ph.y - s0.y};
        const dl = Math.hypot(dir.x, dir.y);
        const e = {x: s0.x + (dir.x / dl) * 100 * lean, y: s0.y + (dir.y / dl) * 100 * lean - 4};
        const q = {x: lerp(e.x, ph.x, sight), y: lerp(e.y, ph.y - 10, sight)};
        return (
          <svg width={AD_W} height={AD_H} style={{position: 'absolute', left: 0, top: 0, zIndex: 13, overflow: 'visible'}}>
            <line x1={e.x} y1={e.y} x2={q.x} y2={q.y} stroke={C.accent} strokeWidth={11} strokeLinecap="round" strokeDasharray="2 24" />
          </svg>
        );
      })() : null}
      {/* the one shared phone */}
      <At x={ph.x} y={ph.y} z={12}>
        <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${ph.rot}deg) scale(${ph.s}) scaleX(${ph.sx})`}}>
          {ph.back ? <PhoneBack /> : (
            <PhoneFrame w={OW} h={OH} screen="#E6E2EC">
              <OldScreen f={f} />
            </PhoneFrame>
          )}
        </div>
      </At>
    </div>
  );
};
