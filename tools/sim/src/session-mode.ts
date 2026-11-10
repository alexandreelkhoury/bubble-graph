// Session mode (JAMAA-PLATFORM §2.9 `--session`): whole rooms through the platform engine (`reduceRoom`): hub → a random
// live game → setup → play → replay, back to setup or back to hub, about 10 games per room, with random reactions,
// disconnects, late (benched) joins, leaves and the odd ABORT. After every step: the room invariants (the harness checks
// them), the generic leak checker, and with `--access free` that no locked pack is ever picked. After every finished
// instance: the cup arithmetic (stars recomputed independently from each outcome's ranking).
import type { ColorId } from "@jamaa/shared/constants";
import { COLORS } from "@jamaa/shared/constants";
import { playableContent } from "@jamaa/shared/content";
import type { ContentCatalog } from "@jamaa/shared/content";
import { GAME_DEFS, REGISTRY_ENABLED } from "@jamaa/shared/games/registry";
import type { GameId } from "@jamaa/shared/games/ids";
import { cupStars, roomGames } from "@jamaa/shared/room";
import type { RoomAction } from "@jamaa/shared/room";
import { createRng } from "@jamaa/shared/engine";
import type { Rng } from "@jamaa/shared/engine";
import { findRoomLeaks, pid, RoomHarness } from "@jamaa/shared/testing";
// JAMAA-GAP (G2): shared/package.json exports neither games/<id>/engine nor testing/bots/<id> (P files): relative imports.
import type { BluffState } from "../../../shared/src/games/bluff/engine/state";
import { bluffProgressIntent } from "../../../shared/src/testing/bots/bluff";
import type { LikelyState } from "../../../shared/src/games/likely/engine/state";
import { likelyNextIntent } from "../../../shared/src/testing/bots/likely";
import type { SimArgs } from "./args";
import { formatColumns } from "./format";

export const GAMES_PER_ROOM = 10;
const TV = { kind: "tv" } as const;
const SYS = { kind: "system" } as const;

export interface SessionStats { rooms: number; games: number; replays: number; hubReturns: number; aborts: number; lateJoins: number; failures: string[] }

function pick<T>(rng: Rng, xs: readonly T[]): T | undefined {
  return xs.length ? xs[rng.int(xs.length)] : undefined;
}

