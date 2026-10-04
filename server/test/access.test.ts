// PAYMENTS-SPEC §3.11 / §7.2: pure room access.
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@mishana/shared/engine";
import { Game, TEST_CATALOG } from "@mishana/shared/testing";
import { lockedPacks, playableCatalog, restrictionFor, roomAccess } from "../src/access";
import type { RoomEntitlement } from "../src/billing/token";

const NOW = 1_790_000_000_000;
const ent = (over: Partial<RoomEntitlement> = {}): RoomEntitlement => ({ sub: "a".repeat(64), iatMs: NOW, expMs: NOW + 1000, premiumUntilMs: NOW + 500, packs: [], mode: "google", ...over });

describe("roomAccess time edges", () => {
  it("no entitlement → free, no change scheduled", () => {
    expect(roomAccess(null, NOW)).toEqual({ premium: false, packs: new Set(), changesAt: null });
  });
  it("premium until premiumUntil; packs until exp; changesAt = the earliest future instant", () => {
    const e = ent({ packs: ["en-food-01"] });
    expect(roomAccess(e, NOW)).toMatchObject({ premium: true, changesAt: NOW + 500 });
    expect(roomAccess(e, NOW + 499).premium).toBe(true);
    const at500 = roomAccess(e, NOW + 500);
    expect(at500).toMatchObject({ premium: false, changesAt: NOW + 1000 });
    expect([...at500.packs]).toEqual(["en-food-01"]);
    expect(roomAccess(e, NOW + 1000)).toEqual({ premium: false, packs: new Set(), changesAt: null });
    expect(roomAccess(ent({ premiumUntilMs: null }), NOW)).toMatchObject({ premium: false, changesAt: NOW + 1000 });
    expect(roomAccess(ent({ premiumUntilMs: NOW + 5000 }), NOW)).toMatchObject({ premium: true, changesAt: NOW + 1000 });
  });
});

describe("playableCatalog / lockedPacks / restrictionFor", () => {
  it("free → free packs + owned; premium → everything; memoised", () => {
    const free = playableCatalog(TEST_CATALOG, roomAccess(null, NOW));
    expect(free.packs.every((p) => p.tier === "free")).toBe(true);
    expect(playableCatalog(TEST_CATALOG, roomAccess(null, NOW))).toBe(free);
    const owned = playableCatalog(TEST_CATALOG, roomAccess(ent({ premiumUntilMs: null, packs: ["test-en-prem-01"] }), NOW));
    expect(owned.packs.map((p) => p.id)).toContain("test-en-prem-01");
    expect(owned.packs.map((p) => p.id)).not.toContain("test-fr-prem-01");
    expect(playableCatalog(TEST_CATALOG, roomAccess(ent(), NOW))).toBe(TEST_CATALOG);
  });
  it("lockedPacks is metadata only, for the word language", () => {
    const l = lockedPacks(TEST_CATALOG, roomAccess(null, NOW), DEFAULT_SETTINGS);
    expect(l.map((p) => p.id)).toEqual(["test-en-prem-01"]);
    expect(Object.keys(l[0]!).sort()).toEqual(["ageRating", "id", "locale", "pairCount", "productId", "title"]);
    expect(l[0]?.productId).toBe("pack_test_en_prem_01");
    expect(JSON.stringify(l)).not.toContain("Prem A");
  });
  it("restrictionFor: non-null only in LOBBY with a locked filter id or a premium setting off its default", () => {
    const g = new Game({ catalog: TEST_CATALOG });
    for (let i = 0; i < 3; i++) g.join(i);
    const freeA = roomAccess(null, NOW);
    const freeCat = playableCatalog(TEST_CATALOG, freeA);
    expect(restrictionFor(g.state, freeCat, freeA)).toBeNull();
    g.tv({ type: "UPDATE_SETTINGS", patch: { packIds: ["test-en-01", "test-en-prem-01"] } });
    expect(restrictionFor(g.state, freeCat, freeA)).toEqual({ allowedPackIds: freeCat.packs.map((p) => p.id), resetPremiumSettings: true });
    g.tv({ type: "UPDATE_SETTINGS", patch: { packIds: ["test-en-01"], points: { civilian: 1, undercover: 1, blank: 1 } } });
    expect(restrictionFor(g.state, freeCat, freeA)?.resetPremiumSettings).toBe(true);
    const prem = roomAccess(ent(), NOW);
    expect(restrictionFor(g.state, TEST_CATALOG, prem)).toBeNull();
    g.tv({ type: "START" });
    expect(restrictionFor(g.state, freeCat, freeA)).toBeNull();
  });
});
