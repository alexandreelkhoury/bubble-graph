// DESIGN-JAMAA §4.3 / art board 03 ("controls stay controls, bursts are drawings"): the six reaction bursts as small
// hand-drawn SVG pictures (tears, "!", sweat drop, heart, rain cloud, confetti), each with 3 boil tracings cycled at
// 8 fps. The reaction BUTTONS keep their UI icons; only the burst above a character is a drawing.
// JAMAA-GAP (lane D): this geometry belongs in shared/src/characters (with a generated Kotlin copy) so the native TV
// draws the same pictures; it lives here until lane D moves it. Paths use only M/L/C/Z (no arcs), so a boil tracing
// is the base path with every coordinate nudged by a seeded ±BOIL_JITTER.

/** One part of a burst drawing in a 24 × 24 box: a filled shape (ink outline) or an ink-free stroke. */
export interface BurstPart { d: string; fill?: string; stroke?: string; width?: number }

const INK = "#120A1F";
export const BOIL_TRACINGS = 3;
export const BOIL_FPS = 8;
export const BOIL_JITTER = 0.35;

const BLUE = "#7BD3FF", SKY = "#9FE4FF", GOLD = "#FFC94D", ROSE = "#FF7AB3", LILAC = "#C9BFFF", CORAL = "#FF6B5E", JADE = "#3DDC97";

/** Shared burst id (REACTION_BURST, without "burst.") → its drawing. */
export const BURST_ART: Readonly<Record<string, readonly BurstPart[]>> = {
  // Tears of laughter: a drop flying off each side, two small ones behind.
  tears: [
    { d: "M4.6 8.4C3 10.6 2.3 12.2 3.1 13.4 3.9 14.4 5.6 14.1 5.9 12.7 6.2 11.6 5.6 10.1 4.6 8.4Z", fill: BLUE },
    { d: "M19.4 8.4C21 10.6 21.7 12.2 20.9 13.4 20.1 14.4 18.4 14.1 18.1 12.7 17.8 11.6 18.4 10.1 19.4 8.4Z", fill: BLUE },
    { d: "M2.2 4.6C1.6 5.6 1.4 6.3 1.8 6.8 2.2 7.2 2.9 7 3 6.4 3.1 5.9 2.8 5.3 2.2 4.6Z", fill: BLUE },
    { d: "M21.8 4.6C22.4 5.6 22.6 6.3 22.2 6.8 21.8 7.2 21.1 7 21 6.4 20.9 5.9 21.2 5.3 21.8 4.6Z", fill: BLUE },
  ],
  // "!": a tapered bar, a dot, and two shock ticks.
  exclaim: [
    { d: "M10.4 2.6L13.8 2.6 13 14.2 11.2 14.2Z", fill: GOLD },
    { d: "M12.1 16.2C13.2 16.2 13.9 17 13.9 18 13.9 19 13.1 19.8 12.1 19.8 11.1 19.8 10.3 19 10.3 18 10.3 17 11 16.2 12.1 16.2Z", fill: GOLD },
    { d: "M5.4 5.2L8 7.6M18.6 5.2L16 7.6", stroke: GOLD, width: 1.4 },
  ],
  // Sweat: one big drop on the side of the head and a small one.
  sweat: [
    { d: "M17.4 2.4C15.2 5.8 14.2 7.8 14.8 9.5 15.4 11 17.3 11.4 18.6 10.4 19.9 9.3 19.7 7.4 17.4 2.4Z", fill: SKY },
    { d: "M20.8 12.2C20.1 13.3 19.8 14 20.2 14.6 20.6 15.1 21.4 14.9 21.6 14.3 21.7 13.8 21.4 13.1 20.8 12.2Z", fill: SKY },
  ],
  // Heart, with a small spark.
  heart: [
    { d: "M12 20.4C9 18.4 3.8 14.8 3.8 10.4 3.8 7.7 5.8 6 8 6 9.8 6 11.2 7 12 8.5 12.8 7 14.2 6 16 6 18.2 6 20.2 7.7 20.2 10.4 20.2 14.8 15 18.4 12 20.4Z", fill: ROSE },
    { d: "M19.6 2.6L19.6 4.8M18.5 3.7L20.7 3.7", stroke: ROSE, width: 1.2 },
  ],
  // Rain cloud: a lumpy cloud and three rain strokes.
  raincloud: [
    { d: "M6.5 13.6C4.5 13.6 3 12.3 3 10.5 3 8.8 4.4 7.5 6.2 7.5 6.8 5.3 8.8 3.8 11.2 3.8 13.9 3.8 16 5.7 16.3 8.2 18.6 8.3 20.6 9.7 20.6 11.6 20.6 12.8 19.4 13.6 18 13.6Z", fill: LILAC },
    { d: "M8 16.2L7 19.4M12.2 16.2L11.2 19.4M16.4 16.2L15.4 19.4", stroke: BLUE, width: 1.4 },
  ],
  // Confetti: tumbling scraps in four colours and a curly streamer.
  confetti: [
    { d: "M3.6 6.2L6.2 5.4 7 8 4.4 8.8Z", fill: CORAL },
    { d: "M16.8 3.4L19.2 4.3 18.3 6.7 15.9 5.8Z", fill: JADE },
    { d: "M9.6 1.8L11.4 3.8 9.4 5.6 7.6 3.6Z", fill: GOLD },
    { d: "M18.8 11.6L21.4 11.8 21.2 14.4 18.6 14.2Z", fill: LILAC },
    { d: "M2.8 14.2L5 12.9 6.3 15.1 4.1 16.4Z", fill: GOLD },
    { d: "M12.4 8.6C13.6 10.2 11.2 11.2 12.4 12.8 13.6 14.4 11.2 15.4 12.4 17", stroke: ROSE, width: 1.2 },
  ],
};

/** A small deterministic PRNG (mulberry32): the same tracings on every render and device. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tracing `k` of a path: k = 0 is the base drawing; 1 and 2 nudge every coordinate by up to ±jitter. */
export function boilPath(d: string, k: number, seed: number, jitter = BOIL_JITTER): string {
  if (k === 0) return d;
  const r = rng(seed * 31 + k * 977);
  return d.replace(/-?\d*\.?\d+/g, (n) => String(Math.round((Number(n) + (r() * 2 - 1) * jitter) * 100) / 100));
}

/** The 3 tracings of a burst, part by part. */
export function burstTracings(id: string): BurstPart[][] {
  const parts = BURST_ART[id] ?? [];
  return Array.from({ length: BOIL_TRACINGS }, (_, k) => parts.map((p, i) => ({ ...p, d: boilPath(p.d, k, i + id.length * 7) })));
}

export const BURST_INK = INK;