/** One room; returns its finished instances. Throws on the first failure (the caller records it with the seed). */
export function playSession(seed: number, args: Pick<SimArgs, "players" | "access" | "game" | "winRule" | "tieBreak">, full: ContentCatalog, stats: SessionStats): void {
  const rng = createRng(seed);
  const free = args.access === "free";
  const content = free ? playableContent(full, { premium: false, packs: new Set() }) : full;
  const playablePacks = new Set(content.mishana.packs.map((p) => p.id));
  const enabled: GameId[] = REGISTRY_ENABLED.filter((id) => args.game === "all" || id === args.game);
  const h = new RoomHarness({ seed, content, fullContent: full, access: { premium: !free, packs: new Set() }, enabledGames: enabled });
  const live = roomGames(h.state, enabled);
  if (live.length === 0) throw new Error(`no live game for --game ${args.game}`);
  const minPlayers = Math.min(...live.map((id) => GAME_DEFS[id].meta.minPlayers));
  const roster = pick(rng, args.players.filter((n) => n >= minPlayers)) ?? minPlayers;
  let next = 0;
  const join = (): boolean => {
    const used = new Set(h.state.members.map((m) => m.color));
    const color = COLORS.find((c) => !used.has(c.id))?.id as ColorId | undefined;
    if (!color || h.state.members.filter((m) => !m.left).length >= 12) return false;
    const id = pid(next);
    const r = h.try({ type: "JOIN", playerId: id, name: `Bot ${next + 1}`, color, locale: "en", by: SYS });
    next++;
    return r.ok;
  };
  for (let i = 0; i < roster; i++) join();

  // Independent cup bookkeeping (§2.4).
  const expected: Record<string, number> = {};
  let lastN = 0;
  const checkCup = (): void => {
    const last = h.state.cup.last;
    if (last && last.n !== lastN) {
      lastN = last.n;
      for (const [id, s] of Object.entries(cupStars(last.ranking))) if (h.state.members.some((m) => m.id === id)) expected[id] = (expected[id] ?? 0) + s;
      // Ranking: competition ranking on this instance's points, 0-point players excluded.
      for (const grp of last.ranking) for (const id of grp) if (!((last.points[id] ?? 0) > 0)) throw new Error(`ranked player ${id} has ${last.points[id]} points`);
      stats.games++;
    }
    for (const id of Object.keys(expected)) if (!h.state.members.some((m) => m.id === id)) delete expected[id];
    const got = JSON.stringify(Object.entries(h.state.cup.stars).sort());
    const want = JSON.stringify(Object.entries(expected).filter(([, v]) => v > 0).sort());
    if (got !== want) throw new Error(`cup stars ${got} ≠ expected ${want}`);
  };
  const step = (a: RoomAction): boolean => {
    const r = h.try(a);
    h.now += 700;
    const leaks = findRoomLeaks(h);
    if (leaks.length) throw new Error(`leak after ${a.type}: ${leaks.slice(0, 3).join("; ")}`);
    const g = h.state.game;
    if (g?.id === "mishana") {
      const pair = h.mishana().pair;
      if (pair && !playablePacks.has(pair.packId)) throw new Error(`locked pack ${pair.packId} was picked`);
    }
    checkCup();
    return r.ok;
  };

  let finished = 0;
  for (let guard = 0; guard < 20_000; guard++) {
    const s = h.state;
    const roll = rng.next();
    // Background noise: reactions, disconnects/reconnects, late joins, leaves (any phase).
    if (roll < 0.04) {
      const m = pick(rng, s.members.filter((x) => !x.left));
      if (m) step({ type: "REACT", kind: pick(rng, ["laugh", "shock", "facepalm", "happy", "sad", "cheer"] as const) ?? "laugh", by: { kind: "player", playerId: m.id } });
      continue;
    }
    if (roll < 0.06) {
      const m = pick(rng, s.members.filter((x) => !x.left));
      if (m) step({ type: m.connected ? "DISCONNECT" : "RECONNECT", playerId: m.id, by: SYS });
      continue;
    }
    if (roll < 0.065) {
      if (s.phase === "PLAYING" && join()) stats.lateJoins++;
      continue;
    }
    if (roll < 0.068 && s.members.length > minPlayers + 1) {
      const m = pick(rng, s.members.filter((x) => !x.left));
      if (m) step({ type: "LEAVE", by: { kind: "player", playerId: m.id } });
      continue;
    }
    // Reconnect everyone now and then so games do not stall on absent players.
    if (roll < 0.1) {
      for (const m of s.members.filter((x) => !x.connected && !x.left)) step({ type: "RECONNECT", playerId: m.id, by: SYS });
      continue;
    }
    if (s.phase === "HUB") {
      const id = pick(rng, roomGames(s, enabled)) as GameId;
      step({ type: "OPEN_GAME", gameId: id, by: TV });
      continue;
    }
    if (s.phase === "SETUP") {
      const id = s.setupGameId as GameId;
      if (id === "mishana" && rng.next() < 0.5) {
        const timers = rng.next() < 0.5 ? { clueSeconds: 0, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 } : {};
        step({ type: "UPDATE_GAME_SETTINGS", gameId: id, patch: { ...timers, winRule: args.winRule, tieBreak: args.tieBreak }, by: TV });
      }
      if (!step({ type: "START_GAME", by: TV })) {
        // Not enough connected players or the like: bring everyone back, top the roster up, try again.
        for (const m of h.state.members.filter((x) => !x.connected)) step({ type: "RECONNECT", playerId: m.id, by: SYS });
        while (h.state.members.length < minPlayers && join()) { /* top up */ }
        if (!step({ type: "START_GAME", by: TV })) step({ type: "BACK_TO_HUB", by: TV });
      }
      continue;
    }
    // PLAYING
    const outcome = h.tvView().game?.over ?? false;
    if (outcome) {
      finished++;
      if (finished >= GAMES_PER_ROOM) return;
      const r = rng.next();
      if (r < 0.5) {
        stats.replays++;
        step({ type: "REPLAY", by: TV });
      } else if (r < 0.7) step({ type: "BACK_TO_SETUP", by: TV });
      else {
        stats.hubReturns++;
        step({ type: "BACK_TO_HUB", by: TV });
      }
      continue;
    }
    if (rng.next() < 0.002) {
      const before = { ...h.state.cup.stars };
      stats.aborts++;
      step({ type: "ABORT_GAME", by: TV });
      // JAMAA-PLATFORM §2.4: no stars on abort, but left members are removed and drop out of the cup.
      const kept = new Set(h.state.members.map((m) => m.id));
      const expected = Object.fromEntries(Object.entries(before).filter(([id]) => kept.has(id)));
      if (JSON.stringify(h.state.cup.stars) !== JSON.stringify(expected)) throw new Error("ABORT_GAME changed the cup");
      continue;
    }
    if (h.state.game?.id === "mishana") {
      // Time passes: deadlines fire through the room TICK; otherwise the next legal move.
      if (rng.next() < 0.1) {
        h.now += 60_000;
        step({ type: "TICK", by: SYS });
        continue;
      }
      const a = h.nextMishanaAction(rng.next() < 0.3 ? "Zzyzx" : "Cat");
      if (a && !step(a)) step({ type: "GAME", gameId: "mishana", i: { type: "HOST_ADVANCE" }, by: TV });
      continue;
    }
    if (h.state.game?.id === "trivia") {
      // JAMAA-PLATFORM §6.7: deadlines fire through the room TICK; players tap a random option (an out-of-range or late
      // tap is refused, which is fine); the TV skips now and then. The engine bot proper lives in engine mode.
      const r = rng.next();
      if (r < 0.3) {
        h.now += 20_000;
        step({ type: "TICK", by: SYS });
      } else if (r < 0.85) {
        const m = pick(rng, h.state.members.filter((x) => !x.left && x.connected));
        if (m) step({ type: "GAME", gameId: "trivia", i: { type: "ANSWER", choice: rng.int(4) }, by: { kind: "player", playerId: m.id } });
      } else step({ type: "GAME", gameId: "trivia", i: { type: "HOST_ADVANCE" }, by: TV });
      continue;
    }
    if (h.state.game?.id === "bluff") {
      // JAMAA-PLATFORM §6.5: the next legal Bluff move (shared/src/testing/bots/bluff.ts), else the clock runs to the
      // phase deadline through the room TICK; now and then time jumps anyway (timeouts, auto-lies). The engine bot proper
      // (bot lies, holds, swaps) lives in engine mode.
      const gs = h.state.game.state as BluffState;
      const n = rng.next() < 0.1 ? null : bluffProgressIntent(gs);
      if (n === null) {
        h.now = Math.max(h.now + 1_000, gs.deadline ?? h.now + 30_000);
        step({ type: "TICK", by: SYS });
        continue;
      }
      const by = n.by === null ? TV : { kind: "player" as const, playerId: n.by };
      if (!step({ type: "GAME", gameId: "bluff", i: n.i, by } as RoomAction)) {
        h.now += 30_000;
        step({ type: "TICK", by: SYS });
      }
      continue;
    }
    if (h.state.game?.id === "likely") {
      // JAMAA-PLATFORM §6.6: the next legal Most Likely move (shared/src/testing/bots/likely.ts: votes, then the host),
      // else the clock runs to the phase deadline through the room TICK; now and then time jumps anyway (timeouts).
      const gs = h.state.game.state as LikelyState;
      const n = rng.next() < 0.1 ? null : likelyNextIntent(gs, rng, h.state.hostPlayerId);
      if (n === null || !step({ type: "GAME", gameId: "likely", i: n.intent, by: n.by } as RoomAction)) {
        h.now = Math.max(h.now + 1_000, gs.deadline ?? h.now + 30_000);
        step({ type: "TICK", by: SYS });
      }
      continue;
    }
    throw new Error(`no bot for game ${h.state.game?.id ?? "?"}`);
  }
  throw new Error(`room did not finish ${GAMES_PER_ROOM} games (finished ${finished})`);
}

export function runSessionMode(full: ContentCatalog, args: SimArgs, log: (line: string) => void = console.log): SessionStats {
  const stats: SessionStats = { rooms: 0, games: 0, replays: 0, hubReturns: 0, aborts: 0, lateJoins: 0, failures: [] };
  const rooms = Math.max(1, Math.ceil(args.games / GAMES_PER_ROOM));
  for (let r = 0; r < rooms; r++) {
    const seed = (Math.imul(args.seed, 2_654_435_761) + r * 97) >>> 0;
    try {
      playSession(seed, args, full, stats);
    } catch (e) {
      stats.failures.push(`room=${r} seed=${seed}: ${e instanceof Error ? e.message : String(e)}`);
    }
    stats.rooms++;
    if (args.verbose) log(`room=${r} seed=${seed} games=${stats.games}`);
  }
  return stats;
}

export function formatSessionTable(s: SessionStats): string {
  return formatColumns(
    ["rooms", "games", "replays", "hub returns", "aborts", "late joins", "failures"],
    [[s.rooms, s.games, s.replays, s.hubReturns, s.aborts, s.lateJoins, s.failures.length].map(String)],
  );
}
