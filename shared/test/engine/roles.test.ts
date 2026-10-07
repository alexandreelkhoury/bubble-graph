import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/engine/settings";
import { assignRoles, defaultRoleCounts, effectiveRoleCounts, validateRoleCounts } from "../../src/engine/roles";
import { createRng } from "../../src/engine/rng";

// Rules v2: [undercover, blank (Mole), civilian]. Automatic mode deals Moles only: 1 for 3–6 players, 2 for 7–12.
const TABLE: Record<number, [number, number, number]> = {
  3: [0, 1, 2], 4: [0, 1, 3], 5: [0, 1, 4], 6: [0, 1, 5], 7: [0, 2, 5], 8: [0, 2, 6], 9: [0, 2, 7], 10: [0, 2, 8], 11: [0, 2, 9], 12: [0, 2, 10],
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
    expect(validateRoleCounts({ civilian: 2, undercover: 1, blank: 0 }, 3)).toBe(true); // Undercover only
    expect(validateRoleCounts({ civilian: 2, undercover: 0, blank: 1 }, 3)).toBe(true); // Mole only
    expect(validateRoleCounts({ civilian: 2, undercover: 1, blank: 0 }, 4)).toBe(false); // sum
    expect(validateRoleCounts({ civilian: 3, undercover: 0, blank: 0 }, 3)).toBe(false); // no impostor
    expect(validateRoleCounts({ civilian: 3, undercover: 2, blank: 0 }, 5)).toBe(true);
    expect(validateRoleCounts({ civilian: 3, undercover: 0, blank: 2 }, 5)).toBe(true);
    expect(validateRoleCounts({ civilian: 3, undercover: 1, blank: 1 }, 5)).toBe(true); // mixed
    expect(validateRoleCounts({ civilian: 3, undercover: 3, blank: 0 }, 6)).toBe(false); // C > U+B
    expect(validateRoleCounts({ civilian: 3, undercover: 0, blank: 3 }, 6)).toBe(false); // C > U+B
    expect(validateRoleCounts({ civilian: 3, undercover: 1, blank: 2 }, 6)).toBe(false); // C > U+B
    expect(validateRoleCounts({ civilian: 7, undercover: 0, blank: 5 }, 12)).toBe(true); // B at its max
    expect(validateRoleCounts({ civilian: 7, undercover: 5, blank: 0 }, 12)).toBe(true); // U at its max
    expect(validateRoleCounts({ civilian: 6, undercover: 0, blank: 6 }, 12)).toBe(false); // B > max (and C > U+B)
    expect(validateRoleCounts({ civilian: 5, undercover: 1, blank: -1 }, 5)).toBe(false);
    expect(validateRoleCounts({ civilian: 5, undercover: -1, blank: 1 }, 5)).toBe(false);
    expect(validateRoleCounts({ civilian: 3, undercover: 0.5, blank: 0.5 }, 4)).toBe(false);
  });
  it("custom mode: civilian = n − U − B and invalid combos are null", () => {
    const s = { ...DEFAULT_SETTINGS, roleMode: "custom" as const, undercoverCount: 2, blankCount: 2 };
    expect(effectiveRoleCounts(s, 12)).toEqual({ civilian: 8, undercover: 2, blank: 2 });
    expect(effectiveRoleCounts(s, 5)).toBeNull();
    expect(effectiveRoleCounts({ ...s, undercoverCount: 5, blankCount: 0 }, 12)).toEqual({ civilian: 7, undercover: 5, blank: 0 });
    expect(effectiveRoleCounts({ ...s, undercoverCount: 5, blankCount: 1 }, 12)).toBeNull(); // 6 > 6 fails
    expect(effectiveRoleCounts({ ...s, undercoverCount: 5, blankCount: 2 }, 12)).toBeNull();
    expect(effectiveRoleCounts({ ...s, undercoverCount: 0, blankCount: 5 }, 12)).toEqual({ civilian: 7, undercover: 0, blank: 5 });
    expect(effectiveRoleCounts({ ...s, undercoverCount: 0, blankCount: 0 }, 6)).toBeNull(); // no impostor
    expect(effectiveRoleCounts({ ...s, undercoverCount: 0, blankCount: 1 }, 3)).toEqual({ civilian: 2, undercover: 0, blank: 1 });
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
