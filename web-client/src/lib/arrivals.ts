// Who just arrived in a lobby (TV-02 tiles, PH-03 rows): only a new player's tile drops in, and the newest keeps a ring
// until the next join. Module state, so remounting the lobby (back from Settings, Play again) animates nothing.

/** How long after an arrival its tile still counts as new (the drop animation is 620 ms). */
export const ARRIVAL_MS = 700;

export interface Arrivals { at: Map<string, number>; newest: string | null; room: string; game: number }

export function createArrivals(): Arrivals {
  return { at: new Map(), newest: null, room: "", game: -1 };
}

/**
 * Records the players present at `now`. The first look at a room (a reload mid-lobby) marks everyone as already
 * there; later ids are arrivals and the last one becomes the newest. A new game clears the newest ring.
 */
export function noteArrivals(a: Arrivals, room: string, game: number, ids: readonly string[], now: number): void {
  const first = a.room !== room;
  if (first) { a.room = room; a.at = new Map(); a.newest = null; }
  if (a.game !== game) { a.game = game; a.newest = null; }
  for (const id of ids) {
    if (a.at.has(id)) continue;
    a.at.set(id, first ? -Infinity : now);
    if (!first) a.newest = id;
  }
  if (a.newest !== null && !ids.includes(a.newest)) a.newest = null;
}

/** True while `id`'s arrival animation is still playing. */
export function isFresh(a: Arrivals, id: string, now: number): boolean {
  return now - (a.at.get(id) ?? -Infinity) < ARRIVAL_MS;
}
