import { describe, expect, it } from "vitest";
import { playableCatalog } from "../../src/billing/access";
import { packProductId } from "../../src/billing/products";
import { candidatePairs } from "../../src/engine/catalog";
import { fullAccess, projectForTv, projectPublic } from "../../src/projection/project";
import type { ViewAccess } from "../../src/projection/project";
import { TvViewSchema } from "../../src/protocol/views";
import { inClues, lobby, TEST_CATALOG, TEST_FREE_CATALOG } from "../../src/testing";

const FREE: ViewAccess = { premium: false, fullCatalog: TEST_CATALOG, tvBusy: false };

describe("playableCatalog (PAYMENTS-SPEC §3.11)", () => {
  it("premium → full catalog; free → free packs plus owned packs", () => {
    expect(playableCatalog(TEST_CATALOG, true, new Set())).toBe(TEST_CATALOG);
    expect(TEST_FREE_CATALOG.packs.map((p) => p.id)).toEqual(["test-ar-01", "test-en-01", "test-fr-01"]);
    const owned = playableCatalog(TEST_CATALOG, false, new Set(["test-fr-prem-01"]));
    expect(owned.packs.map((p) => p.id)).toEqual(["test-ar-01", "test-en-01", "test-fr-01", "test-fr-prem-01"]);
  });
});

describe("billing view keys (PAYMENTS-SPEC §3.11)", () => {
  it("free LOBBY: locked packs are metadata only, for the word language and age filter", () => {
    const g = lobby(3);
    const v = projectPublic(g.state, TEST_FREE_CATALOG, FREE);
    expect(v.premium).toBe(false);
    expect(v.availablePacks.map((p) => [p.id, p.tier])).toEqual([["test-en-01", "free"]]);
    expect(v.lockedPacks).toEqual([
      { id: "test-en-prem-01", locale: "en", title: { en: "Premium test", fr: "Test premium", ar: "اختبار بريميوم" }, pairCount: 10, ageRating: "all", productId: packProductId("test-en-prem-01") },
    ]);
    for (const lp of v.lockedPacks) expect(Object.keys(lp)).toEqual(["id", "locale", "title", "pairCount", "ageRating", "productId"]);
    expect(JSON.stringify(v)).not.toContain("Prem A");
    g.tv({ type: "UPDATE_SETTINGS", patch: { familyFilter: false } });
    expect(projectPublic(g.state, TEST_FREE_CATALOG, FREE).lockedPacks.map((p) => p.id)).toEqual(["test-en-prem-01", "test-en-teen-01"]);
  });
  it("premium LOBBY and every in-game phase: no locked packs", () => {
    expect(projectPublic(lobby(3).state, TEST_CATALOG, fullAccess(TEST_CATALOG)).lockedPacks).toEqual([]);
    const g = inClues(4);
    const v = projectForTv(g.state, TEST_FREE_CATALOG, FREE);
    expect(v.lockedPacks).toEqual([]);
    TvViewSchema.parse(v);
  });
  it("tvBusy only in LOBBY", () => {
    expect(projectPublic(lobby(3).state, TEST_FREE_CATALOG, { ...FREE, tvBusy: true }).tvBusy).toBe(true);
    expect(projectPublic(inClues(4).state, TEST_FREE_CATALOG, { ...FREE, tvBusy: true }).tvBusy).toBe(false);
  });
  it("poolExhausted: true only in a free LOBBY whose non-empty playable pool is fully used", () => {
    const g = lobby(3);
    const keys = candidatePairs(TEST_FREE_CATALOG, g.state.settings).map((q) => q.key);
    expect(keys.length).toBeGreaterThan(0);
    const used = { ...g.state, usedPairKeys: keys };
    expect(projectPublic(used, TEST_FREE_CATALOG, FREE).poolExhausted).toBe(true);
    expect(projectPublic({ ...g.state, usedPairKeys: keys.slice(1) }, TEST_FREE_CATALOG, FREE).poolExhausted).toBe(false);
    expect(projectPublic(used, TEST_CATALOG, fullAccess(TEST_CATALOG)).poolExhausted).toBe(false);
    expect(projectPublic({ ...used, settings: { ...used.settings, difficulties: [3], wordLocale: "fr" } }, TEST_FREE_CATALOG, FREE).poolExhausted).toBe(false);
    const c = inClues(4);
    expect(projectPublic({ ...c.state, usedPairKeys: keys }, TEST_FREE_CATALOG, FREE).poolExhausted).toBe(false);
    expect(typeof projectPublic(used, TEST_FREE_CATALOG, FREE).poolExhausted).toBe("boolean");
  });
});
