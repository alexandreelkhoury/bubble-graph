import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CUES, fileName } from "../src/cues";
import { SR } from "../src/dsp";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cueIndex, GAME_IDS, loadGameCues, render, soundCuesKt, verify } from "../src/main";
import { ALIASES, PLATFORM_CUES } from "../src/platform-cues";

const root = resolve(__dirname, "../../..");

describe("gen-sounds", () => {
  it("maps DESIGN ids to res/raw-safe file names", () => {
    expect(fileName("sfx.allReady")).toBe("sfx_all_ready");
    expect(fileName("sting.winInfiltrators")).toBe("sting_win_infiltrators");
    for (const c of CUES) expect(fileName(c.id)).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(new Set(CUES.map((c) => c.id)).size).toBe(CUES.length);
  });

  it("keeps DESIGN §6.4 lengths: SFX ≤ 1.5 s (the roll and wheel span the reveal), stings ≤ 3 s", () => {
    for (const c of CUES) {
      const max = c.bus === "sting" ? 3 : c.id === "sfx.drumroll" || c.id === "sfx.wheel" ? 2.5 : 1.5;
      expect(c.seconds, c.id).toBeLessThanOrEqual(max);
    }
  });

  it.each(CUES.map((c) => c.id))("%s renders deterministically, audibly, with peaks ≤ −1 dBFS", (id) => {
    const a = render(id), b = render(id);
    expect(Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer))).toBe(true);
    let peak = 0, energy = 0;
    for (const v of a.data) {
      expect(Number.isFinite(v)).toBe(true);
      peak = Math.max(peak, Math.abs(v));
      energy += v * v;
    }
    expect(peak).toBeLessThanOrEqual(Math.pow(10, -1 / 20) + 1e-6);
    expect(Math.sqrt(energy / a.length)).toBeGreaterThan(0.002);
    // Starts and ends at silence (no clicks).
    expect(Math.abs(a.get(0))).toBeLessThan(1e-3);
    expect(Math.abs(a.get(a.length - 1))).toBeLessThan(1e-3);
    expect(a.length).toBe(Math.round(CUES.find((c) => c.id === id)!.seconds * SR));
  });

  it("the committed OGG files match the catalogue and fit the 400 KB budget", async () => {
    expect(verify(root, await loadGameCues())).toEqual([]);
  });

  it("has every JAMAA-PLATFORM §3.11 platform cue, with game-doc names as aliases of real cues", () => {
    const want = ["hub_move", "portal_open", "portal_close", ...GAME_IDS.map((g) => `world_${g}_sting`), "coin_fly", "coin_land", "counter_tick",
      "crown_drop", "cup_star", "reaction_pop", "answer_lock", "truth_reveal", "house_got_you", "quiz_correct", "quiz_wrong"];
    expect(PLATFORM_CUES.map((c) => c.id).sort()).toEqual([...want].sort());
    for (const id of want) expect(fileName(id)).toBe(id);
    for (const target of Object.values(ALIASES)) expect(CUES.some((c) => c.id === target), target).toBe(true);
    // The portal sound fits the first-open portal (§3.10 A, 1 100 ms); world stings fit the entrance (≤ 2 000 ms).
    expect(PLATFORM_CUES.find((c) => c.id === "portal_open")?.seconds).toBeLessThanOrEqual(1.1);
    for (const g of GAME_IDS) expect(PLATFORM_CUES.find((c) => c.id === `world_${g}_sting`)?.seconds).toBeLessThanOrEqual(2);
  });

  it("loads the per-game manifests (P: empty stubs) and emits per-game indexes", async () => {
    const games = await loadGameCues();
    expect(Object.keys(games)).toEqual([...GAME_IDS]);
    const dir = mkdtempSync(join(tmpdir(), "gen-sounds-cues-"));
    for (const g of GAME_IDS) writeFileSync(join(dir, `${g}.mjs`), g === "trivia" ? `export const CUES = [{ id: "trivia.fixtureOnly", bus: "sfx", seconds: 0.2, targetDb: -20, render() {} }];` : "export const CUES = [];");
    const loaded = await loadGameCues(dir);
    expect(loaded.trivia.map((c) => c.id)).toEqual(["trivia.fixtureOnly"]);
    expect(soundCuesKt("trivia", loaded.trivia)).toContain(`"trivia.fixtureOnly" to R.raw.trivia_fixture_only,`);
    expect(soundCuesKt("trivia", loaded.trivia)).toContain("package app.jamaa.tv.games.trivia");
    expect(JSON.parse(cueIndex(loaded.trivia, null))).toEqual({ generatedBy: "tools/gen-sounds", cues: { "trivia.fixtureOnly": "trivia_fixture_only" } });
    // A missing generated game file is reported.
    expect(verify(root, loaded).some((p) => p.includes("trivia_fixture_only.ogg is missing"))).toBe(true);
    const bad = mkdtempSync(join(tmpdir(), "gen-sounds-bad-"));
    for (const g of GAME_IDS) writeFileSync(join(bad, `${g}.mjs`), g === "bluff" ? `export const CUES = [{ id: "trivia.x", bus: "sfx", seconds: 0.1, targetDb: -20, render() {} }];` : "export const CUES = [];");
    await expect(loadGameCues(bad)).rejects.toThrow('must start with "bluff."');
  });
});
