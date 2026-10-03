import { describe, expect, it } from "vitest";
import { ClockOffset, fractionLeft, remainingMs, secondsLeft, timerTone } from "../src/lib/countdown";
import { canStep, stepValue } from "../src/lib/settings";
import { SETTINGS_BOUNDS } from "@mishana/shared/constants";

describe("countdown", () => {
  it("keeps the largest of the last 5 offset samples", () => {
    const c = new ClockOffset();
    expect(c.value).toBe(0);
    c.add(1000, 900); // +100
    c.add(1000, 950); // +50
    expect(c.value).toBe(100);
    for (let i = 0; i < 5; i++) c.add(1000, 990); // +10 ×5 evicts the +100
    expect(c.value).toBe(10);
  });
  it("computes remaining time from deadline.at − (now + offset)", () => {
    expect(remainingMs(10_000, 4_000, 1_000)).toBe(5_000);
    expect(remainingMs(10_000, 20_000, 0)).toBe(0);
    expect(secondsLeft(10_000, 4_001, 1_000)).toBe(5);
    expect(secondsLeft(10_000, 9_999, 0)).toBe(1);
    expect(fractionLeft(10_000, 10_000, 5_000, 0)).toBeCloseTo(0.5);
    expect(fractionLeft(10_000, 0, 5_000, 0)).toBe(0);
  });
  it("tones", () => {
    expect(timerTone(11)).toBe("normal");
    expect(timerTone(10)).toBe("warn");
    expect(timerTone(5)).toBe("danger");
  });
  it("settings steps: below min goes to off, up from off goes to min", () => {
    const b = SETTINGS_BOUNDS.clueSeconds;
    expect(stepValue(10, b, -1)).toBe(0);
    expect(stepValue(0, b, 1)).toBe(10);
    expect(stepValue(0, b, -1)).toBe(0);
    expect(stepValue(120, b, 1)).toBe(120);
    expect(stepValue(45, b, 1)).toBe(50);
    expect(stepValue(1, SETTINGS_BOUNDS.undercoverCount, -1)).toBe(1);
    expect(canStep(0, b, -1)).toBe(false);
    expect(stepValue(15, SETTINGS_BOUNDS.voteSeconds, -1)).toBe(0);
  });
});
