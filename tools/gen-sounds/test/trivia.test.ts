// GAME-TRIVIA §12.6: the trivia cue manifest (cues/trivia.mjs) and its generated files.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CUES as ROOT_CUES, fileName, type CueDef } from "../src/cues";
import { SR } from "../src/dsp";
import { GAME_BUDGET_BYTES, loadGameCues, render, verify } from "../src/main";
import { ALIASES } from "../src/platform-cues";

const root = resolve(__dirname, "../../..");
const games = await loadGameCues();
const trivia: readonly CueDef[] = games.trivia;

describe("trivia cues", () => {
  it("defines every GAME-TRIVIA §12.6 cue that the platform does not already provide", () => {
    const own = trivia.map((c) => c.id).sort();
    expect(own).toEqual(["trivia.finalQuestion", "trivia.flame", "trivia.genius", "trivia.lightsOn", "trivia.podium", "trivia.slam", "trivia.tileFlip", "trivia.timeUp", "trivia.zap"].sort());
    // buzz / correct / wrong and the intro sting are platform cues reached through aliases.
    for (const a of ["trivia.buzz", "trivia.correct", "trivia.wrong", "sting.triviaIntro"]) {
      expect(ALIASES[a], a).toBeDefined();
      expect(ROOT_CUES.some((c) => c.id === ALIASES[a])).toBe(true);
    }
    for (const c of trivia) expect(fileName(c.id)).toMatch(/^trivia_[a-z0-9_]+$/);
  });

  it("keeps DESIGN lengths: SFX ≤ 1.5 s, stings ≤ 3 s; the clunk fits the 120 ms spotlight cadence with overlap", () => {
    for (const c of trivia) expect(c.seconds, c.id).toBeLessThanOrEqual(c.bus === "sting" ? 3 : 1.5);
    expect(trivia.find((c) => c.id === "trivia.tileFlip")?.seconds).toBeLessThanOrEqual(0.15);
  });

  it.each(trivia.map((c) => c.id))("%s renders deterministically, audibly, peaks ≤ −1 dBFS, no clicks", (id) => {
    const a = render(id, trivia), b = render(id, trivia);
    expect(Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer))).toBe(true);
    let peak = 0, energy = 0;
    for (const v of a.data) {
      expect(Number.isFinite(v)).toBe(true);
      peak = Math.max(peak, Math.abs(v));
      energy += v * v;
    }
    expect(peak).toBeLessThanOrEqual(Math.pow(10, -1 / 20) + 1e-6);
    expect(Math.sqrt(energy / a.length)).toBeGreaterThan(0.002);
    expect(Math.abs(a.get(0))).toBeLessThan(1e-3);
    expect(Math.abs(a.get(a.length - 1))).toBeLessThan(1e-3);
    expect(a.length).toBe(Math.round((trivia.find((c) => c.id === id) as CueDef).seconds * SR));
  });

  it("the generated OGG files, index.json and SoundCuesTrivia.kt are present, current and within the game budget", () => {
    // Other game lanes regenerate their own files in parallel: only this game's problems (and the root set) count here.
    const problems = verify(root, games).filter((p) => p.includes("trivia") || !/\/(mishana|bluff|likely)[_/]/.test(p));
    expect(problems).toEqual([]);
    expect(GAME_BUDGET_BYTES).toBe(120 * 1024);
  });
});
