// JAMAA-PLATFORM §5.2: Mish Ana!'s content adapter over the engine's catalog packs (server, sim and tests only).
import { WordPackSchema } from "../../packs/schema";
import type { ContentAdapter, PackMeta } from "../../content/types";
import { buildCatalog, packAllowedByAge } from "./engine/catalog";
import type { CatalogPack } from "./engine/catalog";
import type { MishanaSettings } from "./meta";

export const content: ContentAdapter<CatalogPack, MishanaSettings> = {
  parse(raw: unknown): CatalogPack {
    const pack = WordPackSchema.parse(raw);
    if (pack.game !== undefined && pack.game !== "mishana") throw new Error(`pack ${pack.id} belongs to ${pack.game}`);
    return buildCatalog([pack]).packs[0] as CatalogPack;
  },
  meta(p: CatalogPack): PackMeta {
    return {
      id: p.id, family: p.family ?? p.id, gameId: "mishana", languages: [p.language], locale: p.locale, title: p.title, ageRating: p.ageRating,
      tier: p.tier, itemCount: p.pairs.length, freeItemCount: p.tier === "free" ? p.pairs.length : 0,
      stars: null, domain: null, topics: [],
    };
  },
  playable(p, a) {
    return p.tier === "free" || a.premium || a.ownedFamilies.has(p.family ?? p.id) ? p : null;
  },
  setupView(p, s) {
    return { shown: packAllowedByAge(p, { ...s, wordLocale: p.language }), itemCount: p.pairs.filter((q) => s.difficulties.includes(q.difficulty)).length };
  },
};
