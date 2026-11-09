// JAMAA-PLATFORM §3.4: the world palettes come from `@jamaa/shared/worlds` (each G lane edits only its own entry there).
// vite.config.ts turns them into CSS at build time (the `virtual:jamaa-worlds.css` module imported by main.tsx): the
// `--w-*` custom properties on `[data-world]`, night-market also on :root. No palette data ships in the phone's JS.
// The `[data-world]` stage gradient and every consumer live in styles/platform.css.
import type { WorldId, WorldToken } from "@jamaa/shared/worlds";

const rgb = (hex: string): string => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

/** The CSS for every world's web tokens (a world without a signal colour uses its glow). */
export function worldCss(ids: readonly WorldId[], color: (w: WorldId, t: WorldToken, surface: "web") => string | null): string {
  return ids.map((w) => {
    const c = (t: WorldToken): string => color(w, t, "web") ?? color(w, "glow", "web")!;
    const sel = w === "night-market" ? `:root,[data-world="${w}"]` : `[data-world="${w}"]`;
    return `${sel}{--w-deep:${c("deep")};--w-top:${c("stageTop")};--w-surface:${c("surface")};--w-elevated:${c("elevated")};`
      + `--w-accent:${c("accent")};--w-accent-text:${c("accentText")};--w-on-accent:${c("onAccent")};--w-glow:${c("glow")};`
      + `--w-signal:${c("signal")};--w-rgb-accent:${rgb(c("accent"))};--w-rgb-glow:${rgb(c("glow"))}}`;
  }).join("\n");
}
