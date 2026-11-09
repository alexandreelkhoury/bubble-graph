// GAME-TRIVIA §8.2 + DESIGN-JAMAA §1.5: the four answer tokens (sun, wave, leaf, spark) and True/False (check, cross)
// as inline SVG in the Trivia chunk (no network fetch: the pad renders within 100 ms of the ANSWER snapshot, §8.4).
// Shapes, not colours, identify answers (CVD); the letters stay Latin in every locale. Original drawings.
import type { TokenId } from "./model";

/** DESIGN-JAMAA §1.5 final palette-B values (web and /tv). */
export const TOKEN_HEX: Record<TokenId, string> = {
  a: "#FFC94D", b: "#478CFF", c: "#1FA88A", d: "#FF4F9A", true: "#1FA88A", false: "#F0183A",
};
/** i18n key of each token's accessible name ("Sun", "Wave"…; True/False use the tf words). */
export const TOKEN_KEY = {
  a: "game.trivia.token.a", b: "game.trivia.token.b", c: "game.trivia.token.c", d: "game.trivia.token.d",
  true: "game.trivia.tf.true", false: "game.trivia.tf.false",
} as const;

const INK = "#120A1F";
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const r1 = 7.6, r2 = 10.4;
  return `M${(12 + r1 * Math.cos(a)).toFixed(2)} ${(12 + r1 * Math.sin(a)).toFixed(2)}L${(12 + r2 * Math.cos(a)).toFixed(2)} ${(12 + r2 * Math.sin(a)).toFixed(2)}`;
}).join("");

/** One token glyph in `color` (ink on the tile fill by default). Decorative: the tile carries the label. */
export function TokenShape({ id, size, color = INK, class: cls }: { id: TokenId; size: number; color?: string; class?: string }) {
  return (
    <svg class={`tq-shape tq-shape--${id}${cls ? ` ${cls}` : ""}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {id === "a" && <g fill={color} stroke={color}><circle cx="12" cy="12" r="5.2" stroke="none" /><path d={RAYS} stroke-width="2.2" stroke-linecap="round" fill="none" /></g>}
      {id === "b" && <path d="M2.5 9.2c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0 3.6-2 4.6-1.4M2.5 15.6c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0 3.6-2 4.6-1.4" fill="none" stroke={color} stroke-width="2.8" stroke-linecap="round" />}
      {id === "c" && <g><path d="M4.2 19.8C3.6 10.4 9.6 3.8 20.6 3.4c.6 10.6-5.8 16.8-16.4 16.4z" fill={color} /><path d="M5.6 18.4C9.4 14 12.6 10.8 16.6 7.6" fill="none" stroke={color === INK ? "#FFF7EC" : INK} stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round" /></g>}
      {id === "d" && <path d="M12 1.6l2.5 7.9 7.9 2.5-7.9 2.5-2.5 7.9-2.5-7.9L1.6 12l7.9-2.5z" fill={color} stroke={color} stroke-width="1" stroke-linejoin="round" />}
      {id === "true" && <path d="M4.6 12.6l4.8 4.8L19.6 7" fill="none" stroke={color} stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />}
      {id === "false" && <path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8" fill="none" stroke={color} stroke-width="3.4" stroke-linecap="round" />}
    </svg>
  );
}

/** A small filled token chip (the phone's "your pick" glyph, the right answer in a verdict, the TV tower). */
export function TokenChip({ id, size = 24 }: { id: TokenId; size?: number }) {
  return (
    <span class={`tq-chip tq-chip--${id}`} style={{ width: `${size}px`, height: `${size}px`, background: TOKEN_HEX[id] }} aria-hidden="true">
      <TokenShape id={id} size={Math.round(size * 0.68)} />
    </span>
  );
}

/** The lightning bolt (fastest finger) and the streak flame: original, palette-based glyphs. */
export function Bolt({ size }: { size: number }) {
  return (
    <svg class="tq-bolt" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M13.6 1.8L4.6 13.4h6.2l-1.6 8.8 9.4-12.2h-6.4z" fill="#FFF04D" stroke={INK} stroke-width="1.1" stroke-linejoin="round" />
    </svg>
  );
}
export function Flame({ size, level = 1 }: { size: number; level?: number }) {
  return (
    <svg class={`tq-flame tq-flame--${level}`} viewBox="0 0 24 32" width={size} height={(size * 32) / 24} aria-hidden="true">
      <path d="M12 1.5c1.2 4.6 6.6 7.6 7.8 13.4 1.2 6-2.8 15.2-7.8 15.2S2.8 25.6 4 19.8c.8-3.6 3.2-5 3.8-8.2 2.2 2 2.4 4 2.4 4C12.4 11.8 10.6 6 12 1.5z" fill="#FF7A1F" />
      <path d="M12.2 13.6c.8 3 4.4 4.8 4.4 9 0 3.6-2.2 5.8-4.6 5.8s-4.6-2.2-4.2-5.4c.4-2.4 2-3.4 2.6-5.4 1 1 1.4 2.2 1.4 2.2.8-2 .2-4.2.4-6.2z" fill="#FFF04D" />
    </svg>
  );
}
export function Star({ size, on }: { size: number; on: boolean }) {
  return (
    <svg class={`tq-star${on ? " is-on" : ""}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2.2l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.2l-6 3.3 1.3-6.7-5-4.6 6.8-.8z" stroke-width="1.6" stroke-linejoin="round" />
    </svg>
  );
}
