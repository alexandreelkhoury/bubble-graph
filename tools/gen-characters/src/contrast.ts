// WCAG 2.x contrast for the world palettes (JAMAA-PLATFORM §3.4, DESIGN §2.4 thresholds, DESIGN-JAMAA §1.5 / §9).
// The generator refuses to emit WorldColors.kt when a rule fails; the tests run the same rules on DESIGN.md §2.5.
import type { WorldToken } from "./model";

export const CREAM = "#FFF7EC"; // color.text
export const TEXT_MUTED = "#B8A8D6"; // color.textMuted (palette B; lowest allowed text colour)
export const INK = "#120A1F"; // color.ink

/** Body text ≥ 4.5:1; large text and graphics ≥ 3:1 (DESIGN §2.4). */
export const BODY = 4.5;
export const LARGE = 3;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1] as string, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A foreground (token or fixed colour) on a background token, with its minimum ratio. */
export interface ContrastRule { fg: WorldToken | { hex: string; name: string }; bg: WorldToken; min: number; why: string }

/**
 * The checked pairs (DESIGN-JAMAA §1.5, "Measured"): cream text on every stage token, muted text and the accent as text
 * on surface, text on the accent, and the accent, glow and signal as graphics on the stage.
 */
export const WORLD_RULES: readonly ContrastRule[] = [
  { fg: { hex: CREAM, name: "text" }, bg: "deep", min: BODY, why: "body text on the stage" },
  { fg: { hex: CREAM, name: "text" }, bg: "stageTop", min: BODY, why: "body text on the lightest stage point" },
  { fg: { hex: CREAM, name: "text" }, bg: "surface", min: BODY, why: "body text on cards" },
  { fg: { hex: CREAM, name: "text" }, bg: "elevated", min: BODY, why: "body text on raised cards and sheets" },
  { fg: { hex: TEXT_MUTED, name: "textMuted" }, bg: "surface", min: BODY, why: "hints on cards" },
  { fg: "accentText", bg: "surface", min: BODY, why: "accent as text or a thin line" },
  { fg: "onAccent", bg: "accent", min: BODY, why: "labels on accent fills" },
  { fg: "accent", bg: "deep", min: LARGE, why: "accent fills and large text on the stage" },
  { fg: "glow", bg: "deep", min: LARGE, why: "glow graphics on the stage" },
  { fg: "signal", bg: "deep", min: LARGE, why: "the game's signal stamp on the stage" },
];

export interface ContrastResult { rule: ContrastRule; ratio: number; ok: boolean; label: string }

/** Every rule on one palette; rules whose colour is absent (night-market has no signal) are skipped. */
export function checkPalette(p: Readonly<Record<WorldToken, string | null>>): ContrastResult[] {
  const out: ContrastResult[] = [];
  for (const rule of WORLD_RULES) {
    const fg = typeof rule.fg === "string" ? p[rule.fg] : rule.fg.hex;
    const bg = p[rule.bg];
    if (fg === null || bg === null) continue;
    const ratio = contrast(fg, bg);
    const fgName = typeof rule.fg === "string" ? rule.fg : rule.fg.name;
    out.push({ rule, ratio, ok: ratio >= rule.min, label: `${fgName} on ${rule.bg} ${ratio.toFixed(2)}:1 (min ${rule.min}, ${rule.why})` });
  }
  return out;
}

/** Player colours under 3:1 on a background: they get the 2 dp cream ring at 24 % (DESIGN §2.3, DESIGN-JAMAA §1.5). */
export function needsRing(players: readonly { id: string; hex: string }[], bg: string): string[] {
  return players.filter((pl) => contrast(pl.hex, bg) < LARGE).map((pl) => pl.id);
}
