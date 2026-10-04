import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CUES, fileName } from "../src/cues";
import { SR } from "../src/dsp";
import { render, verify } from "../src/main";

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

  it("the committed OGG files match the catalogue and fit the 400 KB budget", () => {
    expect(verify(root)).toEqual([]);
  });
});
