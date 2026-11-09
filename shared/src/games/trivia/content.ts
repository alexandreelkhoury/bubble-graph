// JAMAA-PLATFORM §5.2 / §4.4: Trivia's content adapter (server, sim and tests only). Tiers are PACK-level
// (GAME-TRIVIA §2): a free quiz is playable everywhere; a Pass-only quiz needs the Pass or its `pack_<family>` purchase.
// A quiz the room may not play is dropped whole, so it never reaches a free room's clients (§13.3 invariant 5).
import type { ContentAdapter, PackMeta } from "../../content/types";
import { familyOf, languageOf } from "./engine/quiz";
import type { TriviaPack } from "./engine/types";
import type { TriviaSettings } from "./meta";
import { toTriviaPack } from "./schema";

export type { TriviaPack };

export const content: ContentAdapter<TriviaPack, TriviaSettings> = {
  parse(raw: unknown): TriviaPack {
    return toTriviaPack(raw);
  },
  meta(p: TriviaPack): PackMeta {
    return {
      id: p.id, family: familyOf(p), gameId: "trivia", languages: [languageOf(p)], locale: p.locale, title: p.title,
      ageRating: p.ageRating, tier: p.tier, itemCount: p.questions.length, freeItemCount: p.tier === "free" ? p.questions.length : 0,
      stars: p.stars, domain: p.domain, topics: [...p.topics],
    };
  },
  playable(p, a) {
    return p.tier === "free" || a.premium || a.ownedFamilies.has(familyOf(p)) ? p : null;
  },
};
