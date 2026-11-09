// JAMAA-PLATFORM §3.7: a player's character as inline SVG (the body is the DESIGN §5.2 glyph, the face sits in the
// shape's face box). Expression changes crossfade the feature groups (120 ms, CSS); body motion (hop, sink, jump-back,
// lean) is CSS on the wrapper. Faces are drawn from 40 px; below that the classic avatar tile is used.
import { useEffect, useRef, useState } from "preact/hooks";
import type { ColorId } from "@jamaa/shared/constants";
import {
  BODY_PATHS, EXPRESSION_EXTRAS, EXPRESSION_FEATURES, EYE_HIGHLIGHT, FACE_BOXES, FACE_MIN_SIZE, FACE_SPACE, LOOK_MAX,
  REACTION_BURST, REACTION_HOLD_MS, SHY_CHEEK_HEX, featureScale,
} from "@jamaa/shared/characters";
import type { Expression, Feature, ReactionKind } from "@jamaa/shared/characters";
import { Avatar, COLOR_BY_ID } from "./PlayerChip";
import { BURST_INK, burstTracings } from "./bursts";

const RINGED: ReadonlySet<ColorId> = new Set(["coral", "grape", "plum"]);
const CREAM = "#FFF7EC";
const INK = "#120A1F";
/** Body width in body units (the glyphs span ~3..21 of the 24-unit box): the hand disc and the point nub scale from it. */
const BODY_W = 18;
/** Where the open eyes sit for each expression (face units; DESIGN-JAMAA §4.3), for the highlight dots. */
const EYE_OFFSET: Partial<Record<Expression, readonly [number, number]>> = { think: [0.9, -0.8], shy: [0, 0.8], point: [1, 0] };

function feat(f: Feature, i: number, ink: string, expression: Expression) {
  const cheek = f.part === "cheeks";
  // Cheeks: cream on ink-eyed bodies, ink at 25 % on cream-eyed ones; `shy` is rose (shared EXPRESSION_FEATURES).
  const color = cheek ? (expression === "shy" ? SHY_CHEEK_HEX : ink === INK ? CREAM : INK) : ink;
  const opacity = cheek ? (expression === "shy" ? f.alpha ?? 0.6 : ink === INK ? f.alpha ?? 0.35 : 0.25) : f.alpha;
  const blink = f.part === "eyes" && f.style === "fill" && EYE_HIGHLIGHT.includes(expression) ? "ch__eye" : undefined;
  return f.style === "stroke"
    ? <path key={i} d={f.d} fill="none" stroke={color} stroke-width={f.strokeWidth ?? 0.8} stroke-linecap="round" stroke-linejoin="round" opacity={opacity} />
    : <path key={i} class={blink} d={f.d} fill={color} opacity={opacity} />;
}

export interface CharacterProps {
  color: ColorId;
  size: number;
  expression?: Expression;
  /** Eyes look toward the start or end side (the speaker, the score rail). */
  look?: "start" | "end" | null;
  /** A reaction burst replays whenever `burstKey` changes (reaction.n). */
  burst?: ReactionKind | null;
  burstKey?: number;
  crown?: boolean;
  class?: string;
  label?: string;
}

