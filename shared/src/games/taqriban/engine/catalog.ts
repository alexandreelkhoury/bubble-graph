// GAME-TAQRIBAN §11.3: the engine's view of the content and the question draw. Pure; randomness only through the Rng.
import type { Locale } from "../../../constants";
import type { Rng } from "../../../room/rng";
import type { TaqribanCatalog, TaqribanItem, TaqribanPack } from "./types";

export interface Candidate { pack: TaqribanPack; item: TaqribanItem }

/** Packs playable in `locale`. */
export function packsFor(content: TaqribanCatalog, locale: Locale): TaqribanPack[] {
  return content.packs.filter((p) => p.locales.includes(locale));
}

/** Every question the room could draw for this pack filter in this language ([] filter = every pack). */
export function eligibleItems(content: TaqribanCatalog, packIds: readonly string[], locale: Locale): Candidate[] {
  const out: Candidate[] = [];
  for (const pack of packsFor(content, locale)) {
    if (packIds.length > 0 && !packIds.includes(pack.id)) continue;
    for (const item of pack.items) if (item.text[locale] !== undefined && item.unit[locale] !== undefined) out.push({ pack, item });
  }
  return out;
}

export function findItem(content: TaqribanCatalog, id: string, locale: Locale): Candidate | null {
  for (const pack of packsFor(content, locale)) {
    const item = pack.items.find((x) => x.id === id);
    if (item && item.text[locale] !== undefined) return { pack, item };
  }
  return null;
}

export function textIn<T extends { en: string; fr: string; ar: string; es?: string | undefined }>(l: T, locale: Locale): string {
  return l[locale] ?? l.en;
}

function shuffle<T>(xs: T[], rng: Rng): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [xs[i], xs[j]] = [xs[j] as T, xs[i] as T];
  }
  return xs;
}

/** Soft spacing: no two consecutive questions share their first tag when another order avoids it. */
function spread(list: Candidate[]): Candidate[] {
  const out: Candidate[] = [];
  const rest = [...list];
  while (rest.length > 0) {
    const prev = out[out.length - 1]?.item.tags[0];
    const k = rest.findIndex((c) => c.item.tags[0] !== prev);
    out.push(...rest.splice(k < 0 ? 0 : k, 1));
  }
  return out;
}

/**
 * §11.3: `n` questions, never one in the room memory while fresh ones remain; then the least recently used ones
 * (memory order, oldest first) and `rerun: true`. Random order, tags spread.
 */
export function drawQuestions(pool: readonly Candidate[], n: number, usedKeys: readonly string[], rng: Rng): { picked: Candidate[]; rerun: boolean } {
  const used = new Set(usedKeys);
  const fresh = shuffle(pool.filter((c) => !used.has(c.item.id)), rng);
  if (fresh.length >= n) return { picked: spread(fresh.slice(0, n)), rerun: false };
  const age = new Map(usedKeys.map((k, i) => [k, i]));
  const old = pool.filter((c) => used.has(c.item.id)).sort((a, b) => (age.get(a.item.id) ?? 0) - (age.get(b.item.id) ?? 0));
  return { picked: spread(shuffle([...fresh, ...old.slice(0, n - fresh.length)], rng)), rerun: true };
}

/** A replacement for a skipped question: unplayed this game, fresh first, else the least recently used. */
export function drawReplacement(pool: readonly Candidate[], exclude: ReadonlySet<string>, usedKeys: readonly string[], rng: Rng): Candidate | null {
  const used = new Set(usedKeys);
  const open = pool.filter((c) => !exclude.has(c.item.id));
  if (open.length === 0) return null;
  const fresh = open.filter((c) => !used.has(c.item.id));
  if (fresh.length > 0) return fresh[rng.int(fresh.length)] as Candidate;
  const age = new Map(usedKeys.map((k, i) => [k, i]));
  return open.reduce((a, b) => ((age.get(a.item.id) ?? 0) <= (age.get(b.item.id) ?? 0) ? a : b));
}
