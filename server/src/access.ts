// PAYMENTS-SPEC §3.11: room access. Pure. Turns a room's verified entitlement into what it may play. Only the
// playable catalog ever reaches `reduce`, `nextWakeAt` and the projections, so a locked pack's words cannot be picked
// or projected even with a bug elsewhere.
import { PREMIUM_SETTING_KEYS, playableCatalog as filterCatalog } from "@mishana/shared/billing";
import type { Catalog, GameState, Settings } from "@mishana/shared/engine";
import { DEFAULT_PACK_IDS, DEFAULT_SETTINGS } from "@mishana/shared/engine";
import { lockedPackInfos } from "@mishana/shared/projection";
import type { LockedPackInfo } from "@mishana/shared/projection";
import type { RoomEntitlement } from "./billing/token";

export interface RoomAccess { premium: boolean; packs: ReadonlySet<string>; changesAt: number | null }

const NO_PACKS: ReadonlySet<string> = new Set();

export function roomAccess(e: RoomEntitlement | null, nowMs: number): RoomAccess {
  if (!e || e.expMs <= nowMs) return { premium: false, packs: NO_PACKS, changesAt: null };
  const premium = e.premiumUntilMs !== null && e.premiumUntilMs > nowMs;
  let changesAt: number = e.expMs;
  if (premium && (e.premiumUntilMs as number) < changesAt) changesAt = e.premiumUntilMs as number;
  return { premium, packs: new Set(e.packs), changesAt };
}

// Memoised per (full catalog, premium, sorted packs); the inner map is bounded so odd tokens cannot grow it.
const memo = new WeakMap<Catalog, Map<string, Catalog>>();
const MEMO_MAX = 64;

/** Packs with tier "free", or every pack when premium, or the owned ones. */
export function playableCatalog(full: Catalog, a: RoomAccess): Catalog {
  if (a.premium) return full;
  const key = [...a.packs].sort().join(",");
  let m = memo.get(full);
  if (!m) memo.set(full, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit;
  const out = filterCatalog(full, false, a.packs);
  if (m.size >= MEMO_MAX) m.clear();
  m.set(key, out);
  return out;
}

/** LOBBY only (the caller checks the phase): metadata of the packs the room may not play. */
export function lockedPacks(full: Catalog, a: RoomAccess, settings: Settings): LockedPackInfo[] {
  return lockedPackInfos(full, playableCatalog(full, a), settings);
}

/** Non-null iff LOBBY and a pack filter id is not playable, or a free room has a premium setting off its default. */
export function restrictionFor(state: GameState, playable: Catalog, a: RoomAccess): { allowedPackIds: string[]; resetPremiumSettings: boolean } | null {
  if (state.phase !== "LOBBY") return null;
  // The default easy packs are free; an id of that list missing from the catalog is ignored by the engine, not locked.
  const ids = new Set([...playable.packs.map((p) => p.id), ...DEFAULT_PACK_IDS]);
  const lockedFilter = state.settings.packIds.some((id) => !ids.has(id));
  const premiumOff = !a.premium && PREMIUM_SETTING_KEYS.some((k) => JSON.stringify(state.settings[k]) !== JSON.stringify(DEFAULT_SETTINGS[k]));
  if (!lockedFilter && !premiumOff) return null;
  return { allowedPackIds: [...ids], resetPremiumSettings: !a.premium };
}
