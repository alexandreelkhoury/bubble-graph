import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/engine/settings";
import { assignRoles, defaultRoleCounts, effectiveRoleCounts, validateRoleCounts } from "../../src/engine/roles";
import { createRng } from "../../src/engine/rng";

const TABLE: Record<number, [number, number, number]> = {
  3: [1, 0, 2], 4: [1, 0, 3], 5: [1, 1, 3], 6: [1, 1, 4], 7: [2, 1, 4], 8: [2, 1, 5], 9: [3, 1, 5], 10: [3, 1, 6], 11: [3, 1, 7], 12: [3, 2, 7],
};

describe("roles", () => {
  it.each(Object.entries(TABLE))("default table n=%s", (n, [u, b, c]) => {
    const rc = defaultRoleCounts(Number(n));
    expect(rc).toEqual({ civilian: c, undercover: u, blank: b });
    expect(validateRoleCounts(rc!, Number(n))).toBe(true);
    expect(effectiveRoleCounts(DEFAULT_SETTINGS, Number(n))).toEqual(rc);
  });
  it("defaultRoleCounts rejects out of range", () => {
    expect(defaultRoleCounts(2)).toBeNull();
    expect(defaultRoleCounts(13)).toBeNull();
    expect(defaultRoleCounts(3.5)).toBeNull();
  });
  it("validateRoleCounts edges", () => {
    expect(validateRoleCounts({ civilian: 2, undercover: 1, blank: 0 }, 3)).toBe(true);
    expect(validateRoleCounts({ civilian: 2, undercover: 1, blank: 0 }, 4)).toBe(false); // sum
    expect(validateRoleCounts({ civilian: 3, undercover: 0, blank: 0 }, 3)).toBe(false); // U >= 1
    expect(validateRoleCounts({ civilian: 3, undercover: 2, blank: 0 }, 5)).toBe(true); // U <= floor(4/2)=2, 3 > 2
    expect(validateRoleCounts({ civilian: 4, undercover: 2, blank: 0 }, 6)).toBe(true);
    expect(validateRoleCounts({ civilian: 3, undercover: 3, blank: 0 }, 6)).toBe(false); // U > floor(5/2)
    expect(validateRoleCounts({ civilian: 3, undercover: 1, blank: 2 }, 6)).toBe(false); // C > U+B
    expect(validateRoleCounts({ civilian: 6, undercover: 1, blank: 3 }, 10)).toBe(false); // B <= 2
    expect(validateRoleCounts({ civilian: 5, undercover: 1, blank: -1 }, 5)).toBe(false);
  });
  it("custom mode: civilian = n − U − B and invalid combos are null", () => {
    const s = { ...DEFAULT_SETTINGS, roleMode: "custom" as const, undercoverCount: 2, blankCount: 2 };
    expect(effectiveRoleCounts(s, 12)).toEqual({ civilian: 8, undercover: 2, blank: 2 });
    expect(effectiveRoleCounts(s, 5)).toBeNull();
    expect(effectiveRoleCounts({ ...s, undercoverCount: 5, blankCount: 0 }, 12)).toEqual({ civilian: 7, undercover: 5, blank: 0 });
    expect(effectiveRoleCounts({ ...s, undercoverCount: 5, blankCount: 1 }, 12)).toBeNull(); // 6 > 6 fails
    expect(effectiveRoleCounts({ ...s, undercoverCount: 5, blankCount: 2 }, 12)).toBeNull();
    expect(effectiveRoleCounts(s, 2)).toBeNull();
    expect(effectiveRoleCounts(s, 13)).toBeNull();
  });
  it("assignRoles: Fisher–Yates with the given counts", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const m = assignRoles(ids, { civilian: 4, undercover: 2, blank: 1 }, createRng(9));
    const counts = { CIVILIAN: 0, UNDERCOVER: 0, BLANK: 0 };
    for (const r of m.values()) counts[r]++;
    expect(counts).toEqual({ CIVILIAN: 4, UNDERCOVER: 2, BLANK: 1 });
    expect(assignRoles(ids, { civilian: 4, undercover: 2, blank: 1 }, createRng(9))).toEqual(m);
  });
});
