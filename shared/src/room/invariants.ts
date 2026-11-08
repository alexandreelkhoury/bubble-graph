// JAMAA-PLATFORM §2.8: room invariants, checked after every step by the room tests, the property tests and the sim.
import { MAX_PLAYERS } from "../constants";
import { GAME_IDS, isGameId } from "../games/ids";
import { GAME_DEFS } from "../games/registry";
import { nameKey } from "../games/mishana/engine/sanitize";
import { ROOM_PHASES } from "./types";
import type { RoomHistory, RoomState } from "./types";
import { HISTORY_GAMES_MAX, MEMORY_MAX_KEYS } from "../constants";

export class RoomInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomInvariantError";
  }
}

/** Messages carry ids and phase names only (never content). */
function fail(n: number, detail: string): never {
  throw new RoomInvariantError(`room invariant ${n}: ${detail}`);
}
const unique = (xs: readonly unknown[]): boolean => new Set(xs).size === xs.length;

export function assertRoomInvariants(s: RoomState, h?: RoomHistory): void {
  const ms = s.members;
  // 1 membership
  if (s.schema !== 2) fail(1, `schema ${String(s.schema)}`);
  if (!(ROOM_PHASES as readonly string[]).includes(s.phase)) fail(1, `phase ${s.phase}`);
  if (ms.filter((m) => !m.left).length > MAX_PLAYERS) fail(1, "too many members");
  if (!unique(ms.map((m) => m.id))) fail(1, "duplicate id");
  if (!unique(ms.map((m) => m.seat))) fail(1, "duplicate seat");
  if (!unique(ms.map((m) => m.color))) fail(1, "duplicate colour");
  if (!unique(ms.map((m) => nameKey(m.name)))) fail(1, "duplicate name");
  for (let i = 1; i < ms.length; i++) if ((ms[i - 1]?.seat ?? 0) >= (ms[i]?.seat ?? 0)) fail(1, "members not sorted by seat");
  for (const m of ms) {
    if (m.connected !== (m.disconnectedAt === null)) fail(1, `connected/disconnectedAt of ${m.id}`);
    if (m.reaction && m.reaction.n < 1) fail(1, `reaction n of ${m.id}`);
    if (s.phase !== "PLAYING" && (m.left || m.benched)) fail(1, `${m.id} left/benched outside PLAYING`);
    if (m.left && m.benched) fail(1, `${m.id} left and benched`);
  }
  // 2 host
  if (s.hostPlayerId !== null) {
    const h0 = ms.find((m) => m.id === s.hostPlayerId);
    if (!h0 || h0.left) fail(2, `host ${s.hostPlayerId}`);
  } else if (ms.some((m) => !m.left)) fail(2, "no host while members are present");
  // 3 phase shape
  if (s.phase === "HUB" && (s.setupGameId !== null || s.game !== null)) fail(3, "HUB with a setup game or an instance");
  if (s.phase === "SETUP" && (s.setupGameId === null || s.game !== null)) fail(3, "SETUP shape");
  if (s.phase === "PLAYING" && (s.game === null || s.game.id !== s.setupGameId)) fail(3, "PLAYING shape");
  if (s.setupGameId !== null && !isGameId(s.setupGameId)) fail(3, `unknown game ${String(s.setupGameId)}`);
  // 4 settings slots
  for (const id of GAME_IDS) {
    if (s.gameSettings[id] === undefined) fail(4, `settings slot ${id}`);
    if (s.settingsSchema[id] !== GAME_DEFS[id].meta.SETTINGS_SCHEMA) fail(4, `settings schema ${id}`);
  }
  if (!unique(s.tvGames.map((g) => g.id))) fail(4, "duplicate tvGames");
  // 5 cup
  for (const id of Object.keys(s.cup.stars)) if (!ms.some((m) => m.id === id)) fail(5, `stars of ${id}`);
  for (const v of Object.values(s.cup.stars)) if (!Number.isInteger(v) || v <= 0) fail(5, "stars value");
  // 6 the active instance
  if (s.game) {
    const g = s.game;
    if (!Number.isInteger(g.n) || g.n < 1) fail(6, `instance n ${g.n}`);
    GAME_DEFS[g.id].assertInvariants(g.state);
  }
  // 7 history bounds
  if (h) {
    if (h.games.length > HISTORY_GAMES_MAX) fail(7, "history.games too long");
    for (const [id, mem] of Object.entries(h.memory)) if (mem && mem.usedKeys.length > MEMORY_MAX_KEYS) fail(7, `memory of ${id}`);
  }
}
