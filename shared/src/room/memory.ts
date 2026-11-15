// JAMAA-PLATFORM §2.6a: the TV's no-repeat memory across rooms. Zod-free (the /tv client imports it).
// The TV keeps `RoomHistory.memory` on the device, sends it with POST /api/rooms (`memory`), the new room starts from
// it, and every change of the room's memory (game end, REPLAY, ABORT) is sent back to the TV only (`t: "memory"`).
import { MEMORY_KEY_MAX_CHARS, MEMORY_MAX_KEYS } from "../constants";
import { GAME_IDS } from "../games/ids";
import type { GameId } from "../games/ids";
import type { GameMemory } from "../games/types";

/** One stored item key: `<id>` or `<packId|family>:<itemId>` (content ids are lowercase `[a-z0-9-]`, ≤ 40 chars). */
export const MEMORY_KEY_REGEX = /^[a-z0-9][a-z0-9-]{0,39}(?::[a-z0-9][a-z0-9-]{0,39})?$/;

/** The wire shape, both ways: game id → used keys, oldest first (≤ MEMORY_MAX_KEYS each). */
export type MemoryWire = Partial<Record<GameId, string[]>>;
/** `RoomHistory.memory`. */
export type RoomMemory = Partial<Record<GameId, GameMemory>>;

export function isMemoryKey(k: unknown): k is string {
  return typeof k === "string" && k.length <= MEMORY_KEY_MAX_CHARS && MEMORY_KEY_REGEX.test(k);
}

/** Unique keys (a repeated key keeps its LAST, most recent position), oldest dropped past MEMORY_MAX_KEYS. */
function cleanKeys(list: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = list.length - 1; i >= 0 && out.length < MEMORY_MAX_KEYS; i--) {
    const k = list[i];
    if (!isMemoryKey(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.reverse();
}

/**
 * A memory seed from an untrusted source (the POST body, the TV's own storage). Never throws. Keeps known game ids
 * only (in GAME_IDS order) and, per game, well-formed unique keys, at most MEMORY_MAX_KEYS (the most recent). Games
 * with no key left are omitted. Anything that is not an object of arrays gives `{}`.
 */
export function sanitizeMemoryWire(raw: unknown): MemoryWire {
  const out: MemoryWire = {};
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return out;
  const rec = raw as Record<string, unknown>;
  for (const id of GAME_IDS) {
    if (!Object.prototype.hasOwnProperty.call(rec, id)) continue;
    const list = rec[id];
    if (!Array.isArray(list)) continue;
    const keys = cleanKeys(list.length > MEMORY_MAX_KEYS * 4 ? list.slice(-MEMORY_MAX_KEYS * 4) : list);
    if (keys.length > 0) out[id] = keys;
  }
  return out;
}

/** A sanitized seed → `RoomHistory.memory`. */
export function memoryFromWire(w: MemoryWire): RoomMemory {
  const out: RoomMemory = {};
  for (const id of GAME_IDS) {
    const keys = w[id];
    if (keys && keys.length > 0) out[id] = { usedKeys: [...keys] };
  }
  return out;
}

/** `RoomHistory.memory` → the wire shape (games with no key omitted; GAME_IDS order). */
export function memoryToWire(m: RoomMemory): MemoryWire {
  const out: MemoryWire = {};
  for (const id of GAME_IDS) {
    const keys = m[id]?.usedKeys;
    if (keys && keys.length > 0) out[id] = [...keys];
  }
  return out;
}

/** True when two memories hold the same keys in the same order (game end vs. a cup-only history change). */
export function sameMemory(a: RoomMemory | undefined, b: RoomMemory | undefined): boolean {
  for (const id of GAME_IDS) {
    const x = a?.[id]?.usedKeys ?? [];
    const y = b?.[id]?.usedKeys ?? [];
    if (x === y) continue;
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  }
  return true;
}

/**
 * The TV side: a `memory` frame from the room → the device's new store. Games in the frame replace the stored list
 * (the room started from the stored one, so it already holds it); games absent from the frame keep theirs.
 */
export function mergeMemoryWire(stored: MemoryWire, incoming: MemoryWire): MemoryWire {
  const a = sanitizeMemoryWire(stored);
  const b = sanitizeMemoryWire(incoming);
  const out: MemoryWire = {};
  for (const id of GAME_IDS) {
    const keys = b[id] ?? a[id];
    if (keys) out[id] = keys;
  }
  return out;
}
