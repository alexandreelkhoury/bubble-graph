// GAME-BLUFF §11: the pack shape (TS mirror of the §11.3 zod schema in ../schema.ts, checked equal there), the
// playable catalog, and the prompt draw (§11.4). Zod-free.
import type { Locale } from "../../../constants";
import { type Rng, weightedIndex } from "./rng";

export type BluffType = "proverb_end" | "fact_blank" | "word_meaning" | "expression_meaning" | "no_truth";
export type RoundKind = "saying" | "fact" | "noTruth";
export type LocText = Partial<Record<Locale, string>>;
export type LocList = Partial<Record<Locale, string[]>>;

export const ROUND_OF_TYPE: Record<BluffType, 1 | 2 | 3> = { proverb_end: 1, fact_blank: 2, word_meaning: 2, expression_meaning: 2, no_truth: 3 };
export const ROUND_OF_KIND: Record<RoundKind, 1 | 2 | 3> = { saying: 1, fact: 2, noTruth: 3 };
const TYPES_OF_ROUND: Record<1 | 2 | 3, readonly BluffType[]> = {
  1: ["proverb_end"], 2: ["fact_blank", "word_meaning", "expression_meaning"], 3: ["no_truth"],
};

export interface BluffItem {
  id: string;
  type: BluffType;
  tier: "free" | "pass";
  difficulty: 1 | 2 | 3;
  knownIn: Locale[];
  prompt: { original: string; translit: string | null; display: LocText };
  truth: LocText;
  truthAlt: LocList;
  houseLies: LocList;
  note: LocText;
  review: { status: "draft" | "native-reviewed" | "verified"; source: string | null };
}

export interface BluffPack {
  schemaVersion: 1;
  id: string;
  game: "bluff";
  title: { en: string; fr: string; ar: string; es?: string };
  description: { en: string; fr: string; ar: string; es?: string };
  sourceLocale: Locale;
  playableIn: Locale[];
  ageRating: "all" | "teen";
  fallbackHouseLies: Partial<Record<BluffType, LocList>>;
  items: BluffItem[];
}

/** The game's content type `C` (JAMAA-PLATFORM §5.3 `PackCatalog`): the room's PLAYABLE packs. In a free room the
 *  `pass` items are already removed by ContentAdapter.playable (§4.4), so they never reach the engine or a view. */
export interface BluffCatalog { packs: BluffPack[] }

export interface Candidate { pack: BluffPack; item: BluffItem }

export const LENGTH_PLAN: Record<"short" | "normal" | "long", readonly [number, number]> = { short: [2, 2], normal: [3, 3], long: [4, 4] };

export function planFor(length: "short" | "normal" | "long"): RoundKind[] {
  const [a, b] = LENGTH_PLAN[length];
  return [...Array<RoundKind>(a).fill("saying"), ...Array<RoundKind>(b).fill("fact"), "noTruth"];
}

/** Items of the selected packs playable in `locale` (truth present unless no_truth), not knownIn `locale`. */
export function playableItems(cat: BluffCatalog, packIds: readonly string[], locale: Locale): Candidate[] {
  const out: Candidate[] = [];
  for (const pack of cat.packs) {
    if (packIds.length > 0 && !packIds.includes(pack.id)) continue;
    if (!pack.playableIn.includes(locale)) continue;
    for (const item of pack.items) {
      if (item.knownIn.includes(locale)) continue;
      if (item.type !== "no_truth" && !item.truth[locale]) continue;
      out.push({ pack, item });
    }
  }
  return out;
}

export function contentCounts(cat: BluffCatalog, packIds: readonly string[], locale: Locale): { r1: number; r2: number; final: number; facts: number } {
  const c = { r1: 0, r2: 0, final: 0, facts: 0 };
  for (const { item } of playableItems(cat, packIds, locale)) {
    const r = ROUND_OF_TYPE[item.type];
    if (r === 1) c.r1++;
    else if (r === 2) c.r2++;
    else c.final++;
    if (item.type === "fact_blank") c.facts++;
  }
  return c;
}

