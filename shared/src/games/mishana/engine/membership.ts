// Seat and host bookkeeping. No phase transitions here (see departures.ts for forfeits).
import type { Draft } from "./draft";
import type { GameState, Player } from "./types";

export function reassignHost(s: GameState): void {
  if (s.externalHost) {
    // JAMAA-PLATFORM §2.7: the room picks the next host and syncs it before the next reduce; until then nobody but the TV.
    const h = s.players.find((p) => p.id === s.hostPlayerId);
    if (!h || h.left) s.hostPlayerId = null;
    return;
  }
  const byJoin = (a: Player, b: Player): number => a.joinedAt - b.joinedAt || a.seat - b.seat;
  const live = s.players.filter((p) => !p.left).sort(byJoin);
  const pick = live.find((p) => p.connected) ?? live[0];
  s.hostPlayerId = pick?.id ?? null;
}

export function removePlayer(s: GameState, id: string): void {
  s.players = s.players.filter((p) => p.id !== id);
  if (s.hostPlayerId === id) reassignHost(s);
}

export function markLeft(d: Draft, p: Player): void {
  p.left = true;
  p.connected = false;
  p.disconnectedAt = d.now;
  if (d.s.hostPlayerId === p.id) reassignHost(d.s);
}
