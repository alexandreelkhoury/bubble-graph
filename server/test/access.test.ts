// PAYMENTS-SPEC §3.11 / §7.2: pure room access.
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@jamaa/shared/engine";
import { contentCatalog } from "@jamaa/shared/content";
import { TEST_CATALOG } from "@jamaa/shared/testing";
import { playableFor, roomAccess, settingsPrecheck } from "../src/access";
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

describe("playableFor / settingsPrecheck (JAMAA-PLATFORM §4.4)", () => {
  const full = contentCatalog(TEST_CATALOG);
  it("free → free packs + owned families; premium → the full catalog itself; memoised", () => {
    const free = playableFor(full, roomAccess(null, NOW));
    expect(free.mishana.packs.every((p) => p.tier === "free")).toBe(true);
    expect(playableFor(full, roomAccess(null, NOW))).toBe(free);
    const owned = playableFor(full, roomAccess(ent({ premiumUntilMs: null, packs: ["test-en-prem-01"] }), NOW));
    expect(owned.mishana.packs.map((p) => p.id)).toContain("test-en-prem-01");
    expect(owned.mishana.packs.map((p) => p.id)).not.toContain("test-fr-prem-01");
    expect(playableFor(full, roomAccess(ent(), NOW))).toBe(full);
  });
  it("PACK_LOCKED for a known but locked family, then PREMIUM_REQUIRED for a premium key; null when allowed", () => {
    const a = roomAccess(null, NOW);
    const playable = playableFor(full, a);
    const cur = DEFAULT_SETTINGS;
    expect(settingsPrecheck("mishana", cur, { packIds: ["test-en-prem-01"] }, full, playable, a, "en")).toBe("PACK_LOCKED");
    expect(settingsPrecheck("mishana", cur, { points: { civilian: 1, undercover: 1, blank: 1 } }, full, playable, a, "en")).toBe("PREMIUM_REQUIRED");
    expect(settingsPrecheck("mishana", cur, { points: { ...cur.points } }, full, playable, a, "en")).toBeNull();
    expect(settingsPrecheck("mishana", cur, { packIds: ["test-en-01"] }, full, playable, a, "en")).toBeNull();
    // An unknown id is not PACK_LOCKED (reduceRoom answers INVALID_SETTINGS).
    expect(settingsPrecheck("mishana", cur, { packIds: ["no-such-pack"] }, full, playable, a, "en")).toBeNull();
    const prem = roomAccess(ent(), NOW);
    expect(settingsPrecheck("mishana", cur, { packIds: ["test-en-prem-01"], points: { civilian: 1, undercover: 1, blank: 1 } }, full, full, prem, "en")).toBeNull();
  });
});
