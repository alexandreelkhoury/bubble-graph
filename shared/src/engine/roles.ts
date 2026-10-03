import { MAX_PLAYERS, MIN_PLAYERS } from "../constants";
import type { Rng } from "./rng";
import type { Role, RoleCounts, Settings } from "./types";

// n:            3  4  5  6  7  8  9 10 11 12
const U_TABLE = [1, 1, 1, 1, 2, 2, 3, 3, 3, 3];
const B_TABLE = [0, 0, 1, 1, 1, 1, 1, 1, 1, 2];

export function defaultRoleCounts(n: number): RoleCounts | null {
  if (!Number.isInteger(n) || n < MIN_PLAYERS || n > MAX_PLAYERS) return null;
  const undercover = U_TABLE[n - MIN_PLAYERS] as number;
  const blank = B_TABLE[n - MIN_PLAYERS] as number;
  return { civilian: n - undercover - blank, undercover, blank };
}

export function validateRoleCounts(c: RoleCounts, n: number): boolean {
  return (
    c.civilian + c.undercover + c.blank === n &&
    c.undercover >= 1 &&
    c.undercover <= Math.floor((n - 1) / 2) &&
    c.blank >= 0 &&
    c.blank <= 2 &&
    c.civilian > c.undercover + c.blank
  );
}

export function effectiveRoleCounts(settings: Settings, n: number): RoleCounts | null {
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) return null;
  const c: RoleCounts | null =
    settings.roleMode === "auto"
      ? defaultRoleCounts(n)
      : { civilian: n - settings.undercoverCount - settings.blankCount, undercover: settings.undercoverCount, blank: settings.blankCount };
  return c && validateRoleCounts(c, n) ? c : null;
}

/** §4.5 assignment: Fisher–Yates over ids, then U, B, rest C. */
export function assignRoles(ids: readonly string[], counts: RoleCounts, rng: Rng): Map<string, Role> {
  const a = [...ids];
  for (let i = a.length - 1; i >= 1; i--) {
    const j = rng.int(i + 1);
    const t = a[i] as string;
    a[i] = a[j] as string;
    a[j] = t;
  }
  const out = new Map<string, Role>();
  a.forEach((id, i) => {
    out.set(id, i < counts.undercover ? "UNDERCOVER" : i < counts.undercover + counts.blank ? "BLANK" : "CIVILIAN");
  });
  return out;
}
