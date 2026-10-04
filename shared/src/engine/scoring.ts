import type { GameState, Role } from "./types";

const ROLE_KEY: Record<Role, "civilian" | "undercover" | "blank"> = { CIVILIAN: "civilian", UNDERCOVER: "undercover", BLANK: "blank" };

/** §4.11: every player id → points this game (0 for losers and left players). */
export function awardPoints(state: GameState, winnerIds: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of state.players) {
    out[p.id] = winnerIds.includes(p.id) && !p.left && p.role !== null ? state.settings.points[ROLE_KEY[p.role]] : 0;
  }
  return out;
}