/** §11.4 short pools: blocked when proverb_end + round-2 items < round1Count + round2Count, or no no_truth item. */
export function hasEnoughContent(cat: BluffCatalog, packIds: readonly string[], locale: Locale, length: "short" | "normal" | "long"): boolean {
  const c = contentCounts(cat, packIds, locale);
  const [a, b] = LENGTH_PLAN[length];
  return c.r1 + c.r2 >= a + b && c.final >= 1;
}

export interface DrawInput {
  candidates: readonly Candidate[];
  slotKind: RoundKind;
  usedKeys: readonly string[];        // platform memory (oldest first)
  drawn: readonly string[];           // item ids drawn earlier in THIS game (incl. skipped/swapped)
  currentId: string | null;           // the prompt being replaced (skip / swap / empty redraw)
  prevType: BluffType | null;         // avoid two consecutive prompts of the same type
  factRich: boolean;                  // round 2: fact_blank only while ≥ round2Count + 2 unused facts were playable at start
}

export interface DrawResult { cand: Candidate; rerun: boolean; crossRound: boolean }

/** §11.4 + §7 "pool exhausted": deterministic given the RNG. Returns null only when no item of a usable type exists. */
export function drawPrompt(rng: Rng, d: DrawInput): DrawResult | null {
  const round = ROUND_OF_KIND[d.slotKind];
  const drawn = new Set(d.drawn);
  const used = new Set(d.usedKeys);
  const ofTypes = (types: readonly BluffType[]) => d.candidates.filter((c) => types.includes(c.item.type));
  const own: BluffType[][] = round === 2 && d.factRich ? [["fact_blank"], [...TYPES_OF_ROUND[2]]] : [[...TYPES_OF_ROUND[round]]];
  const other: BluffType[][] = round === 1 ? [[...TYPES_OF_ROUND[2]]] : round === 2 ? [[...TYPES_OF_ROUND[1]]] : [];
  const stages: { types: BluffType[]; cross: boolean; allowDrawn: boolean }[] = [
    ...own.map((types) => ({ types, cross: false, allowDrawn: false })),
    ...other.map((types) => ({ types, cross: true, allowDrawn: false })),
    { types: [...TYPES_OF_ROUND[round]], cross: false, allowDrawn: true },
    ...other.map((types) => ({ types, cross: true, allowDrawn: true })),
  ];
  for (const st of stages) {
    let pool = ofTypes(st.types).filter((c) => (st.allowDrawn ? c.item.id !== d.currentId : !drawn.has(c.item.id)));
    if (pool.length === 0) continue;
    if (d.prevType !== null) {
      const varied = pool.filter((c) => c.item.type !== d.prevType);
      if (varied.length > 0) pool = varied;
    }
    const fresh = st.allowDrawn ? [] : pool.filter((c) => !used.has(c.item.id));
    if (fresh.length > 0) {
      const w = fresh.map((c) => (round === 2 && !st.cross ? c.item.difficulty : 1));
      return { cand: fresh[weightedIndex(rng, w)] as Candidate, rerun: false, crossRound: st.cross };
    }
    // Rerun: the least recently used (oldest position in usedKeys; never-recorded first).
    const pos = (id: string): number => {
      const i = d.usedKeys.lastIndexOf(id);
      return i < 0 ? -1 : i;
    };
    let best = pool[0] as Candidate;
    for (const c of pool) if (pos(c.item.id) < pos(best.item.id)) best = c;
    return { cand: best, rerun: true, crossRound: st.cross };
  }
  // Last resort (a one-item final skipped by the host): the same item again.
  const same = d.candidates.find((c) => c.item.id === d.currentId && TYPES_OF_ROUND[round].includes(c.item.type));
  return same ? { cand: same, rerun: true, crossRound: false } : null;
}
