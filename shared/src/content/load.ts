// JAMAA-PLATFORM §5.3 / §4.4: building the ContentCatalog from raw packs (schema-validated through each game's
// ContentAdapter) and the per-room access filter. Server, sim and tests only (the adapters pull in zod).
import { GAME_IDS } from "../games/ids";
import type { GameId } from "../games/ids";
import { GAME_CONTENT } from "../games/registry";
import type { ContentCatalog } from "./catalog";
import type { RoomAccess } from "./types";

export type RawContent = { readonly [K in GameId]: readonly unknown[] };

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** One game's catalog: every raw pack parsed by that game's adapter (throws on the first invalid pack), sorted by id. */
export function loadGameContent<K extends GameId>(id: K, raws: readonly unknown[]): ContentCatalog[K] {
  const adapter = GAME_CONTENT[id];
  const packs = raws.map((r) => adapter.parse(r) as { id: string });
  const seen = new Set<string>();
  for (const p of packs) {
    if (seen.has(p.id)) throw new Error(`duplicate pack id ${p.id} (${id})`);
    seen.add(p.id);
  }
  return { packs: [...packs].sort(byId) } as ContentCatalog[K];
}

/** Every game's catalog; pack ids must be unique across games (§5.2). */
export function loadContent(raw: RawContent): ContentCatalog {
  const out = {} as Record<GameId, unknown>;
  const all = new Map<string, GameId>();
  for (const id of GAME_IDS) {
    const cat = loadGameContent(id, raw[id]);
    for (const p of cat.packs as { id: string }[]) {
      const other = all.get(p.id);
      if (other) throw new Error(`pack id ${p.id} is used by ${other} and ${id}`);
      all.set(p.id, id);
    }
    out[id] = cat;
  }
  return out as unknown as ContentCatalog;
}

/** Every family id of `catalog` (all games), for PACK_LOCKED checks and the billing catalog. */
export function contentFamilies(catalog: ContentCatalog): Map<string, { gameId: GameId; tier: "free" | "premium" | "mixed" }> {
  const out = new Map<string, { gameId: GameId; tier: "free" | "premium" | "mixed" }>();
  for (const id of GAME_IDS) {
    const adapter = GAME_CONTENT[id];
    for (const p of catalog[id].packs as unknown[]) {
      const m = adapter.meta(p);
      out.set(m.family, { gameId: id, tier: m.tier });
    }
  }
  return out;
}

// Memoised per (full catalog, premium, sorted families); the inner map is bounded so odd tokens cannot grow it.
const memo = new WeakMap<ContentCatalog, Map<string, ContentCatalog>>();
const MEMO_MAX = 64;

/**
 * §4.4: for each game, the adapter's `playable` on every pack (free packs, every pack when premium, owned families;
 * item-level tiers drop `pass` items). Only this catalog ever reaches reduceRoom, nextWakeAt and the projections.
 * A premium room gets `full` itself (same object).
 */
export function playableContent(full: ContentCatalog, a: RoomAccess): ContentCatalog {
  if (a.premium) return full;
  const key = [...a.packs].sort().join(",");
  let m = memo.get(full);
  if (!m) memo.set(full, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit;
  const out = {} as Record<GameId, unknown>;
  for (const id of GAME_IDS) {
    const adapter = GAME_CONTENT[id];
    const packs: unknown[] = [];
    let changed = false;
    for (const p of full[id].packs as unknown[]) {
      const q = adapter.playable(p, { premium: false, ownedFamilies: a.packs });
      if (q !== p) changed = true;
      if (q !== null) packs.push(q);
    }
    out[id] = changed ? { ...full[id], packs } : full[id];
  }
  const res = out as unknown as ContentCatalog;
  if (m.size >= MEMO_MAX) m.clear();
  m.set(key, res);
  return res;
}
