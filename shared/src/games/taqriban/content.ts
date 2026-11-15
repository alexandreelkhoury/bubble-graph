// JAMAA-PLATFORM §5.2: Taqriban's content adapter (server, sim and tests only: pulls zod through schema.ts). Tiers are
// item-level (like Likely): a free room only sees `tier: "free"` questions; the engine never sees a locked one.
import type { ContentAdapter, PackMeta } from "../../content/types";
import type { TaqribanSettings } from "./meta";
import { TaqribanPackSchema } from "./schema";
import type { TaqribanPack } from "./schema";

export type { TaqribanPack, TaqribanItem } from "./schema";

export const content: ContentAdapter<TaqribanPack, TaqribanSettings> = {
  parse(raw: unknown): TaqribanPack {
    return TaqribanPackSchema.parse(raw);
  },
  meta(p: TaqribanPack): PackMeta {
    const free = p.items.filter((c) => c.tier === "free").length;
    return {
      id: p.id, family: p.id, gameId: "taqriban", languages: [...p.locales], locale: "en",
      title: { ...p.title }, ageRating: p.ageRating,
      tier: free === p.items.length ? "free" : free === 0 ? "premium" : "mixed",
      itemCount: p.items.length, freeItemCount: free, stars: null, domain: null, topics: [],
    };
  },
  playable(p, a) {
    if (a.premium || a.ownedFamilies.has(p.id)) return p;
    const items = p.items.filter((c) => c.tier === "free");
    if (items.length === 0) return null;
    return items.length === p.items.length ? p : { ...p, items };
  },
};
