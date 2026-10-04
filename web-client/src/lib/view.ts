// Pure view helpers shared by the phone screens and the TV mock (both views extend PublicView).
import type { PublicPlayer, PublicView } from "@mishana/shared/protocol";
import type { Role } from "@mishana/shared/engine";
import { MAX_NO_ELIMINATION_STREAK } from "@mishana/shared/constants";
import type { MessageKey } from "../i18n/t";

type Players = Pick<PublicView, "players">;

/** DESIGN timing: the TV's vote reveal plays alone for 3 s before the phones show the outcome (TV-07 → PH-08b). */
export const TV_VOTE_REVEAL_MS = 3000;

export function byId(view: Players, id: string | null | undefined): PublicPlayer | undefined {
  return id ? view.players.find((p) => p.id === id) : undefined;
}

/** Looks every id up, dropping the unknown ones (players removed from the view). */
export function playersOf(view: Players, ids: readonly string[]): PublicPlayer[] {
  return ids.map((id) => byId(view, id)).filter((p): p is PublicPlayer => p !== undefined);
}

/** Scoreboard order: total desc, then seat. */
export function rankPlayers(players: readonly PublicPlayer[]): PublicPlayer[] {
  return [...players].sort((a, b) => b.score - a.score || a.seat - b.seat);
}

/** Competition ranking ("1, 1, 1, 4"): 1 + the number of players with a strictly higher total. */
export function competitionRank(players: readonly PublicPlayer[], p: PublicPlayer): number {
  return 1 + players.filter((x) => x.score > p.score).length;
}

export function winnerKey(winner: NonNullable<PublicView["result"]>["winner"]): MessageKey {
  return winner === "CIVILIANS" ? "winner.civilians" : winner === "INFILTRATORS" ? "winner.infiltrators" : "winner.blank";
}

/** The tied players (tie-break / revote) with their tallies from the last vote. */
export function tiedWithTally(view: Pick<PublicView, "players" | "tieCandidates" | "lastVote">): { player: PublicPlayer; votes: number }[] {
  return playersOf(view, view.tieCandidates).map((player) => ({
    player,
    votes: view.lastVote?.tally.find((x) => x.targetId === player.id)?.voterIds.length ?? 0,
  }));
}

/** Players with the most votes in the last tally (the random-pick wheel candidates), in seat order. */
export function topVoted(view: Pick<PublicView, "players" | "lastVote">): PublicPlayer[] {
  const lv = view.lastVote;
  if (!lv) return [];
  const maxN = Math.max(0, ...lv.tally.map((x) => x.voterIds.length));
  return playersOf(view, lv.tally.filter((x) => x.voterIds.length === maxN).map((x) => x.targetId)).sort((a, b) => a.seat - b.seat);
}

/** In-game forfeits (LEAVE / KICK) that appeared between two views of the same game, with the revealed role. */
export function newForfeits(prev: Pick<PublicView, "gameNumber" | "history">, next: Pick<PublicView, "gameNumber" | "history" | "players">): { player: PublicPlayer; role: Role }[] {
  if (next.gameNumber !== prev.gameNumber || next.history.length <= prev.history.length) return [];
  const out: { player: PublicPlayer; role: Role }[] = [];
  for (const h of next.history.slice(prev.history.length)) {
    if ((h.cause === "LEAVE" || h.cause === "KICK") && h.eliminatedId && h.role) {
      const player = byId(next, h.eliminatedId);
      if (player) out.push({ player, role: h.role });
    }
  }
  return out;
}

export type AfterElimination = "NEXT_ROUND" | "LAST_CHANCE" | "OTHER";

/**
 * What follows ELIMINATION, from public data only (Kotlin afterElimination, mirroring the engine's order in
 * shared/src/engine/turns.ts): the Blank's last chance, a next round, or OTHER = the game ends / returns to the lobby
 * (or the counts are unknown), where the clients only show the countdown. Never reveals more than players can count.
 */
export function afterElimination(view: Pick<PublicView, "phase" | "eliminated" | "settings" | "roleCounts" | "players" | "history">): AfterElimination {
  if (view.phase !== "ELIMINATION") return "OTHER";
  if (view.eliminated?.role === "BLANK" && view.settings.blankGuess) return "LAST_CHANCE";
  const rc = view.roleCounts;
  if (!rc) return "OTHER";
  const outInfiltrators = view.players.filter((p) => p.revealedRole === "UNDERCOVER" || p.revealedRole === "BLANK").length;
  const aliveI = rc.undercover + rc.blank - outInfiltrators;
  const aliveC = view.players.filter((p) => p.alive && !p.left).length - aliveI;
  const over = aliveI <= 0 || (view.settings.winRule === "official" && aliveC <= 1) || (view.settings.winRule === "parity" && aliveI >= aliveC);
  if (over) return "OTHER";
  const streak = view.history.filter((h) => h.cause === "VOTE" || h.cause === "RANDOM" || h.cause === "NONE").slice(-MAX_NO_ELIMINATION_STREAK);
  if (streak.length === MAX_NO_ELIMINATION_STREAK && streak.every((h) => h.cause === "NONE")) return "OTHER";
  return "NEXT_ROUND";
}

/** TV-05 speaking-order strip geometry (dp, Kotlin OrderStrip): fixed-width items, chevrons between, "+n" counters. */
export const ORDER_STRIP = { item: 84, chevron: 24, more: 48 } as const;

/**
 * Which part of the order fits `width` dp: everything with chevrons, else everything without them, else a window of
 * whole items that keeps the current speaker in view (one finished player before it when there is room), with
 * `start` players hidden before and `n - end` after (shown as "+n").
 */
export function orderWindow(n: number, current: number, width: number): { chevrons: boolean; start: number; end: number } {
  const { item, chevron, more } = ORDER_STRIP;
  const chevrons = item * n + chevron * Math.max(0, n - 1) <= width;
  if (chevrons || item * n <= width) return { chevrons, start: 0, end: n };
  const slots = Math.min(n, Math.max(1, Math.floor((width - more * 2) / item)));
  const start = Math.min(Math.max(0, current - 1), Math.max(0, n - slots));
  return { chevrons: false, start, end: Math.min(n, start + slots) };
}
