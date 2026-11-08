// JAMAA-PLATFORM §5.2 / §4.4: Bluff's content adapter (server, sim and tests only). Item-level tiers (GAME-BLUFF §2):
// a free room keeps only `tier: "free"` items; owning the pack's family (= its id) or a Pass room keeps everything.
import type { ContentAdapter, PackMeta } from "../../content/types";
import type { BluffPack } from "./engine/catalog";
import type { BluffSettings } from "./meta";
import { BluffPackSchema } from "./schema";

export type { BluffPack };

export const content: ContentAdapter<BluffPack, BluffSettings> = {
  parse(raw: unknown): BluffPack {
    return BluffPackSchema.parse(raw);
  },
  meta(p: BluffPack): PackMeta {
    const free = p.items.filter((i) => i.tier === "free").length;
    return {
      id: p.id, family: p.id, gameId: "bluff", languages: [...p.playableIn], locale: p.sourceLocale, title: p.title, ageRating: p.ageRating,
      tier: free === p.items.length ? "free" : free === 0 ? "premium" : "mixed",
      itemCount: p.items.length, freeItemCount: free,
      stars: null, domain: null, topics: [],
    };
  },
  playable(p, a) {
    if (a.premium || a.ownedFamilies.has(p.id)) return p;
    const items = p.items.filter((i) => i.tier === "free");
    if (items.length === p.items.length) return p;
    return items.length === 0 ? null : { ...p, items };
  },
};
