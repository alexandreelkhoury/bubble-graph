import type { GameState, Winner } from "./types";

/** §4.10. Only CIVILIANS / INFILTRATORS (a Blank win is decided by resolveGuess). */
export function checkWinner(state: GameState): Winner | null {
  let aliveC = 0;
  let aliveI = 0;
  for (const p of state.players) {
    if (!p.alive || p.role === null) continue;
    if (p.role === "CIVILIAN") aliveC++;
    else aliveI++;
  }
  if (aliveI === 0) return "CIVILIANS";
  if (state.settings.winRule === "official" && aliveC <= 1) return "INFILTRATORS";
  if (state.settings.winRule === "parity" && aliveI >= aliveC) return "INFILTRATORS";
  return null;
}
