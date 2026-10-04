// Seat and host bookkeeping. No phase transitions here (see departures.ts for forfeits).
import type { Draft } from "./draft";
import type { GameState, Player } from "./types";

export function reassignHost(s: GameState): void {
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
