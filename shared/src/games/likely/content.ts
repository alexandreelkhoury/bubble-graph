// JAMAA-PLATFORM §5.2: Likely's content adapter (server, sim and tests only: pulls zod through schema.ts).
// The engine's content type is the room's PLAYABLE catalog: tier filtering happens here, before the engine sees a card.
import type { ContentAdapter, PackMeta } from "../../content/types";
import { eligibleInPack } from "./engine/catalog";
import type { LikelySettings } from "./meta";
import { LikelyPackSchema } from "./schema";
import type { LikelyPack } from "./schema";

export type { LikelyPack, LikelyCard } from "./schema";

export const content: ContentAdapter<LikelyPack, LikelySettings> = {
  parse(raw: unknown): LikelyPack {
    return LikelyPackSchema.parse(raw);
  },
  meta(p: LikelyPack): PackMeta {
    const free = p.cards.filter((c) => c.tier === "free").length;
    return {
      id: p.id, family: p.id, gameId: "likely", languages: [...p.locales], locale: "en",
      title: { ...p.title }, ageRating: p.ageRating,
      tier: free === p.cards.length ? "free" : free === 0 ? "premium" : "mixed",
      itemCount: p.cards.length, freeItemCount: free, stars: null, domain: null, topics: [],
    };
  },
  /** Free room: only `tier:"free"` cards and never an adult pack. Pass, or the family bought: the whole pack. */
  playable(p, a) {
    if (a.premium || a.ownedFamilies.has(p.id)) return p;
    if (p.ageRating === "adult") return null;
    const cards = p.cards.filter((c) => c.tier === "free");
    if (cards.length === 0) return null;
    return cards.length === p.cards.length ? p : { ...p, cards };
  },
  /** The setup pack list: a pack shows when the room's mode may draw from it; its count is the cards that mode draws. */
  setupView(p, s) {
    const n = eligibleInPack(p, s.mode).length;
    return { shown: n > 0 && (s.mode === "spicy" || p.ageRating !== "adult"), itemCount: n };
  },
};
