// PAYMENTS-SPEC §3.11: the pure catalog filter behind room access. Zod-free. The server's access.ts builds
// RoomAccess from the entitlement token and memoises this; tests and the fixture generator call it directly.
import type { Catalog } from "../engine/catalog";

/**
 * The packs a room may play: every free pack, plus every premium pack when `premium`, else only `ownedPacks`.
 * Only this catalog may ever reach `reduce`, `nextWakeAt` and the projections, so a locked pack's words cannot leak.
 */
export function playableCatalog(full: Catalog, premium: boolean, ownedPacks: ReadonlySet<string>): Catalog {
  if (premium) return full;
  return { packs: full.packs.filter((p) => p.tier === "free" || ownedPacks.has(p.id)) };
}
