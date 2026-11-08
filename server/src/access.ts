// JAMAA-PLATFORM §4.4 / PAYMENTS-SPEC §3.11: room access. Pure. Turns a room's verified entitlement into what it may
// play. Only the playable content ever reaches `reduceRoom`, `nextWakeAt` and the projections, so a locked pack's items
// cannot be picked or projected even with a bug elsewhere. Entitlements hold content FAMILIES (§4.2).
import { playableContent } from "@jamaa/shared/content";
import type { ContentCatalog } from "@jamaa/shared/content";
import { GAME_CONTENT, GAME_DEFS } from "@jamaa/shared/games/registry";
import type { GameId } from "@jamaa/shared/games/ids";
import type { Locale } from "@jamaa/shared/constants";
import type { RoomEntitlement } from "./billing/token";

/** `packs` = owned families; `changesAt` = when premium or the token ends (the alarm re-checks then). */
export interface RoomAccess { premium: boolean; packs: ReadonlySet<string>; changesAt: number | null }

const NO_PACKS: ReadonlySet<string> = new Set();

export function roomAccess(e: RoomEntitlement | null, nowMs: number): RoomAccess {
  if (!e || e.expMs <= nowMs) return { premium: false, packs: NO_PACKS, changesAt: null };
  const premium = e.premiumUntilMs !== null && e.premiumUntilMs > nowMs;
  let changesAt: number = e.expMs;
  if (premium && (e.premiumUntilMs as number) < changesAt) changesAt = e.premiumUntilMs as number;
  return { premium, packs: new Set(e.packs), changesAt };
}

/** §4.4 per game: the adapter's `playable` on every pack (memoised in shared/content). */
export function playableFor(full: ContentCatalog, a: RoomAccess): ContentCatalog {
  return playableContent(full, { premium: a.premium, packs: a.packs });
}

function families(catalog: ContentCatalog, id: GameId): Set<string> {
  const adapter = GAME_CONTENT[id];
  return new Set((catalog[id].packs as unknown[]).map((p) => adapter.meta(p).family));
}

/**
 * §4.4 UPDATE_GAME_SETTINGS pre-checks, before reduceRoom so clients get a precise error (INVALID_SETTINGS still covers
 * unknown ids): PACK_LOCKED if a family of `def.settings.packIds(patch-applied settings)` is known but not playable, then
 * PREMIUM_REQUIRED if a non-Pass room changes a `premiumKeys` value.
 */
export function settingsPrecheck(
  gameId: GameId, current: unknown, patch: Record<string, unknown>, full: ContentCatalog, playable: ContentCatalog,
  a: RoomAccess, locale: Locale,
): "PACK_LOCKED" | "PREMIUM_REQUIRED" | null {
  const def = GAME_DEFS[gameId];
  const applied = def.settings.apply(current, patch, full[gameId], locale);
  if (applied !== null) {
    const known = families(full, gameId);
    const ok = families(playable, gameId);
    if (def.settings.packIds(applied).some((f: string) => known.has(f) && !ok.has(f))) return "PACK_LOCKED";
  }
  if (!a.premium) {
    const cur = current as Record<string, unknown>;
    for (const k of def.meta.settings.premiumKeys as readonly string[]) {
      if (patch[k] !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(cur[k])) return "PREMIUM_REQUIRED";
    }
  }
  return null;
}
