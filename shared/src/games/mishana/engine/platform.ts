// JAMAA-PLATFORM §2.7: the three engine additions the platform adapter needs. Pure; each returns the SAME object when
// nothing changes, and a new object (version + 1) otherwise. Engine-only callers never use them.
import type { GameState } from "./types";

function bump(s: GameState, next: GameState): GameState {
  return { ...next, version: s.version + 1 };
}

/**
 * Sets the engine host to the room's host. An id that is not a live (non-left) engine player becomes null (the room's
 * host may be a benched member who is not in this game). Marks the state `externalHost`, so `reassignHost` is bypassed.
 */
export function syncHost(s: GameState, hostId: string | null): GameState {
  const p = hostId === null ? undefined : s.players.find((x) => x.id === hostId);
  const id = p && !p.left ? p.id : null;
  if (s.hostPlayerId === id && s.externalHost === true) return s;
  return bump(s, { ...s, hostPlayerId: id, externalHost: true });
}

/** Sets each listed player's `score` (the carried match score; Mish Ana! is the only `carriesScore` game). */
export function seedScores(s: GameState, scores: Readonly<Record<string, number>>): GameState {
  let changed = false;
  const players = s.players.map((p) => {
    const v = scores[p.id];
    if (v === undefined || v === p.score) return p;
    changed = true;
    return { ...p, score: v };
  });
  return changed ? bump(s, { ...s, players }) : s;
}

/**
 * Adds `ms` to the current deadline's `at` (no-op when the deadline is null, i.e. timers off, or `ms <= 0`).
 * `durationMs` is kept, so clients show a full timer ring through the entrance and then the phase's normal countdown.
 */
export function extendFirstDeadline(s: GameState, ms: number): GameState {
  if (s.deadline === null || ms <= 0) return s;
  return bump(s, { ...s, deadline: { ...s.deadline, at: s.deadline.at + ms } });
}