/** The SVG character from `@jamaa/shared/characters`. Decorative unless `label` is set (names are shown by the caller). */
export function Character({ color, size, expression = "idle", look = null, burst = null, burstKey, crown, class: cls, label }: CharacterProps) {
  const c = COLOR_BY_ID[color];
  if (size < FACE_MIN_SIZE) return <Avatar color={color} size={size} state={expression === "away" ? "away" : "normal"} host={crown} />;
  const shape = c.shape;
  const fb = FACE_BOXES[shape];
  const ink = c.glyph === "ink" ? INK : CREAM;
  const k = (fb.w / FACE_SPACE.w) * featureScale(size, shape);
  // Scale the face around its box centre so enlarged features stay centred on the body.
  const cx = fb.x + fb.w / 2, cy = fb.y + fb.h / 2;
  const lookDx = look === "end" ? LOOK_MAX : look === "start" ? -LOOK_MAX : 0;
  const face = `translate(${cx} ${cy}) scale(${k}) translate(${-FACE_SPACE.w / 2 + lookDx} ${-FACE_SPACE.h / 2})`;
  const extra = EXPRESSION_EXTRAS[expression];
  const [ex, ey] = EYE_OFFSET[expression] ?? [0, 0];
  // Body-relative extras (shared JAMAA-GAP): the facepalm hand disc over the eyes, the point nub on the look side.
  const eyeY = cy + (3.6 - FACE_SPACE.h / 2) * k;
  const nubStart = look === "start";
  return (
    <span class={`ch ch--${expression}${cls ? ` ${cls}` : ""}`} style={{ "--ch": `${size}px` }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}>
      <svg viewBox="-3 -5 30 32" width={size} height={size} focusable="false" class="ch__svg">
        <ellipse class="ch__shadow" cx="12" cy="25" rx="7.5" ry="1.3" />
        <g class="ch__rig">
          {extra === "nub" && (
            // Drawn under the body and starting inside it, so only 0.2 × body sticks out and it reads as attached.
            <rect class="ch__nub" x={nubStart ? 12 - 9 - 0.2 * BODY_W : 12} y={12.6} width={9 + 0.2 * BODY_W} height={2.8} rx={1.4} fill={c.hex} />
          )}
          <path class="ch__body" d={BODY_PATHS[shape]} fill={c.hex} stroke={RINGED.has(color) ? "rgba(255,247,236,.24)" : "none"} stroke-width="1" stroke-linejoin="round" />
          <g class="ch__face" key={expression} transform={face}>
            {EXPRESSION_FEATURES[expression].map((f, i) => feat(f, i, ink, expression))}
            {EYE_HIGHLIGHT.includes(expression) && ink === INK && (
              <g fill={CREAM}><circle cx={3.8 + ex + 0.35} cy={3.6 + ey - 0.45} r="0.35" /><circle cx={8.2 + ex + 0.35} cy={3.6 + ey - 0.45} r="0.35" /></g>
            )}
          </g>
          {extra === "hand" && <circle class="ch__hand" cx={cx} cy={eyeY} r={0.28 * BODY_W} fill={c.hex} stroke={ink} stroke-width="1" />}
          {crown && <path class="ch__crown" d="M7.5 -1.5l2 1.6L12 -3.6l2.5 3.7 2-1.6-.9 4.5H8.4z" fill="#FFC94D" stroke={INK} stroke-width=".5" stroke-linejoin="round" />}
        </g>
        {extra === "zzz" && <text class="ch__z" x="19" y="2" fill={CREAM}>z</text>}
        {extra === "check" && <g class="ch__badge"><circle cx="21" cy="3" r="3.2" fill="#3DDC97" /><path d="M19.4 3.1l1.1 1.1 2.2-2.3" fill="none" stroke={INK} stroke-width=".9" stroke-linecap="round" /></g>}
      </svg>
      {burst && <Burst key={burstKey} kind={burst} />}
    </span>
  );
}

/**
 * The reaction burst above the character (1.5 s, replays per reaction.n): a drawing, not the reaction button's icon
 * (DESIGN-JAMAA §4.3), with 3 boil tracings cycled at 8 fps (CSS; Calm / reduced motion keep the first).
 */
function Burst({ kind }: { kind: ReactionKind }) {
  const b = REACTION_BURST[kind].slice(6);
  return (
    <span class={`ch__burst ch__burst--${b}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="100%" height="100%" focusable="false">
        {burstTracings(b).map((parts, k) => (
          <g key={k} class={`ch__boil ch__boil--${k}`}>
            {parts.map((p, i) => p.stroke
              ? <path key={i} d={p.d} fill="none" stroke={p.stroke} stroke-width={p.width ?? 1.2} stroke-linecap="round" />
              : <path key={i} d={p.d} fill={p.fill} stroke={BURST_INK} stroke-width=".7" stroke-linejoin="round" />)}
          </g>
        ))}
      </svg>
    </span>
  );
}

/** `member.reaction` → the reaction expression for 1.5 s after each new `n` (never on first render: no replay on mount). */
export function useReaction(reaction: { kind: ReactionKind; n: number } | null): ReactionKind | null {
  const [shown, setShown] = useState<ReactionKind | null>(null);
  const seen = useRef(reaction?.n ?? 0);
  useEffect(() => {
    if (!reaction || reaction.n === seen.current) return;
    seen.current = reaction.n;
    setShown(reaction.kind);
    const id = setTimeout(() => setShown(null), REACTION_HOLD_MS);
    return () => clearTimeout(id);
  }, [reaction?.n]);
  return shown;
}

export interface MemberLike {
  id: string; color: ColorId; connected: boolean; reaction: { kind: ReactionKind; n: number } | null;
}

/** The expression from the PUBLIC view only (DESIGN-JAMAA §4.3 secrecy rule): away → reaction → done → think → idle. */
export function expressionOf(m: MemberLike, reaction: ReactionKind | null, status: { doneIds: readonly string[]; awaitedIds: readonly string[] } | null): Expression {
  if (!m.connected) return "away";
  if (reaction) return reaction;
  if (status?.doneIds.includes(m.id)) return "done";
  if (status?.awaitedIds.includes(m.id)) return "think";
  return "idle";
}

/** A member's character driven by the room's public state (reactions replay per `n`). */
export function MemberCharacter({ m, size, status, crown, class: cls, base }: {
  m: MemberLike; size: number; status?: { doneIds: readonly string[]; awaitedIds: readonly string[] } | null; crown?: boolean; class?: string; base?: Expression;
}) {
  const r = useReaction(m.reaction);
  const e = expressionOf(m, r, status ?? null);
  return <Character color={m.color} size={size} expression={e === "idle" && base ? base : e} burst={r} burstKey={m.reaction?.n} crown={crown} class={cls} />;
}
