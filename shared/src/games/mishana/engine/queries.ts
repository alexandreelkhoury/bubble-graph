// Pure read-only queries over GameState. Never mutates and never sees a Draft, so the projection and the
// invariant checker can depend on it without depending on the transition modules.
import type { DeadlineKind, GameState, Phase, Player } from "./types";

/** Phases of a game in progress (dealt, not yet RESULTS). */
export const IN_GAME_PHASES = ["ROLE_REVEAL", "CLUES", "VOTING", "TIE_BREAK", "ELIMINATION", "MR_WHITE_GUESS"] as const;
/** In-game phases where the game can still be won by an elimination or forfeit (no verdict pending). */
export const PLAYING_PHASES = ["ROLE_REVEAL", "CLUES", "VOTING", "TIE_BREAK"] as const;

export function isInGame(phase: Phase): boolean {
  return (IN_GAME_PHASES as readonly Phase[]).includes(phase);
}

export function isPlaying(phase: Phase): boolean {
  return (PLAYING_PHASES as readonly Phase[]).includes(phase);
}

/** CLUES or TIE_BREAK: someone holds the floor. */
export function isSpeakingPhase(phase: Phase): phase is "CLUES" | "TIE_BREAK" {
  return phase === "CLUES" || phase === "TIE_BREAK";
}

export function findPlayer(s: GameState, id: string | null | undefined): Player | undefined {
  return id == null ? undefined : s.players.find((p) => p.id === id);
}

export function currentSpeakerId(s: GameState): string | null {
  if (!isSpeakingPhase(s.phase)) return null;
  return s.speakingOrder[s.turnIdx] ?? null;
}

/** Phase-inferred deadline kind (used by HOST_ADVANCE). */
export function inferKind(s: GameState): DeadlineKind | null {
  switch (s.phase) {
    case "ROLE_REVEAL": return "REVEAL";
    case "CLUES":
    case "TIE_BREAK": return "CLUE";
    case "VOTING": return "VOTE";
    case "ELIMINATION": return "ELIMINATION";
    case "MR_WHITE_GUESS": return s.guess?.status === "PENDING" ? "GUESS" : "VERDICT";
    default: return null;
  }
}
