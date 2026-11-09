// GAME-LIKELY §11.3 card draw and §7 "Who gets named". Pure; randomness only through the Rng passed in.
import type { Locale } from "../../../constants";
import type { Rng } from "../../../room/rng";
import type { LikelySettings } from "../meta";
import { eligibleCards } from "./catalog";
import type { Candidate, LikelyCatalog } from "./catalog";
import { NAMED_MIN_PLAYERS, OPENER_TAGS } from "./state";
import type { LikelyPlayer } from "./state";

export interface LikelyDrawn { candidate: Candidate; rerun: boolean }

export interface DrawInput {
  content: LikelyCatalog;
  settings: LikelySettings;
  locale: Locale;
  position: number;                     // 0-based index of the card being drawn (skips do not advance it)
  /** Recency, oldest first: the platform memory, then every card drawn this game (= `memory(s).usedKeys`). */
  recency: readonly string[];
  drawnIds: readonly string[];          // drawn this game (skips included)
  usedKeys: readonly string[];          // platform memory at start
  prevTags: readonly string[] | null;   // tags of the previous completed card
  namedHistory: readonly boolean[];     // per completed card: did it name a player?
  playersInGame: number;                // non-left, dealt-in players
  namedCandidates: number;              // how many players could be named right now
  excludeIds: readonly string[];        // the card being replaced (skip / void)
}

/** Named cards: Spicy only, ≥ 4 players, never the opener, never two in a row, ≤ 1 in any 3 consecutive cards. */
export function namedAllowed(i: Pick<DrawInput, "settings" | "position" | "namedHistory" | "playersInGame" | "namedCandidates">): boolean {
  if (i.settings.mode !== "spicy" || i.position === 0 || i.playersInGame < NAMED_MIN_PLAYERS || i.namedCandidates < 1) return false;
  const h = i.namedHistory;
  return !h[h.length - 1] && !h[h.length - 2];
}

/** Spicy mode: positions 3, 6, 9… (1-based) are Family breathers, the others Spicy (§11.3). null in family mode. */
export function wantsSpicy(s: LikelySettings, position: number): boolean | null {
  if (s.mode !== "spicy") return null;
  return (position + 1) % 3 !== 0;
}

/** Soft preferences, each dropped when it would empty the list: Spicy/Family mix, family opener tags, no shared tag. */
function softFilter(list: Candidate[], i: DrawInput): Candidate[] {
  let cur = list;
  const keep = (f: (c: Candidate) => boolean): void => {
    const n = cur.filter(f);
    if (n.length > 0) cur = n;
  };
  const spicy = wantsSpicy(i.settings, i.position);
  if (spicy !== null) keep((c) => (c.card.spice > 0) === spicy);
  if (i.position === 0) {
    if (i.settings.mode === "spicy") keep((c) => !c.card.namesPlayer);   // the Spicy opener is an unnamed Spicy card
    else keep((c) => c.card.tags.some((t) => OPENER_TAGS.includes(t)));
  }
  const prev = i.prevTags;
  if (prev) keep((c) => !c.card.tags.some((t) => prev.includes(t)));
  return cur;
}

/**
 * Hard rules: the mode/pack/language filter (catalog.eligibleCards) and named-card spacing. Then: not in memory and not
 * drawn this game (random among the soft-filtered rest); else the least recently used one, tagged "Rerun!" (§7).
 */
export function drawCard(i: DrawInput, rng: Rng): LikelyDrawn | null {
  const allowNamed = namedAllowed(i);
  const base = eligibleCards(i.content, i.settings, i.locale).filter((c) => !c.card.namesPlayer || allowNamed);
  const drawn = new Set(i.drawnIds);
  const used = new Set(i.usedKeys);
  const exclude = new Set(i.excludeIds);
  const notExcluded = base.filter((c) => !exclude.has(c.card.id));
  const pool = notExcluded.length > 0 ? notExcluded : base;
  if (pool.length === 0) return null;
  const fresh = pool.filter((c) => !drawn.has(c.card.id) && !used.has(c.card.id));
  if (fresh.length > 0) {
    const list = softFilter(fresh, i);
    return { candidate: list[rng.int(list.length)] as Candidate, rerun: false };
  }
  const age = new Map(i.recency.map((k, idx) => [k, idx]));
  const list = softFilter(pool, i);
  const pick = list.reduce((a, b) => ((age.get(a.card.id) ?? -1) <= (age.get(b.card.id) ?? -1) ? a : b));
  return { candidate: pick, rerun: true };
}

/** §7 "Who gets named": connected, non-left, dealt-in players named the fewest times, never the last one named. */
export function namedPool(players: readonly LikelyPlayer[], lastNamed: string | null): string[] {
  const ok = players.filter((p) => p.connected && !p.left && !p.waiting && p.id !== lastNamed);
  if (ok.length === 0) return [];
  const min = Math.min(...ok.map((p) => p.namedCount));
  return ok.filter((p) => p.namedCount === min).map((p) => p.id);
}
