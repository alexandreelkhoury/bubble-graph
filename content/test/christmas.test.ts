// The Christmas packs (docs/content-plans/christmas-mishana.md): free, and enough on their own to start a game.
import { describe, expect, it } from "vitest";
import { playableCatalog } from "@jamaa/shared/billing";
import { loadCatalog } from "@jamaa/shared/packs";
import { Game } from "@jamaa/shared/testing";
import { PACKS } from "../index";

const CHRISTMAS = { en: "en-christmas-01", fr: "fr-christmas-01", ar: "ar-christmas-01", es: "es-christmas-01" } as const;
// A free room (no Pass, no owned packs): only tier "free" packs are playable.
const FREE = playableCatalog(loadCatalog(PACKS), false, new Set());

describe("Christmas packs", () => {
  for (const [lang, id] of Object.entries(CHRISTMAS) as [keyof typeof CHRISTMAS, string][]) {
    it(`${id}: free, ≥ 40 pairs, and a free room starts with only it selected`, () => {
      const pack = FREE.packs.find((p) => p.id === id);
      expect(pack, id).toBeDefined();
      expect(pack?.pairs.length).toBeGreaterThanOrEqual(40);
      expect(new Set(pack?.pairs.map((p) => p.difficulty))).toEqual(new Set([1, 2, 3]));

      const g = new Game({ catalog: FREE, seed: 7 });
      for (let i = 0; i < 5; i++) g.join(i);
      g.tv({ type: "UPDATE_SETTINGS", patch: { wordLocale: lang, packIds: [id], roleMode: "custom", undercoverCount: 1, blankCount: 1 } });
      expect(g.state.settings.packIds).toEqual([id]);
      g.tv({ type: "START" });
      expect(g.state.phase).toBe("ROLE_REVEAL");
      expect(g.state.pair?.packId).toBe(id);
      expect(g.byRole("UNDERCOVER")).toHaveLength(1);
      expect(g.byRole("BLANK")).toHaveLength(1);
    });
  }
});
