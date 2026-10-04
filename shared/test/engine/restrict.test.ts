// PAYMENTS-SPEC §3.11 / §7.1: the RESTRICT_SETTINGS system action.
import { describe, expect, it } from "vitest";
import { PREMIUM_SETTING_KEYS } from "../../src/billing/products";
import { DEFAULT_SETTINGS } from "../../src/engine/settings";
import { Game, SYS, TEST_CATALOG } from "../../src/testing";

function premiumLobby(): Game {
  const g = new Game({ catalog: TEST_CATALOG });
  for (let i = 0; i < 4; i++) g.join(i);
  g.tv({ type: "UPDATE_SETTINGS", patch: { packIds: ["test-en-01", "test-en-prem-01"], points: { civilian: 5, undercover: 7, blank: 9 } } });
  return g;
}

describe("RESTRICT_SETTINGS", () => {
  it("filters packIds to the allowed ids and resets every premium setting to the defaults", () => {
    const g = premiumLobby();
    const before = g.state;
    const s = g.sys({ type: "RESTRICT_SETTINGS", allowedPackIds: ["test-en-01"], resetPremiumSettings: true });
    expect(s.settings.packIds).toEqual(["test-en-01"]);
    expect(s.settings.points).toEqual(DEFAULT_SETTINGS.points);
    expect(s.settings.points).not.toBe(DEFAULT_SETTINGS.points); // deep copy, never aliased
    expect(s.version).toBe(before.version + 1);
    expect(PREMIUM_SETTING_KEYS).toContain("points");
  });

  it("an empty remaining filter becomes [] (all playable)", () => {
    const g = premiumLobby();
    const s = g.sys({ type: "RESTRICT_SETTINGS", allowedPackIds: [], resetPremiumSettings: false });
    expect(s.settings.packIds).toEqual([]);
    expect(s.settings.points).toEqual({ civilian: 5, undercover: 7, blank: 9 }); // not reset without the flag
  });

  it("returns the same object when nothing changes", () => {
    const g = premiumLobby();
    g.sys({ type: "RESTRICT_SETTINGS", allowedPackIds: ["test-en-01", "test-en-prem-01"], resetPremiumSettings: false });
    const before = g.state;
    const r = g.try({ type: "RESTRICT_SETTINGS", by: SYS, allowedPackIds: ["test-en-01", "test-en-prem-01", "x"], resetPremiumSettings: false });
    expect(r.ok && r.state).toBe(before);
    // Resetting points that are already at the defaults changes nothing either.
    g.tv({ type: "UPDATE_SETTINGS", patch: { points: { ...DEFAULT_SETTINGS.points } } });
    const s2 = g.state;
    const r2 = g.try({ type: "RESTRICT_SETTINGS", by: SYS, allowedPackIds: s2.settings.packIds, resetPremiumSettings: true });
    expect(r2.ok && r2.state).toBe(s2);
  });

  it("LOBBY only: WRONG_PHASE in game, state untouched", () => {
    const g = premiumLobby();
    g.tv({ type: "START" });
    expect(g.err({ type: "RESTRICT_SETTINGS", by: SYS, allowedPackIds: [], resetPremiumSettings: true })).toBe("WRONG_PHASE");
    expect(g.state.settings.packIds).toEqual(["test-en-01", "test-en-prem-01"]);
  });
});
